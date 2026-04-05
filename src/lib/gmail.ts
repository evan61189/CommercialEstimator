/**
 * Thin Gmail REST API wrapper used by the inbox scanner.
 * Uses an OAuth refresh token stored in env vars.
 *
 * Required env vars:
 *   GMAIL_CLIENT_ID
 *   GMAIL_CLIENT_SECRET
 *   GMAIL_REFRESH_TOKEN
 *   GMAIL_USER (defaults to "me")
 */
const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID || "";
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || "";
const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN || "";
const GMAIL_USER = process.env.GMAIL_USER || "me";

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 30_000) {
    return cachedAccessToken.token;
  }
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
    throw new Error("Missing GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GMAIL_CLIENT_ID,
      client_secret: GMAIL_CLIENT_SECRET,
      refresh_token: GMAIL_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error("Gmail token refresh failed: " + res.status + " " + (await res.text()));
  }
  const j: any = await res.json();
  cachedAccessToken = { token: j.access_token, expiresAt: Date.now() + (j.expires_in || 3600) * 1000 };
  return j.access_token;
}

async function gmailApi(path: string): Promise<any> {
  const token = await getAccessToken();
  const url = `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(GMAIL_USER)}${path}`;
  const res = await fetch(url, { headers: { Authorization: "Bearer " + token } });
  if (!res.ok) {
    throw new Error("Gmail API " + path + " failed: " + res.status + " " + (await res.text()));
  }
  return res.json();
}

export interface GmailMessageRef {
  id: string;
  threadId: string;
}

export async function listRecentInboxMessages(query: string, max = 25): Promise<GmailMessageRef[]> {
  const j = await gmailApi(`/messages?q=${encodeURIComponent(query)}&maxResults=${max}`);
  return (j.messages || []) as GmailMessageRef[];
}

export interface GmailMessageDetail {
  id: string;
  threadId: string;
  subject: string;
  fromEmail: string;
  fromName: string;
  snippet: string;
  receivedAt: string;
  attachmentNames: string[];
  bodyText: string;
}

function headerValue(headers: any[], name: string): string {
  const h = (headers || []).find((x) => (x.name || "").toLowerCase() === name.toLowerCase());
  return h?.value || "";
}

function parseFrom(value: string): { email: string; name: string } {
  const m = value.match(/^(?:"?([^"<]+?)"?\s*)?<?([^<>\s]+@[^<>\s]+)>?$/);
  if (!m) return { email: value, name: "" };
  return { email: m[2], name: (m[1] || "").trim() };
}

function collectAttachmentNames(part: any, out: string[]): void {
  if (!part) return;
  if (part.filename) out.push(part.filename);
  if (part.parts) for (const p of part.parts) collectAttachmentNames(p, out);
}

function collectBodyText(part: any): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) {
    try {
      return Buffer.from(part.body.data, "base64url").toString("utf-8");
    } catch {
      return "";
    }
  }
  if (part.parts) {
    for (const p of part.parts) {
      const t = collectBodyText(p);
      if (t) return t;
    }
  }
  return "";
}

export async function getMessageDetail(id: string): Promise<GmailMessageDetail> {
  const j = await gmailApi(`/messages/${id}?format=full`);
  const headers = j.payload?.headers || [];
  const from = parseFrom(headerValue(headers, "From"));
  const attachmentNames: string[] = [];
  collectAttachmentNames(j.payload, attachmentNames);
  return {
    id: j.id,
    threadId: j.threadId,
    subject: headerValue(headers, "Subject"),
    fromEmail: from.email,
    fromName: from.name,
    snippet: j.snippet || "",
    receivedAt: new Date(Number(j.internalDate || Date.now())).toISOString(),
    attachmentNames,
    bodyText: collectBodyText(j.payload),
  };
}
