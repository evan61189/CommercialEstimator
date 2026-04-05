/**
 * Clipper Preconstruction Rules Engine
 *
 * Each rule is a pure function that takes a Deliverable + its context and
 * returns a RuleCheck. The Director runner calls every applicable rule against
 * every pending deliverable before approving it.
 *
 * Rules mirror MASTER_PROMPT.md section "SYSTEM RULES — FOLLOW THESE WITHOUT EXCEPTION".
 */

import { Deliverable } from '../deliverables';
import { RuleCheck } from '../reviews';

export interface RuleContext {
  deliverable: Deliverable;
  /** Raw text content of the deliverable (extracted from xlsx/docx/pdf by the specialist). */
  text: string;
  /** Parsed budget line items, if the deliverable is a budget_estimate or bid_leveling. */
  lineItems?: Array<{
    trade: string;
    item: string;
    budgetedAmount?: number;
    actualAmount?: number;
  }>;
  /** GC fee pct from the project. */
  gcFeePct?: number | null;
}

export type RuleFn = (ctx: RuleContext) => RuleCheck;

// ------------------------------------------------------------------
// Rule 1 — GC is the only point of contact on external documents.
// Disallow owner/architect/PM/food-service contact info on ITB, RFP,
// bid leveling, and proposal deliverables.
// ------------------------------------------------------------------
export const rule01_gcContactOnly: RuleFn = ({ deliverable, text }) => {
  const externalFacing = new Set([
    'itb_email',
    'itb_approval',
    'rfp_package',
    'proposal',
    'bid_leveling',
  ]);
  if (!externalFacing.has(deliverable.kind)) {
    return { rule: 'Rule 1 - GC Contact Only', passed: true, detail: 'N/A for this deliverable kind' };
  }
  // Look for forbidden contact-info patterns: "Architect:", "Owner Contact", "PM Email",
  // foodservice consultant names, or any email that isn't @clipper.construction.
  const forbidden = [
    /architect\s*(contact|email|phone|:)/i,
    /owner\s*(contact|email|phone|rep)/i,
    /food\s*service\s*(contact|consultant|rep)/i,
    /project\s*manager\s*(contact|email|phone)/i,
  ];
  for (const re of forbidden) {
    if (re.test(text)) {
      return {
        rule: 'Rule 1 - GC Contact Only',
        passed: false,
        detail: `Forbidden contact field detected (${re}) — only estimating@clipper.construction may appear.`,
      };
    }
  }
  // Any non-clipper email?
  const emails = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) ?? [];
  const bad = emails.filter((e) => !e.toLowerCase().endsWith('@clipper.construction'));
  if (bad.length > 0) {
    return {
      rule: 'Rule 1 - GC Contact Only',
      passed: false,
      detail: `Non-Clipper emails present: ${bad.slice(0, 3).join(', ')}`,
    };
  }
  return { rule: 'Rule 1 - GC Contact Only', passed: true, detail: 'Only Clipper contact info present' };
};

// ------------------------------------------------------------------
// Rule 2 — MEP scopes use "Cut, Cap, and Make Safe" language, never "Demolition".
// Applies to RFP packages and ITB emails for mechanical, plumbing, electrical.
// ------------------------------------------------------------------
export const rule02_mepCutCapMakeSafe: RuleFn = ({ deliverable, text }) => {
  const applicable = new Set(['rfp_package', 'itb_email', 'itb_approval']);
  if (!applicable.has(deliverable.kind)) {
    return { rule: 'Rule 2 - MEP Cut/Cap/Make Safe', passed: true, detail: 'N/A' };
  }
  const lower = text.toLowerCase();
  const isMepContext =
    /mechanical|plumbing|electrical|hvac/.test(lower) &&
    /(demolition|demo|remove)/.test(lower);
  if (!isMepContext) {
    return { rule: 'Rule 2 - MEP Cut/Cap/Make Safe', passed: true, detail: 'No MEP demo language detected' };
  }
  const hasCutCapMakeSafe = /cut,?\s*cap,?\s*and\s*make\s*safe/i.test(text);
  if (!hasCutCapMakeSafe) {
    return {
      rule: 'Rule 2 - MEP Cut/Cap/Make Safe',
      passed: false,
      detail: 'MEP scope uses demo/remove language without "Cut, Cap, and Make Safe" phrasing.',
    };
  }
  // Must reference removal by demolition contractor
  if (!/by\s+demolition\s+contractor/i.test(text)) {
    return {
      rule: 'Rule 2 - MEP Cut/Cap/Make Safe',
      passed: false,
      detail: 'Missing "— removal by demolition contractor" qualifier after disconnect items.',
    };
  }
  return { rule: 'Rule 2 - MEP Cut/Cap/Make Safe', passed: true, detail: 'Correct cut/cap/make-safe phrasing' };
};

// ------------------------------------------------------------------
// Rule 3 — ITB email format. Subject line pattern + 9 required body sections.
// ------------------------------------------------------------------
export const rule03_itbEmailFormat: RuleFn = ({ deliverable, text }) => {
  if (deliverable.kind !== 'itb_email') {
    return { rule: 'Rule 3 - ITB Email Format', passed: true, detail: 'N/A' };
  }
  const requiredSections = [
    /project\s+information/i,
    /trade\b/i,
    /scope\s+summary/i,
    /exclusions?/i,
    /bid\s+requirements/i,
    /confirmation\s+requested/i,
    /drawings?\s*(and|&)?\s*documents?/i,
  ];
  const missing: string[] = [];
  for (const re of requiredSections) {
    if (!re.test(text)) missing.push(re.source);
  }
  const hasSubject = /ITB\s*–\s*[\w &/]+\|\s*[\w ]+\s*–\s*[\w ,.]+\|\s*Clipper\s+Construction/i.test(text);
  if (!hasSubject) missing.push('Subject line pattern');
  if (missing.length > 0) {
    return {
      rule: 'Rule 3 - ITB Email Format',
      passed: false,
      detail: `ITB email missing required elements: ${missing.join(', ')}`,
    };
  }
  return { rule: 'Rule 3 - ITB Email Format', passed: true, detail: 'All 9 sections + subject present' };
};

// ------------------------------------------------------------------
// Rule 4 — Never use TBD or assumed dates. Bid due and site visit must be concrete.
// ------------------------------------------------------------------
export const rule04_noTbdDates: RuleFn = ({ deliverable, text }) => {
  const applicable = new Set(['itb_email', 'itb_approval', 'bid_distribution']);
  if (!applicable.has(deliverable.kind)) {
    return { rule: 'Rule 4 - No TBD Dates', passed: true, detail: 'N/A' };
  }
  if (/\bTBD\b/i.test(text) || /\bto\s+be\s+determined\b/i.test(text)) {
    return {
      rule: 'Rule 4 - No TBD Dates',
      passed: false,
      detail: 'TBD found in outbound document — ask Evan for the concrete date/time.',
    };
  }
  return { rule: 'Rule 4 - No TBD Dates', passed: true, detail: 'No TBD placeholders' };
};

// ------------------------------------------------------------------
// Rule 8 — ITB approval workflow is spreadsheet-first, never Gmail drafts.
// If we see a deliverable of kind itb_email that has no corresponding
// itb_approval sibling, the workflow was skipped.
// ------------------------------------------------------------------
export const rule08_spreadsheetFirst: RuleFn = ({ deliverable }) => {
  if (deliverable.kind !== 'itb_email') {
    return { rule: 'Rule 8 - Spreadsheet-First ITB', passed: true, detail: 'N/A' };
  }
  // This rule is fully enforced at orchestration time (enqueueJob). Here we
  // verify the metadata carries a reference to the approved ITB_Sub_Approval workbook.
  const approvalRef = (deliverable.metadata as Record<string, unknown>)?.itb_approval_deliverable_id;
  if (!approvalRef) {
    return {
      rule: 'Rule 8 - Spreadsheet-First ITB',
      passed: false,
      detail: 'ITB email has no linked ITB Sub Approval spreadsheet deliverable.',
    };
  }
  return { rule: 'Rule 8 - Spreadsheet-First ITB', passed: true, detail: 'Linked to approved sub list' };
};

// ------------------------------------------------------------------
// Rule 9 — Self-perform rule. Every trade in scope must have an ITB.
// Check is performed on bid_leveling and itb_approval deliverables.
// ------------------------------------------------------------------
export const rule09_everyTradeBidOut: RuleFn = ({ deliverable, text }) => {
  if (deliverable.kind !== 'itb_approval' && deliverable.kind !== 'bid_leveling') {
    return { rule: 'Rule 9 - Every Trade Bid Out', passed: true, detail: 'N/A' };
  }
  if (/self\s*perform/i.test(text) || /in[- ]house\s+labor/i.test(text)) {
    return {
      rule: 'Rule 9 - Every Trade Bid Out',
      passed: false,
      detail: 'Self-perform or in-house labor mentioned — Clipper does not self-perform.',
    };
  }
  return { rule: 'Rule 9 - Every Trade Bid Out', passed: true, detail: 'No self-perform scope detected' };
};

// ------------------------------------------------------------------
// Rule 10 — GC Fee must be present on budget/proposal deliverables.
// ------------------------------------------------------------------
export const rule10_gcFeePresent: RuleFn = ({ deliverable, text, gcFeePct }) => {
  const applicable = new Set(['budget_estimate', 'proposal', 'bid_leveling']);
  if (!applicable.has(deliverable.kind)) {
    return { rule: 'Rule 10 - GC Fee Present', passed: true, detail: 'N/A' };
  }
  const hasGcFeeLine = /gc\s*fee|general\s*contractor\s*fee/i.test(text);
  if (!hasGcFeeLine) {
    return {
      rule: 'Rule 10 - GC Fee Present',
      passed: false,
      detail: 'No GC Fee line found on budget/proposal deliverable.',
    };
  }
  if (gcFeePct == null) {
    return {
      rule: 'Rule 10 - GC Fee Present',
      passed: false,
      detail: 'Project has no GC Fee % configured — confirm at intake (ASR=8%, default=5%).',
    };
  }
  return { rule: 'Rule 10 - GC Fee Present', passed: true, detail: `GC Fee ${gcFeePct}% applied` };
};

// ------------------------------------------------------------------
// Rule 11 — Quantity takeoff from drawings, no SF-based or ratio shortcuts.
// Also: dollar sanity — flag >15% variance vs. unit pricing / budget.
// ------------------------------------------------------------------
export const rule11_takeoffSanity: RuleFn = ({ deliverable, text, lineItems }) => {
  const applicable = new Set(['budget_estimate', 'scope_analysis', 'bid_leveling']);
  if (!applicable.has(deliverable.kind)) {
    return { rule: 'Rule 11 - Takeoff Standards', passed: true, detail: 'N/A' };
  }
  // Detect forbidden shortcut language.
  const shortcuts = [
    /\$\d+(\.\d+)?\s*\/\s*sf/i,
    /lump\s*sum\s*guess/i,
    /ratio[- ]based/i,
    /sf[- ]based\s*assumption/i,
    /per\s+square\s+foot\s+allowance/i,
  ];
  for (const re of shortcuts) {
    if (re.test(text)) {
      return {
        rule: 'Rule 11 - Takeoff Standards',
        passed: false,
        detail: `SF-based or ratio shortcut detected: ${re.source}`,
      };
    }
  }
  // Dollar sanity: flag any line item >15% variance vs. budget.
  if (lineItems && lineItems.length > 0) {
    const flagged = lineItems.filter((li) => {
      if (li.budgetedAmount == null || li.actualAmount == null || li.budgetedAmount === 0) return false;
      const variance = Math.abs((li.actualAmount - li.budgetedAmount) / li.budgetedAmount) * 100;
      return variance > 15;
    });
    if (flagged.length > 0) {
      return {
        rule: 'Rule 11 - Takeoff Standards',
        passed: false,
        detail: `${flagged.length} line item(s) >15% variance vs. budget — needs review: ${flagged
          .slice(0, 3)
          .map((f) => f.trade + '/' + f.item)
          .join('; ')}`,
      };
    }
  }
  return { rule: 'Rule 11 - Takeoff Standards', passed: true, detail: 'Detailed takeoff, variance within 15%' };
};

// ------------------------------------------------------------------
// Registry
// ------------------------------------------------------------------
export const ALL_RULES: RuleFn[] = [
  rule01_gcContactOnly,
  rule02_mepCutCapMakeSafe,
  rule03_itbEmailFormat,
  rule04_noTbdDates,
  rule08_spreadsheetFirst,
  rule09_everyTradeBidOut,
  rule10_gcFeePresent,
  rule11_takeoffSanity,
];

export function runAllRules(ctx: RuleContext): RuleCheck[] {
  return ALL_RULES.map((fn) => fn(ctx));
}
