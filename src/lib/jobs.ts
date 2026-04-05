import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { AgentRole } from './types';

let _client: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

export type JobStatus =
  | 'queued'
  | 'in_progress'
  | 'pending_review'
  | 'approved'
  | 'blocked'
  | 'done'
  | 'cancelled';

export interface Job {
  id: string;
  project_id: string | null;
  agent_role: AgentRole;
  type: string;
  status: JobStatus;
  title: string;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  priority: number;
  attempts: number;
  last_error: string | null;
  parent_job_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Enqueue a new job for a specific agent. */
export async function enqueueJob(params: {
  projectId: string | null;
  agentRole: AgentRole;
  type: string;
  title: string;
  payload?: Record<string, unknown>;
  priority?: number;
  parentJobId?: string | null;
}): Promise<Job> {
  const { data, error } = await sb()
    .from('jobs')
    .insert({
      project_id: params.projectId,
      agent_role: params.agentRole,
      type: params.type,
      title: params.title,
      payload: params.payload ?? {},
      priority: params.priority ?? 5,
      parent_job_id: params.parentJobId ?? null,
      status: 'queued',
    })
    .select()
    .single();
  if (error) throw error;
  return data as Job;
}

/** Atomically claim the next queued job for an agent (highest priority, FIFO). */
export async function claimNextJob(agentRole: AgentRole): Promise<Job | null> {
  // Look for the next queued job for this role.
  const { data: candidates, error: selErr } = await sb()
    .from('jobs')
    .select('*')
    .eq('agent_role', agentRole)
    .eq('status', 'queued')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(1);
  if (selErr) throw selErr;
  if (!candidates || candidates.length === 0) return null;

  const candidate = candidates[0] as Job;

  // Atomic claim: only succeed if still queued.
  const { data: claimed, error: updErr } = await sb()
    .from('jobs')
    .update({
      status: 'in_progress',
      started_at: new Date().toISOString(),
      attempts: candidate.attempts + 1,
    })
    .eq('id', candidate.id)
    .eq('status', 'queued')
    .select()
    .single();
  if (updErr || !claimed) return null;
  return claimed as Job;
}

export async function markJobPendingReview(
  jobId: string,
  result: Record<string, unknown>
): Promise<void> {
  const { error } = await sb()
    .from('jobs')
    .update({
      status: 'pending_review',
      result,
      finished_at: new Date().toISOString(),
    })
    .eq('id', jobId);
  if (error) throw error;
}

export async function markJobApproved(jobId: string): Promise<void> {
  const { error } = await sb()
    .from('jobs')
    .update({ status: 'approved' })
    .eq('id', jobId);
  if (error) throw error;
}

export async function markJobDone(jobId: string): Promise<void> {
  const { error } = await sb()
    .from('jobs')
    .update({ status: 'done' })
    .eq('id', jobId);
  if (error) throw error;
}

export async function markJobBlocked(jobId: string, error_message: string): Promise<void> {
  const { error } = await sb()
    .from('jobs')
    .update({ status: 'blocked', last_error: error_message })
    .eq('id', jobId);
  if (error) throw error;
}

/** Send a job back to its specialist with director notes (used on rejection). */
export async function requeueJob(jobId: string, directorNotes: string): Promise<void> {
  const { error } = await sb()
    .from('jobs')
    .update({
      status: 'queued',
      last_error: `Sent back by Director: ${directorNotes}`,
      started_at: null,
      finished_at: null,
    })
    .eq('id', jobId);
  if (error) throw error;
}
