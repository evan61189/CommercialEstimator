import type { Handler, HandlerContext, HandlerEvent } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { listRecentInboxMessages, getMessageDetail } from "../../src/lib/gmail";
import { classifyIntake } from "../../src/lib/intake-classifier";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const LOOKBACK_MINUTES = Number(process.env.INBOX_LOOKBACK_MINUTES || "15");

/**
 * Scheduled function that scans the estimating@ Gmail inbox and
 * mirrors new messages into Supabase 'inbox_messages'. If a message
 * classifies as a new project intake, it also creates a row in
 * 'projects' and enqueues a 'project_intake' job for the Director.
 *
 * Runs every 5 minutes (see netlify.toml).
 */
export const handler: Handler = async (_event: HandlerEvent, _ctx: HandlerContext) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return { statusCode: 500, body: "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY" };
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const query = `in:inbox newer_than:${LOOKBACK_MINUTES}m`;
  let messages: { id: string; threadId: string }[] = [];
  try {
    messages = await listRecentInboxMessages(query, 25);
  } catch (e: any) {
    return { statusCode: 500, body: "Gmail list failed: " + (e?.message || String(e)) };
  }

  const results: any[] = [];
  for (const m of messages) {
    try {
      const { data: existing } = await supabase
        .from("inbox_messages")
        .select("id")
        .eq("gmail_id", m.id)
        .maybeSingle();
      if (existing) {
        results.push({ id: m.id, status: "already_ingested" });
        continue;
      }

      const detail = await getMessageDetail(m.id);

      const { data: inboxRow, error: insertErr } = await supabase
        .from("inbox_messages")
        .insert({
          gmail_id: detail.id,
          gmail_thread_id: detail.threadId,
          sender_email: detail.fromEmail,
          sender_name: detail.fromName,
          subject: detail.subject,
          snippet: detail.snippet,
          has_attachments: detail.attachmentNames.length > 0,
          attachment_names: detail.attachmentNames,
          received_at: detail.receivedAt,
        })
        .select()
        .single();
      if (insertErr || !inboxRow) {
        results.push({ id: m.id, status: "inbox_insert_error", error: insertErr?.message });
        continue;
      }

      const classification = classifyIntake(detail);
      await supabase
        .from("inbox_messages")
        .update({ classification: classification.kind, processed_at: new Date().toISOString(), processed_by_agent: "inbox-scanner" })
        .eq("id", inboxRow.id);

      if (classification.kind === "new_project_intake") {
        const { data: project, error: projErr } = await supabase
          .from("projects")
          .insert({
            name: classification.projectName || detail.subject || "Untitled Intake",
            slug: classification.projectSlug || `intake-${detail.id}`,
            status: "intake",
            notes: classification.notes || null,
            bid_due_at: classification.bidDueAt || null,
            gc_fee_pct: classification.gcFeePct ?? null,
          })
          .select()
          .single();
        if (projErr || !project) {
          results.push({ id: m.id, status: "project_insert_error", error: projErr?.message });
          continue;
        }

        await supabase
          .from("inbox_messages")
          .update({ project_id: project.id })
          .eq("id", inboxRow.id);

        const { error: jobErr } = await supabase.from("jobs").insert({
          project_id: project.id,
          agent_role: "administrator",
          type: "project_intake",
          status: "queued",
          title: `Intake: ${project.name}`,
          payload: {
            inbox_message_id: inboxRow.id,
            gmail_id: detail.id,
            gmail_thread_id: detail.threadId,
            sender_email: detail.fromEmail,
          },
          priority: 2,
        });
        if (jobErr) {
          results.push({ id: m.id, status: "job_insert_error", error: jobErr.message });
          continue;
        }

        results.push({ id: m.id, status: "project_created", project_id: project.id });
      } else {
        results.push({ id: m.id, status: "logged", classification: classification.kind });
      }
    } catch (e: any) {
      results.push({ id: m.id, status: "error", error: e?.message || String(e) });
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ scanned: messages.length, results }, null, 2),
  };
};

export const config = { schedule: "*/5 * * * *" };
