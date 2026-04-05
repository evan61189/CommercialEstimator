/**
 * Senior Estimator runner — scheduled every 15 minutes.
 * Handles: scope_analysis, budget_estimate, rfp_package, drawing_log.
 * Writes files directly into the Google Drive for Desktop synced folder
 * (local_folder_path on the project row).
 */

import type { Config } from '@netlify/functions';
import { seniorEstimatorAgent } from '../../src/agents/senior-estimator';
import { runSpecialist, JobHandler, HandlerResult } from '../../src/lib/specialist-runner';
import { Job } from '../../src/lib/jobs';

const scopeAnalysis: JobHandler = async (job: Job, agent): Promise<HandlerResult> => {
  const projectName = (job.payload?.project_name as string) ?? 'Unknown';
  const drawingFiles = (job.payload?.drawing_files as string[]) ?? [];
  const instruction = `Produce a scope analysis for ${projectName}. Read every page of every drawing listed below, identify every trade needed (check all disciplines), list specific sheet references per trade, key quantities, and any ambiguous items that need clarification.\n\nDrawings:\n${drawingFiles.join('\n')}`;
  const content = await agent.executeTask({
    instruction,
    category: 'scope',
    metadata: { project: projectName },
  });
  // TODO: write content into [Project]/Estimate/[Project]_Scope_Analysis.xlsx via xlsx skill
  return {
    kind: 'scope_analysis',
    title: `${projectName} — Scope Analysis`,
    contentSummary: content,
    metadata: { project_name: projectName },
  };
};

const budgetEstimate: JobHandler = async (job: Job, agent): Promise<HandlerResult> => {
  const projectName = (job.payload?.project_name as string) ?? 'Unknown';
  const instruction = `Produce a detailed budget estimate for ${projectName}. Perform quantity takeoffs from the drawings — NEVER SF-based or ratio shortcuts (Rule 11). Include GC Costs (General Conditions, Insurance 2.5%, Contingency, GC Fee per intake).`;
  const content = await agent.executeTask({
    instruction,
    category: 'pricing',
    metadata: { project: projectName },
  });
  return {
    kind: 'budget_estimate',
    title: `${projectName} — Budget Estimate`,
    contentSummary: content,
    metadata: { project_name: projectName },
  };
};

const rfpPackage: JobHandler = async (job: Job, agent): Promise<HandlerResult> => {
  const projectName = (job.payload?.project_name as string) ?? 'Unknown';
  const itbPackages = (job.payload?.itb_packages as string[]) ?? [];
  const instruction = `Build the RFP Scope Book for ${projectName} with one tab per ITB package: ${itbPackages.join(
    ', '
  )}. Each tab: full scope with drawing refs, material specs, exclusions, bid requirements.`;
  const content = await agent.executeTask({
    instruction,
    category: 'rfp',
    metadata: { project: projectName, packages: itbPackages },
  });
  return {
    kind: 'rfp_package',
    title: `${projectName} — RFP Scope Book`,
    contentSummary: content,
    metadata: { project_name: projectName, itb_packages: itbPackages },
  };
};

const HANDLERS: Record<string, JobHandler> = {
  scope_analysis: scopeAnalysis,
  budget_estimate: budgetEstimate,
  rfp_package: rfpPackage,
};

export default async function handler() {
  const result = await runSpecialist(seniorEstimatorAgent, HANDLERS);
  return new Response(JSON.stringify(result), {
    headers: { 'content-type': 'application/json' },
  });
}

export const config: Config = { schedule: '*/15 * * * *' };
