'use client';

/**
 * ReviewQueue — the Director's QC inbox.
 *
 * Subscribes to Supabase Realtime for any row in `reviews` where status is
 * 'pending' or 'escalated'. Shows the deliverable kind, which specialist
 * produced it, which rules failed, and lets Evan approve or send back with
 * notes.
 */

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ReviewRow {
  id: string;
  deliverable_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'escalated';
  rules_failed: string[] | null;
  director_notes: string | null;
  created_at: string;
  deliverables?: {
    kind: string;
    title: string;
    created_by_agent: string;
    project_id: string | null;
  };
}

export default function ReviewQueue() {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchRows() {
    const { data } = await supabase
      .from('reviews')
      .select('*, deliverables(kind,title,created_by_agent,project_id)')
      .in('status', ['pending', 'escalated'])
      .order('created_at', { ascending: true });
    setRows((data as ReviewRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchRows();
    const ch = supabase
      .channel('review-queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, fetchRows)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  async function humanApprove(id: string) {
    await supabase
      .from('reviews')
      .update({
        status: 'approved',
        reviewer: 'human',
        decided_at: new Date().toISOString(),
      })
      .eq('id', id);
  }

  async function humanReject(id: string) {
    const note = prompt('Send back with note:');
    if (!note) return;
    await supabase
      .from('reviews')
      .update({
        status: 'rejected',
        reviewer: 'human',
        human_notes: note,
        decided_at: new Date().toISOString(),
      })
      .eq('id', id);
  }

  if (loading) return <div className="text-slate-400">Loading review queue…</div>;

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-slate-900/95 to-slate-950/95 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">
          Director Review Queue{' '}
          <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-400">
            {rows.length}
          </span>
        </h2>
        <span className="text-xs uppercase tracking-widest text-slate-500">Live</span>
      </div>

      {rows.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500">
          All clear. Nothing awaiting Director review.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li
              key={r.id}
              className={`rounded-xl border p-4 ${
                r.status === 'escalated'
                  ? 'border-red-500/40 bg-red-950/20'
                  : 'border-amber-500/20 bg-slate-900/60'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-white">
                    {r.deliverables?.title ?? '—'}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {r.deliverables?.kind} · by {r.deliverables?.created_by_agent} ·{' '}
                    {new Date(r.created_at).toLocaleTimeString()}
                  </div>
                  {r.rules_failed && r.rules_failed.length > 0 && (
                    <div className="mt-2 text-xs text-red-400">
                      Failed: {r.rules_failed.join(', ')}
                    </div>
                  )}
                  {r.director_notes && (
                    <div className="mt-2 whitespace-pre-wrap text-xs text-slate-300">
                      {r.director_notes}
                    </div>
                  )}
                </div>
                <div className="flex flex-shrink-0 gap-2">
                  <button
                    onClick={() => humanApprove(r.id)}
                    className="rounded-lg bg-green-500/20 px-3 py-1.5 text-xs font-semibold text-green-400 hover:bg-green-500/30"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => humanReject(r.id)}
                    className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/30"
                  >
                    Send Back
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
