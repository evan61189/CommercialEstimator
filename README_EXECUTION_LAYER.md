# Execution Layer — Phase 1 + Phase 2

This branch turns the CommercialEstimator repo from a **monitoring dashboard** into a **supervised execution platform** for Clipper Construction's preconstruction AI team.

## What's new

### Supabase schema (`migrations/0002_execution_layer.sql`)
Seven new tables on top of the existing `agent_events` and `agent_snapshots`:

| Table | Purpose |
|---|---|
| `projects` | One row per active job. Replaces the hardcoded project list in MASTER_PROMPT.md. Seeded with the 11 active projects as of 2026-03-17. |
| `jobs` | The work queue. State machine: `queued → in_progress → pending_review → approved → done` (or `blocked` / `rejected → re-queued`). Replaces `_Dispatch_Queue.md` as the source of truth. |
| `deliverables` | Every file a specialist produces. Auto-opens a `reviews` row on insert. |
| `reviews` | The Director QC gate. Rules passed/failed, director notes, approve/reject/escalate. |
| `dollar_checks` | Rule 11 sanity checks — line-item variance vs. budget. Flags anything >15%. |
| `inbox_messages` | Mirror of Gmail traffic, written by the Cowork inbox-scan task. |
| `sub_response_tracking` | Structured version of `Sub_Response_Tracker.xlsx` so the dashboard can query it. |

All 7 tables have Realtime enabled and public-read RLS. **Applied to the live `ConstructionEstimator` Supabase project on 2026-04-05.**

### TypeScript helpers (`src/lib/`)
- `jobs.ts` — `enqueueJob`, `claimNextJob` (atomic), `markJobPendingReview`, `markJobApproved`, `markJobBlocked`, `requeueJob`.
- `deliverables.ts` — `createDeliverable` (auto-opens a pending review), `getDeliverable`.
- `reviews.ts` — `getPendingReviews`, `approveReview`, `rejectReview`, `escalateReview`.
- `specialist-runner.ts` — shared queue-consumer skeleton for all 4 specialists.
- `rules/index.ts` — rules engine with 8 rules from MASTER_PROMPT.md: Rule 1 (GC contact only), Rule 2 (MEP cut/cap/make-safe), Rule 3 (ITB email format), Rule 4 (no TBD dates), Rule 8 (spreadsheet-first ITB), Rule 9 (every trade bid out), Rule 10 (GC fee present), Rule 11 (takeoff standards + 15% variance).

### Scheduled agent runners (`netlify/functions/`)
Each specialist is a Netlify Scheduled Function that claims jobs from its queue, runs Claude Opus, writes a deliverable, and leaves it for the Director to review.

| Function | Schedule | Handles |
|---|---|---|
| `agent-director` | every 2 min | runs rules engine + Opus review pass on every pending review |
| `agent-senior-estimator` | every 15 min | scope_analysis, budget_estimate, rfp_package |
| `agent-junior-estimator` | every 15 min | classify_inbox_message, follow_up_sub |
| `agent-procurement` | every 15 min | itb_approval, itb_email, bid_leveling |
| `agent-administrator` | every 15 min | folder_setup, drawing_log, proposal |

### Dashboard component (`src/components/ReviewQueue.tsx`)
Live-subscribing Director review inbox with Approve / Send Back buttons. Drop it into `src/app/page.tsx` alongside the existing agent status strip.

### Cowork inbox task (`cowork-tasks/inbox-scan-to-supabase.md`)
Per Evan's decision 2026-04-05, Gmail polling stays in Cowork (where Gmail MCP is available) and writes to Supabase. Instructions for the scheduled task are in this file — create it via the `schedule` skill.

## Deploy checklist

1. **Supabase migration** — already applied to `clxziihhymxjmrvvtlgh` on 2026-04-05. `migrations/0002_execution_layer.sql` is committed for version history.

2. **Netlify env vars** — confirm these are set on the production site:
   - `ANTHROPIC_API_KEY` ✅ (already present)
   - `NEXT_PUBLIC_SUPABASE_URL` ✅
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` ✅
   - `SUPABASE_SERVICE_ROLE_KEY` — **needed by the runners, verify before deploy**

3. **Deploy** — push this branch, open a PR against `main`, review, merge. Netlify will register the scheduled functions automatically.

4. **Create the Cowork inbox task** — in a Cowork session with the Clipper Preconstruction AI System folder selected, use the `schedule` skill with the prompt in `cowork-tasks/inbox-scan-to-supabase.md`.

5. **Add dashboard zone** — in `src/app/page.tsx`, import and render `<ReviewQueue />` near the top. Kanban + drill-down views are Phase 3.

## Safety behavior

- A specialist never sends anything externally. It only writes files and enqueues deliverables for review.
- The only code path that can mark a deliverable "approved" is `approveReview()` in `src/lib/reviews.ts`, which is called by either the Director runner (after rules+Opus pass) or by Evan clicking Approve in the dashboard.
- Rule 8 means an `itb_email` deliverable without a linked `itb_approval` deliverable will always fail review.
- Rule 11 flags >15% line-item variance automatically.
- On hard errors the job goes to `blocked` and surfaces in the dashboard for Evan.

## What's still ahead

- Phase 3 — project kanban + drill-down on the dashboard.
- Phase 4 — backfill the 11 seeded projects with their current open jobs.
- Phase 5 — parallel run on one project (recommended: Brighter Days or Rehab 2 Perform Harbor Point) before cutting over the others.

---

Prepared by Claude + Evan, 2026-04-05.
