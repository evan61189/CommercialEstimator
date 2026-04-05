/**
 * Shared queue-consumer for specialist agents (Senior Estimator, Junior
 * Estimator, Procurement, Administrator).
 *
 * Each Netlify scheduled function imports runSpecialist() and passes its
 * agent instance + a handler map keyed by job.type. The runner:
 *   1. Atomically claims the next queued job for its role.
 *   2. Dispatches to the matching handler.
 *   3. On success, creates a deliverable (which auto-opens a review row)
 *      and marks the job pending_review.
 *   4. On failure, marks the job blocked and pushes an error event.
 */

import { BaseAgent } from '../../src/agents/base-agent';
import { claimNextJob, markJobPendingReview, markJobBlocked, Job } from './jobs';
import { createDeliverable, DeliverableKind } from './deliverables';
import { pushEvent } from './event-store';

export interface HandlerResult {
  kind: DeliverableKind;
  title: string;
  filePath?: string;
  driveFileId?: string;
  driveUrl?: string;
  contentSummary: string;
  metadata?: Record<string, unknown>;
}

export type JobHandler = (job: Job, agent: BaseAgent) => Promise<HandlerResult>;

export async function runSpecialist(
  agent: BaseAgent,
  handlers: Record<string, JobHandler>,
  maxJobsPerInvocation = 3
) {
  let processed = 0;
  for (let i = 0; i < maxJobsPerInvocation; i++) {
    const job = await claimNextJob(agent.role);
    if (!job) break;

    const handler = handlers[job.type];
    if (!handler) {
      await markJobBlocked(job.id, `No handler registered for job type "${job.type}"`);
      continue;
    }

    try {
      const result = await handler(job, agent);
      await createDeliverable({
        projectId: job.project_id,
        jobId: job.id,
        kind: result.kind,
        title: result.title,
        filePath: result.filePath,
        driveFileId: result.driveFileId,
        driveUrl: result.driveUrl,
        createdByAgent: agent.role,
        contentSummary: result.contentSummary,
        metadata: result.metadata,
      });
      await markJobPendingReview(job.id, { ...result });
      processed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await markJobBlocked(job.id, msg);
      await pushEvent({
        agentRole: agent.role,
        status: 'error',
        action: `Job failed: ${job.title}`,
        category: 'error',
        metadata: { job_id: job.id, error: msg },
      });
    }
  }
  return { processed };
}
