import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { markJobApproved, requeueJob } from './jobs';

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

export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'escalated';

export interface RuleCheck {
  rule: string; // e.g. "Rule 3 - ITB Email Format"
  passed: boolean;
  detail: string;
}

export interface Review {
  id: string;
  deliverable_id: string;
  job_id: string | null;
  status: ReviewStatus;
  reviewer: 'director' | 'human';
  checks: RuleCheck[];
  rules_passed: string[];
  rules_failed: string[];
  director_notes: string | null;
  human_notes: string | null;
  created_at: string;
  decided_at: string | null;
}

export async function getPendingReviews(limit = 25): Promise<Review[]> {
  const { data, error } = await sb()
    .from('reviews')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data || []) as Review[];
}

export async function approveReview(
  reviewId: string,
  jobId: string | null,
  checks: RuleCheck[]
): Promise<void> {
  const passed = checks.filter((c) => c.passed).map((c) => c.rule);
  const { error } = await sb()
    .from('reviews')
    .update({
      status: 'approved',
      checks,
      rules_passed: passed,
      rules_failed: [],
      decided_at: new Date().toISOString(),
    })
    .eq('id', reviewId);
  if (error) throw error;
  if (jobId) await markJobApproved(jobId);
}

export async function rejectReview(
  reviewId: string,
  jobId: string | null,
  checks: RuleCheck[],
  directorNotes: string
): Promise<void> {
  const passed = checks.filter((c) => c.passed).map((c) => c.rule);
  const failed = checks.filter((c) => !c.passed).map((c) => c.rule);
  const { error } = await sb()
    .from('reviews')
    .update({
      status: 'rejected',
      checks,
      rules_passed: passed,
      rules_failed: failed,
      director_notes: directorNotes,
      decided_at: new Date().toISOString(),
    })
    .eq('id', reviewId);
  if (error) throw error;
  if (jobId) await requeueJob(jobId, directorNotes);
}

export async function escalateReview(
  reviewId: string,
  checks: RuleCheck[],
  directorNotes: string
): Promise<void> {
  const { error } = await sb()
    .from('reviews')
    .update({
      status: 'escalated',
      checks,
      rules_failed: checks.filter((c) => !c.passed).map((c) => c.rule),
      director_notes: directorNotes,
      decided_at: new Date().toISOString(),
    })
    .eq('id', reviewId);
  if (error) throw error;
}
