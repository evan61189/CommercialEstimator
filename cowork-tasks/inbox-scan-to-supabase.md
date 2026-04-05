# Cowork Scheduled Task — Inbox Scan → Supabase

**Schedule:** Every 15 minutes, weekdays 7:00 AM – 7:00 PM ET
**Runs in:** Cowork session with Clipper Preconstruction AI System folder selected
**Writes to:** Supabase `ConstructionEstimator` project (ref: `clxziihhymxjmrvvtlgh`)

## Why this is a Cowork task and not a Netlify function

The Gmail MCP and Google Drive MCP are only available from inside a Cowork session. Netlify functions can't call MCPs directly. So the inbox polling loop stays in Cowork and writes its results to Supabase, where the rest of the agent team picks them up.

## Instructions for the scheduled task

You are the Junior Estimator. Every 15 minutes, do the following:

1. **Scan the inbox.** Use `gmail_search_messages` with the query `to:estimating@clipper.construction is:unread newer_than:1d`. Get up to 20 most recent.

2. **For each message**, extract: gmail_id, gmail_thread_id, sender_email, sender_name, subject, snippet, received_at, has_attachments, attachment_names.

3. **Classify the message** using the existing `_Agent1_Inbox_Classifier_SKILL.md` logic: new_job | bid_submitted | will_bid | no_bid | rfi | ambiguous. If the sender matches a known sub + project combination from an active Bid Distribution workbook, link it to that `project_id`.

4. **Upsert into Supabase** `inbox_messages` (primary key: gmail_id). Set `processed_at = now()` and `processed_by_agent = 'junior-estimator'`.

5. **Enqueue a follow-up job** into `jobs` if action is needed:
   - `new_job` → enqueue `folder_setup` for Administrator with the project name in payload.
   - `bid_submitted` with PDF attachment → download via Drive MCP into the project's `Bids/` folder, enqueue `bid_leveling` for Procurement.
   - `will_bid` / `no_bid` → enqueue `update_bid_distribution` for Junior Estimator.
   - `rfi` → enqueue `classify_inbox_message` for Junior Estimator with higher priority.
   - `ambiguous` → insert a `reviews` row with `reviewer='human'` and `status='escalated'` so Evan sees it in the dashboard.

6. **Apply Gmail labels** per Rule 12: remove `UNREAD`, add `Processed Bids` or `Processed New Jobs`.

7. **Log one row to `agent_events`** per message processed so the live dashboard shows activity.

## Supabase credentials

Use the env vars `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set at the Cowork workspace level. If they aren't set, ask Evan to add them.

## Safety rules

- Never mark a message processed unless all steps succeed.
- Never send email as part of this task — enqueue jobs and let the specialist runners do outbound work through the Director QC gate.
- If the queue in Supabase is already full with 50+ queued jobs, skip enqueueing new work and log a warning instead.
