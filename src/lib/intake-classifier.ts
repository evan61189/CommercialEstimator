import type { GmailMessageDetail } from "./gmail";

export type IntakeClassification =
  | { kind: "new_project_intake"; projectName?: string; projectSlug?: string; notes?: string; bidDueAt?: string; gcFeePct?: number }
  | { kind: "sub_bid_response" }
  | { kind: "briefing" }
  | { kind: "director_report" }
  | { kind: "noise" }
  | { kind: "unknown" };

const TRUSTED_INTERNAL_DOMAINS = ["clipper.construction"];

function isFromInternal(email: string): boolean {
  const domain = (email.split("@")[1] || "").toLowerCase();
  return TRUSTED_INTERNAL_DOMAINS.includes(domain);
}

function slugify(s: string, id: string): string {
  const base = s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  return `${base || "intake"}-${id.slice(-6)}`;
}

/**
 * Classifies an incoming Gmail message using lightweight heuristics.
 * The Director can later upgrade this with an LLM pass if needed.
 */
export function classifyIntake(d: GmailMessageDetail): IntakeClassification {
  const subj = (d.subject || "").toLowerCase();

  // Self-generated system emails — log only
  if (subj.includes("daily briefing")) return { kind: "briefing" };
  if (subj.includes("director run summary") || subj.includes("bids processed") || subj.includes("drafts awaiting review")) {
    return { kind: "director_report" };
  }

  // Sub bid response pattern (e.g. "Est_09187_from_DelPrete_Masonry...")
  if (/\best_?\d+_from_/i.test(d.subject || "")) {
    return { kind: "sub_bid_response" };
  }

  // New project intake: internal sender + drawings/bid number signal
  if (isFromInternal(d.fromEmail)) {
    const hasDrawingAttachment = d.attachmentNames.some((n) => /\.(pdf|dwg|rvt|zip)$/i.test(n));
    const hasBidNumber = /\b[bB]\d{6,}|\best_?\d+/i.test(d.subject || "");
    if (hasDrawingAttachment || hasBidNumber) {
      return {
        kind: "new_project_intake",
        projectName: d.subject || "Untitled Intake",
        projectSlug: slugify(d.subject || "intake", d.id),
        notes: d.snippet || undefined,
      };
    }
  }

  return { kind: "unknown" };
}
