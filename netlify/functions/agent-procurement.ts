/**
 * Procurement runner — scheduled every 15 minutes.
 * Handles: itb_approval, bid_distribution, itb_email, bid_leveling.
 * Rule 8: never creates Gmail drafts — ITB Sub Approval spreadsheet first.
 */

import type { Config } from '@netlify/functions';
import { procurementAgent } from '../../src/agents/procurement';
import { runSpecialist, JobHandler, HandlerResult } from '../../src/lib/specialist-runner';
import { Job } from '../../src/lib/jobs';

const itbApproval: JobHandler = async (job: Job, agent): Promise<HandlerResult> => {
  const projectName = (job.payload?.project_name as string) ?? 'Unknown';
  const itbPackages = (job.payload?.itb_packages as string[]) ?? [];
  const instruction = `Build the ITB Sub Approval Spreadsheet for ${projectName}. One tab per ITB package: ${itbPackages.join(
    ', '
  )}. 14 columns: Approved Y/N, Company, Contact 1-4 Name/Email, Phone, City, State, Notes. Apply Previous Bidder Priority and Multi-Contact rules. Return the list of proposed subs per package — DO NOT create any Gmail drafts (Rule 8).`;
  const content = await agent.executeTask({
    instruction,
    category: 'itb',
    metadata: { project: projectName, packages: itbPackages },
  });
  return {
    kind: 'itb_approval',
    title: `${projectName} — ITB Sub Approval`,
    contentSummary: content,
    metadata: { project_name: projectName, itb_packages: itbPackages },
  };
};

const itbEmail: JobHandler = async (job: Job, agent): Promise<HandlerResult> => {
  const projectName = (job.payload?.project_name as string) ?? 'Unknown';
  const trade = (job.payload?.trade as string) ?? 'Unknown';
  const sub = (job.payload?.sub_company as string) ?? 'Unknown';
  const approvalDeliverableId = job.payload?.itb_approval_deliverable_id as string | undefined;
  if (!approvalDeliverableId) {
    throw new Error('ITB email requires itb_approval_deliverable_id in payload (Rule 8).');
  }
  const instruction = `Draft the ITB email for ${sub} covering the ${trade} package on ${projectName}. Follow Rule 3 format exactly: subject line pattern + 9 body sections in order. Only Clipper contact info (Rule 1). Use "Cut, Cap, and Make Safe" language for any MEP scopes (Rule 2). No TBD dates (Rule 4).`;
  const content = await agent.executeTask({
    instruction,
    category: 'itb',
    metadata: { project: projectName, trade, sub },
  });
  return {
    kind: 'itb_email',
    title: `${projectName} — ${trade} — ${sub} — ITB`,
    contentSummary: content,
    metadata: {
      project_name: projectName,
      trade,
      sub,
      itb_approval_deliverable_id: approvalDeliverableId,
    },
  };
};

const bidLeveling: JobHandler = async (job: Job, agent): Promise<HandlerResult> => {
  const projectName = (job.payload?.project_name as string) ?? 'Unknown';
  const trade = (job.payload?.trade as string) ?? 'Unknown';
  const instruction = `Build the bid leveling summary for ${trade} on ${projectName}. Compare all bids received vs. the budget estimate. Flag any >15% variance. Recommend award.`;
  const content = await agent.executeTask({
    instruction,
    category: 'leveling',
    metadata: { project: projectName, trade },
  });
  return {
    kind: 'bid_leveling',
    title: `${projectName} — ${trade} — Bid Leveling`,
    contentSummary: content,
    metadata: { project_name: projectName, trade },
  };
};

const HANDLERS: Record<string, JobHandler> = {
  itb_approval: itbApproval,
  itb_email: itbEmail,
  bid_leveling: bidLeveling,
};

export default async function handler() {
  const result = await runSpecialist(procurementAgent, HANDLERS);
  return new Response(JSON.stringify(result), {
    headers: { 'content-type': 'application/json' },
  });
}

export const config: Config = { schedule: '*/15 * * * *' };
