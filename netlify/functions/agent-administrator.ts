/**
 * Administrator runner — scheduled every 15 minutes.
 * Handles: folder_setup, drawing_log, proposal formatting, share link generation.
 * Writes files directly into the Google Drive for Desktop synced folder.
 */

import type { Config } from '@netlify/functions';
import { administratorAgent } from '../../src/agents/administrator';
import { runSpecialist, JobHandler, HandlerResult } from '../../src/lib/specialist-runner';
import { Job } from '../../src/lib/jobs';

const folderSetup: JobHandler = async (job: Job, agent): Promise<HandlerResult> => {
  const projectName = (job.payload?.project_name as string) ?? 'Unknown';
  const instruction = `Create the project folder structure for ${projectName} by copying _New Project Template/. Subfolders: Bids, Contracts, Drawings, Estimate, Proposals, RFIs, Submittals. Copy all Templates/ workbooks into the appropriate subfolders. Enforce naming conventions.`;
  const content = await agent.executeTask({
    instruction,
    category: 'admin',
    metadata: { project: projectName },
  });
  return {
    kind: 'folder_setup',
    title: `${projectName} — Folder Setup`,
    contentSummary: content,
    metadata: { project_name: projectName },
  };
};

const drawingLog: JobHandler = async (job: Job, agent): Promise<HandlerResult> => {
  const projectName = (job.payload?.project_name as string) ?? 'Unknown';
  const drawings = (job.payload?.drawings as string[]) ?? [];
  const instruction = `Build the Drawing Log for ${projectName} from the files in Drawings/. Use TEMPLATE_Drawing_Log.xlsx as the starting point. Drawings on file: ${drawings.join(
    ', '
  )}.`;
  const content = await agent.executeTask({
    instruction,
    category: 'admin',
    metadata: { project: projectName, count: drawings.length },
  });
  return {
    kind: 'drawing_log',
    title: `${projectName} — Drawing Log`,
    contentSummary: content,
    metadata: { project_name: projectName },
  };
};

const proposal: JobHandler = async (job: Job, agent): Promise<HandlerResult> => {
  const projectName = (job.payload?.project_name as string) ?? 'Unknown';
  const instruction = `Produce the final GC proposal for ${projectName} in Clipper's standard format. Include cover page, scope summary, clarifications, exclusions, schedule, and price. Only Clipper contact info (Rule 1). GC Fee applied per intake (Rule 10).`;
  const content = await agent.executeTask({
    instruction,
    category: 'proposal',
    metadata: { project: projectName },
  });
  return {
    kind: 'proposal',
    title: `${projectName} — GC Proposal`,
    contentSummary: content,
    metadata: { project_name: projectName },
  };
};

const HANDLERS: Record<string, JobHandler> = {
  folder_setup: folderSetup,
  drawing_log: drawingLog,
  proposal: proposal,
};

export default async function handler() {
  const result = await runSpecialist(administratorAgent, HANDLERS);
  return new Response(JSON.stringify(result), {
    headers: { 'content-type': 'application/json' },
  });
}

export const config: Config = { schedule: '*/15 * * * *' };
