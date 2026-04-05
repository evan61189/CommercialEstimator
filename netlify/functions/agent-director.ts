/**
 * Director QC Gate Runner
 *
 * Scheduled every 2 minutes. For every pending review row:
 *   1. Load the deliverable and its source file (xlsx/docx/pdf) from the
 *      project's local folder. Extract text content.
 *   2. Run the rules engine (Rules 1, 2, 3, 4, 8, 9, 10, 11).
 *   3. Ask Claude Opus to review the same deliverable for issues the rules
 *      engine didn't catch (clarity, completeness, tone).
 *   4. Approve, reject (send back to specialist with diff), or escalate to Evan.
 *
 * Nothing with review.status != 'approved' may be sent externally.
 */

import type { Config } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import { getPendingReviews, approveReview, rejectReview, escalateReview, RuleCheck } from '../../src/lib/reviews';
import { getDeliverable } from '../../src/lib/deliverables';
import { runAllRules, RuleContext } from '../../src/lib/rules';
import { pushEvent } from '../../src/lib/event-store';

const MODEL = 'claude-opus-4-20250514';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const DIRECTOR_REVIEW_PROMPT = `You are The Director of Preconstruction for Clipper Construction. You have just received a deliverable from one of your specialists. A rules-engine has already run mechanical checks — your job is to catch the things the rules engine can't:

- Does the deliverable read clearly and professionally?
- Are there ambiguous or contradictory statements?
- Are quantities, unit prices, and totals internally consistent?
- Does it match Clipper's voice and formatting standards?
- Is anything obviously missing that a reader would need?

Respond in this exact format:
VERDICT: APPROVE | REJECT | ESCALATE
ISSUES: <one per line, or "none">
NOTES: <1-3 sentence summary for Evan>

Use REJECT when a specialist can fix it with clear instructions. Use ESCALATE only when human judgment is required (ambiguous scope, missing info from client, etc).`;

async function extractTextFromFile(filePath: string | null): Promise<string> {
  if (!filePath) return '';
  try {
    // For v1 we only handle plain text and markdown. xlsx/docx/pdf extraction
    // is done by the specialist at deliverable-creation time and stored in
    // deliverable.content_summary.
    const buf = await readFile(filePath, 'utf-8');
    return buf;
  } catch {
    return '';
  }
}

async function reviewOne(reviewId: string, deliverableId: string, jobId: string | null) {
  const deliverable = await getDeliverable(deliverableId);
  if (!deliverable) {
    await escalateReview(reviewId, [], 'Deliverable row not found.');
    return;
  }

  // Load project for gc_fee_pct context
  let gcFeePct: number | null = null;
  if (deliverable.project_id) {
    const { data } = await sb.from('projects').select('gc_fee_pct').eq('id', deliverable.project_id).single();
    gcFeePct = (data?.gc_fee_pct as number | null) ?? null;
  }

  const fileText = await extractTextFromFile(deliverable.file_path);
  const text = deliverable.content_summary || fileText || '';

  const lineItems =
    ((deliverable.metadata as Record<string, unknown>)?.line_items as RuleContext['lineItems']) ?? undefined;

  const ctx: RuleContext = { deliverable, text, lineItems, gcFeePct };
  const ruleChecks: RuleCheck[] = runAllRules(ctx);
  const anyFailed = ruleChecks.some((c) => !c.passed);

  // Log the director starting work
  await pushEvent({
    agentRole: 'director',
    status: 'reviewing',
    action: `Reviewing ${deliverable.kind}: ${deliverable.title}`,
    category: 'review',
    metadata: { deliverable_id: deliverableId },
  });

  // Always run the Opus review pass for context, even if rules pass.
  const client = new Anthropic();
  const opusResponse = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: DIRECTOR_REVIEW_PROMPT,
    messages: [
      {
        role: 'user',
        content: `DELIVERABLE KIND: ${deliverable.kind}\nTITLE: ${deliverable.title}\nCREATED BY: ${deliverable.created_by_agent}\n\n--- RULES ENGINE RESULTS ---\n${ruleChecks
          .map((c) => `${c.passed ? '✅' : '❌'} ${c.rule}: ${c.detail}`)
          .join('\n')}\n\n--- DELIVERABLE CONTENT ---\n${text.slice(0, 40000)}`,
      },
    ],
  });
  const opusText = opusResponse.content
    .filter((b) => b.type === 'text')
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('\n');

  const verdictMatch = opusText.match(/VERDICT:\s*(APPROVE|REJECT|ESCALATE)/i);
  const verdict = (verdictMatch?.[1] || '').toUpperCase() as 'APPROVE' | 'REJECT' | 'ESCALATE';
  const notesMatch = opusText.match(/NOTES:\s*([\s\S]*?)(?:\n\s*\n|$)/i);
  const notes = (notesMatch?.[1] || '').trim();

  // Final decision: if rules failed OR opus said REJECT, reject.
  // If opus said ESCALATE, escalate regardless of rules.
  // Otherwise approve.
  if (verdict === 'ESCALATE') {
    await escalateReview(reviewId, ruleChecks, notes || opusText);
    await pushEvent({
      agentRole: 'director',
      status: 'waiting',
      action: `Escalated ${deliverable.kind}: ${deliverable.title}`,
      category: 'review',
      metadata: { deliverable_id: deliverableId, notes },
    });
    return;
  }
  if (anyFailed || verdict === 'REJECT') {
    const notesWithRules = [
      notes,
      ...ruleChecks.filter((c) => !c.passed).map((c) => `- ${c.rule}: ${c.detail}`),
    ]
      .filter(Boolean)
      .join('\n');
    await rejectReview(reviewId, jobId, ruleChecks, notesWithRules || 'See rules engine output.');
    await pushEvent({
      agentRole: 'director',
      status: 'idle',
      action: `Rejected ${deliverable.kind}: ${deliverable.title}`,
      category: 'review',
      metadata: { deliverable_id: deliverableId, notes: notesWithRules },
    });
    return;
  }
  await approveReview(reviewId, jobId, ruleChecks);
  await pushEvent({
    agentRole: 'director',
    status: 'idle',
    action: `Approved ${deliverable.kind}: ${deliverable.title}`,
    category: 'approval',
    metadata: { deliverable_id: deliverableId, notes },
  });
}

export default async function handler() {
  const pending = await getPendingReviews(10);
  for (const r of pending) {
    try {
      await reviewOne(r.id, r.deliverable_id, r.job_id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await escalateReview(r.id, [], `Director runner crashed: ${msg}`);
    }
  }
  return new Response(JSON.stringify({ reviewed: pending.length }), {
    headers: { 'content-type': 'application/json' },
  });
}

export const config: Config = {
  schedule: '*/2 * * * *', // every 2 minutes
};
