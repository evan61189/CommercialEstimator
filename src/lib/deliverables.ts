import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { AgentRole } from './types';

let _client: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  return _client;
}

export type DeliverableKind =
  | 'scope_analysis'
  | 'budget_estimate'
  | 'rfp_package'
  | 'bid_distribution'
  | 'itb_approval'
  | 'itb_email'
  | 'bid_leveling'
  | 'proposal'
  | 'drawing_log'
  | 'sub_response_update'
  | 'bid_learning_update'
  | 'folder_setup'
  | 'other';

export interface Deliverable {
  id: string;
  project_id: string | null;
  job_id: string | null;
  kind: DeliverableKind;
  title: string;
  file_path: string | null;
  drive_file_id: string | null;
  drive_url: string | null;
  version: number;
  created_by_agent: AgentRole;
  content_summary: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Record that a specialist produced a file, then queue it for director review. */
export async function createDeliverable(params: {
  projectId: string | null;
  jobId: string | null;
  kind: DeliverableKind;
  title: string;
  filePath?: string;
  driveFileId?: string;
  driveUrl?: string;
  createdByAgent: AgentRole;
  contentSummary?: string;
  metadata?: Record<string, unknown>;
}): Promise<Deliverable> {
  const { data, error } = await sb()
    .from('deliverables')
    .insert({
      project_id: params.projectId,
      job_id: params.jobId,
      kind: params.kind,
      title: params.title,
      file_path: params.filePath ?? null,
      drive_file_id: params.driveFileId ?? null,
      drive_url: params.driveUrl ?? null,
      created_by_agent: params.createdByAgent,
      content_summary: params.contentSummary ?? null,
      metadata: params.metadata ?? {},
    })
    .select()
    .single();
  if (error) throw error;

  // Auto-open a pending review row so the Director runner picks it up.
  const { error: reviewErr } = await sb().from('reviews').insert({
    deliverable_id: (data as Deliverable).id,
    job_id: params.jobId,
    status: 'pending',
    reviewer: 'director',
  });
  if (reviewErr) throw reviewErr;

  return data as Deliverable;
}

export async function getDeliverable(id: string): Promise<Deliverable | null> {
  const { data, error } = await sb()
    .from('deliverables')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as Deliverable;
}
