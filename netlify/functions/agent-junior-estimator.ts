/**
 * Junior Estimator runner — scheduled every 15 minutes.
 *
 * NOTE: Per Evan's decision (2026-04-05), actual Gmail polling of
 * estimating@clipper.construction runs as a Cowork scheduled task (see
 * cowork-tasks/inbox-scan-to-supabase.md). That task writes new
 * inbox_messages rows and enqueues jobs for this runner.
 *
 * This runner handles jobs already-queued for the Junior Estimator:
 *   - classify_inbox_message: pull an inbox_messages row, enrich it,
 *     link to the right project.
 *   - update_bid_distribution: record a bid response in the project's
 *     Bid Distribution workbook.
 *   - follow_up_sub: send the Day 3 / Day 5 / Day 7 follow-ups.
 */

import type { Config } from '@netlify/functions';
import { juniorEstimatorAgent } from '../../src/agents/junior-estimator';
import { runSpecialist, JobHandler, HandlerResult } from '../../src/lib/specialist-runner';
import { Job } from '../../src/lib/jobs';

const classifyInboxMessage: JobHandler = async (job: Job, agent): Promise<HandlerResult> => {
  const gmailId = job.payload?.gmail_id as string;
  const subject = (job.payload?.subject as string) ?? '';
  const sender = (job.payload?.sender as string) ?? '';
  const snippet = (job.payload?.snippet as string) ?? '';
  const instruction = `Classify this inbound email to estimating@clipper.construction. Decide: new_job | bid_submitted | will_bid | no_bid | rfi | ambiguous.\n\nSender: ${sender}\nSubject: ${subject}\nSnippet: ${snippet}\n\nRespond with: CLASSIFICATION=<value>, PROJECT=<name or unknown>, REASONING=<one sentence>`;
  const content = await agent.executeTask({
    instruction,
    category: 'classification',
    metadata: { gmail_id: gmailId },
  });
  return {
    kind: 'sub_response_update',
    title: `Classified inbound: ${subject}`,
    contentSummary: content,
    metadata: { gmail_id: gmailId, sender },
  };
};

const followUpSub: JobHandler = async (job: Job, agent): Promise<HandlerResult> => {
  const projectName = (job.payload?.project_name as string) ?? 'Unknown';
  const trade = (job.payload?.trade as string) ?? 'Unknown';
  const sub = (job.payload?.sub_company as string) ?? 'Unknown';
  const day = (job.payload?.follow_up_day as number) ?? 3;
  const instruction = `Draft a Day ${day} follow-up email to ${sub} for the ${trade} ITB on ${projectName}. Keep it brief, professional, and reiterate the bid due date.`;
  const content = await agent.executeTask({
    instruction,
    category: 'followup',
    metadata: { project: projectName, trade, sub, day },
  });
  return {
    kind: 'itb_email',
    title: `${projectName} — ${trade} — ${sub} — Day ${day} Follow-Up`,
    contentSummary: content,
    metadata: { project_name: projectName, trade, sub, day },
  };
};

const HANDLERS: Record<string, JobHandler> = {
  classify_inbox_message: classifyInboxMessage,
  follow_up_sub: followUpSub,
};

export default async function handler() {
  const result = await runSpecialist(juniorEstimatorAgent, HANDLERS);
  return new Response(JSON.stringify(result), {
    headers: { 'content-type': 'application/json' },
  });
}

export const config: Config = { schedule: '*/15 * * * *' };
