import { LEAD_INBOX, sendResendEmail } from "./auditEmails.js";
import { publicSiteOrigin } from "./ownerEmails.js";
import { getSupabaseAdmin } from "./supabase.js";

export type RevenueAuditUnlockMethod =
  | "preview"
  | "paid_2499"
  | "paid_1999"
  | "code"
  | "call";

export type RevenueAuditReportPayload = {
  path?: string;
  revenue?: number;
  unlocked?: boolean;
  unlockNote?: string;
  vals?: Record<string, string>;
  [key: string]: unknown;
};

export type RevenueAuditReportRow = {
  id: string;
  email: string;
  name: string;
  phone: string;
  unlocked: boolean;
  unlock_method: RevenueAuditUnlockMethod;
  unlock_note: string;
  payload: RevenueAuditReportPayload;
  created_at: string;
  updated_at: string;
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function emailFrom(): string {
  return (
    process.env.RESEND_FROM?.trim() ||
    "Mandel Realty Group <info@mandelrealtygroup.com>"
  );
}

function replyTo(): string {
  return process.env.RESEND_REPLY_TO?.trim() || LEAD_INBOX;
}

export function revenueAuditReportUrl(token: string): string {
  const origin = publicSiteOrigin().replace(/\/$/, "");
  return `${origin}/revenueaudit/?r=${encodeURIComponent(token)}`;
}

function methodLabel(method: RevenueAuditUnlockMethod): string {
  switch (method) {
    case "paid_2499":
      return "Paid unlock · $24.99";
    case "paid_1999":
      return "Paid unlock · $19.99";
    case "code":
      return "Unlocked with access code";
    case "call":
      return "Unlocked via free 15-min call";
    default:
      return "Free preview";
  }
}

export async function saveRevenueAuditReport(input: {
  email: string;
  name?: string;
  phone?: string;
  unlocked: boolean;
  unlockMethod: RevenueAuditUnlockMethod;
  unlockNote?: string;
  payload: RevenueAuditReportPayload;
  /** If set, update this report instead of inserting a new one */
  reportId?: string;
}): Promise<{ id: string } | { error: string }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { error: "Report storage is not configured." };

  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) return { error: "A valid email is required." };

  const name = (input.name || "").trim() || "Host";
  const phone = (input.phone || "").trim() || "—";
  const row = {
    email,
    name,
    phone,
    unlocked: input.unlocked,
    unlock_method: input.unlockMethod,
    unlock_note: (input.unlockNote || "").trim(),
    payload: input.payload ?? {},
    updated_at: new Date().toISOString(),
  };

  if (input.reportId?.trim()) {
    const { data, error } = await sb
      .from("revenue_audit_reports")
      .update(row)
      .eq("id", input.reportId.trim())
      .select("id")
      .single();
    if (error || !data?.id) {
      console.error("[revenue-audit] update", error?.message);
      return { error: "Could not update your report." };
    }
    return { id: data.id as string };
  }

  const { data, error } = await sb
    .from("revenue_audit_reports")
    .insert(row)
    .select("id")
    .single();
  if (error || !data?.id) {
    console.error("[revenue-audit] insert", error?.message);
    return { error: "Could not save your report." };
  }
  return { id: data.id as string };
}

export async function loadRevenueAuditReport(
  token: string,
): Promise<RevenueAuditReportRow | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const id = token.trim();
  if (!id) return null;
  const { data, error } = await sb
    .from("revenue_audit_reports")
    .select(
      "id, email, name, phone, unlocked, unlock_method, unlock_note, payload, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("[revenue-audit] load", error.message);
    return null;
  }
  return data as RevenueAuditReportRow;
}

export async function emailRevenueAuditReportLink(input: {
  to: string;
  name: string;
  reportId: string;
  unlocked: boolean;
  unlockMethod: RevenueAuditUnlockMethod;
}): Promise<{ ok: boolean; message?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim() || "";
  if (!apiKey) return { ok: false, message: "RESEND_API_KEY not configured." };

  const link = revenueAuditReportUrl(input.reportId);
  const first = input.name.trim().split(/\s+/)[0] || "there";
  const paid = input.unlocked && input.unlockMethod.startsWith("paid");
  const subject = paid
    ? "Your full Mandel Realty Revenue Audit is ready"
    : input.unlocked
      ? "Your Mandel Realty Revenue Audit is unlocked"
      : "Your Mandel Realty free revenue preview";

  const headline = paid
    ? "Your full audit is ready"
    : input.unlocked
      ? "Your audit is unlocked"
      : "Your free revenue preview";

  const body = paid
    ? "Thanks for unlocking the full audit. Open your private link anytime — it has your comps, plan, and every locked section."
    : input.unlocked
      ? "Your Revenue Audit is unlocked. Bookmark the link below so you can come back to it on any device."
      : "We saved your free Revenue Audit preview. Open the link below anytime — and unlock the full plan when you’re ready.";

  const html = `
  <div style="background:#f7f7f7;padding:28px 16px;font-family:Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #ebebeb;">
      <tr><td style="padding:28px 28px 8px;">
        <div style="font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#717171;margin-bottom:10px;">Mandel Realty Group · Revenue Audit</div>
        <div style="font-size:26px;font-weight:800;letter-spacing:-0.03em;color:#222222;line-height:1.2;">${esc(headline)}</div>
        <p style="font-size:15px;line-height:1.6;color:#5e5e5e;margin:14px 0 0;">Hi ${esc(first)},</p>
        <p style="font-size:15px;line-height:1.6;color:#5e5e5e;margin:10px 0 0;">${esc(body)}</p>
        <p style="font-size:13px;line-height:1.5;color:#8a8a8a;margin:14px 0 0;">${esc(methodLabel(input.unlockMethod))}</p>
      </td></tr>
      <tr><td style="padding:8px 28px 28px;">
        <a href="${esc(link)}" style="display:inline-block;background:#ff385c;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;border-radius:12px;padding:14px 22px;">Open my report</a>
        <p style="font-size:12.5px;line-height:1.55;color:#8a8a8a;margin:18px 0 0;word-break:break-all;">Or paste this link:<br/><a href="${esc(link)}" style="color:#ff385c;">${esc(link)}</a></p>
        <p style="font-size:12.5px;line-height:1.55;color:#8a8a8a;margin:16px 0 0;">Questions? Reply to this email or call (647) 381-7325.</p>
      </td></tr>
    </table>
  </div>`;

  const text = [
    `${headline}`,
    "",
    `Hi ${first},`,
    "",
    body,
    "",
    methodLabel(input.unlockMethod),
    "",
    `Open your report: ${link}`,
    "",
    "Questions? Reply to this email or call (647) 381-7325.",
    "— Mandel Realty Group",
  ].join("\n");

  return sendResendEmail({
    apiKey,
    from: emailFrom(),
    to: [input.to],
    subject,
    html,
    text,
    replyTo: replyTo(),
  });
}

export async function notifyInboxRevenueAudit(input: {
  name: string;
  email: string;
  phone: string;
  reportId: string;
  unlocked: boolean;
  unlockMethod: RevenueAuditUnlockMethod;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim() || "";
  if (!apiKey) return;
  const link = revenueAuditReportUrl(input.reportId);
  const html = `
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.55;color:#222;">
    <p><strong>New Revenue Audit ${input.unlocked ? "unlock" : "preview"}</strong></p>
    <p>${esc(input.name)} · ${esc(input.email)} · ${esc(input.phone)}</p>
    <p>${esc(methodLabel(input.unlockMethod))}</p>
    <p><a href="${esc(link)}">${esc(link)}</a></p>
  </div>`;
  await sendResendEmail({
    apiKey,
    from: emailFrom(),
    to: [LEAD_INBOX],
    subject: `Revenue Audit · ${input.unlocked ? "Unlocked" : "Preview"} · ${input.name || input.email}`,
    html,
    replyTo: input.email,
  });
}

/** Persist report, email the host a unique link, notify inbox. Does not create CRM leads. */
export async function persistAndEmailRevenueAudit(input: {
  email: string;
  name?: string;
  phone?: string;
  unlocked: boolean;
  unlockMethod: RevenueAuditUnlockMethod;
  unlockNote?: string;
  payload: RevenueAuditReportPayload;
  reportId?: string;
  address?: string;
  earnings?: string;
  listingUrl?: string;
  hasListing?: "yes" | "no" | "unknown";
}): Promise<{ id: string; emailed: boolean; error?: string }> {
  const saved = await saveRevenueAuditReport(input);
  if ("error" in saved) return { id: "", emailed: false, error: saved.error };

  const name = (input.name || "").trim() || "Host";
  const phone = (input.phone || "").trim() || "—";
  const email = input.email.trim().toLowerCase();

  const mailed = await emailRevenueAuditReportLink({
    to: email,
    name,
    reportId: saved.id,
    unlocked: input.unlocked,
    unlockMethod: input.unlockMethod,
  });

  try {
    await notifyInboxRevenueAudit({
      name,
      email,
      phone,
      reportId: saved.id,
      unlocked: input.unlocked,
      unlockMethod: input.unlockMethod,
    });
  } catch (err) {
    console.error("[revenue-audit] inbox notify", err);
  }

  return {
    id: saved.id,
    emailed: mailed.ok,
    error: mailed.ok ? undefined : mailed.message,
  };
}
