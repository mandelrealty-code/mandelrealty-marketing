import { toE164 } from "../followUpSequences.js";
import { sendTwilioSms } from "../twilioSms.js";
import { addTextLog, listSkills, listTextLog, listTextNumbers } from "./store.js";
import type { CopilotSkill } from "./types.js";

export function formatPhone(phone: string): string {
  const e164 = toE164(phone) ?? phone.trim();
  const digits = e164.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return e164;
}

export function twilioReady(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      process.env.TWILIO_PHONE_NUMBER?.trim(),
  );
}

export function twilioFromLabel(): string {
  const raw = process.env.TWILIO_PHONE_NUMBER?.trim() ?? "";
  return raw ? formatPhone(raw) : "";
}

export function cleanerWebhookReady(): boolean {
  return Boolean(process.env.OPS_HUB_WEBHOOK_SECRET?.trim() || process.env.CLEANER_HUB_SYNC_KEY?.trim());
}

function issuePhrase(body: Record<string, unknown>): string | null {
  const count = body.issue_count ?? body.issues_count ?? body.issueCount;
  if (typeof count === "number" && Number.isFinite(count)) {
    if (count <= 0) return "no issues";
    return count === 1 ? "1 issue" : `${count} issues`;
  }
  if (Array.isArray(body.issues)) {
    if (body.issues.length === 0) return "no issues";
    return body.issues.length === 1 ? "1 issue" : `${body.issues.length} issues`;
  }
  if (body.has_issues === false) return "no issues";
  if (body.has_issues === true) return "issues were reported";
  return null;
}

function reportLink(body: Record<string, unknown>): string {
  const link = body.report_url ?? body.reportUrl ?? body.report_link ?? body.reportLink;
  return typeof link === "string" ? link.trim() : "";
}

export function fillCleanText(template: string, unit: string, body: Record<string, unknown>): { text: string; link: string } {
  const issues = issuePhrase(body);
  const link = reportLink(body);
  const issueBit = issues ?? "the cleaner app did not say whether there were issues";
  let text = template
    .replaceAll("{unit}", unit || "the unit")
    .replaceAll("{no issues, or how many issues}", issueBit);
  if (link) {
    if (!text.includes(link)) text = `${text} ${link}`;
  } else {
    text = text.replace(/Here['’]s the link to the report\.?/i, "The cleaner app did not send a report link.");
  }
  return { text: text.trim(), link };
}

function isCleanTextSkill(skill: CopilotSkill): boolean {
  if (skill.kind !== "text" || !skill.enabled || !toE164(skill.phone)) return false;
  return /\bclean/i.test(`${skill.name} ${skill.when_text} ${skill.reads} ${skill.drafts}`);
}

export async function notifyCleanDone(input: {
  unit: string;
  body: Record<string, unknown>;
}): Promise<{ sent: number; error?: string }> {
  const skills = (await listSkills().catch(() => [])).filter(isCleanTextSkill);
  if (!skills.length) return { sent: 0 };
  if (!twilioReady()) {
    return { sent: 0, error: "Twilio is not connected, so the clean was not texted." };
  }
  const allow = await listTextNumbers().catch(() => []);
  const allowed = new Set(allow.map((phone) => toE164(phone)).filter((phone): phone is string => Boolean(phone)));
  const recent = await listTextLog().catch(() => []);
  const cutoff = Date.now() - 10 * 60 * 1000;
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim() ?? "";
  const token = process.env.TWILIO_AUTH_TOKEN?.trim() ?? "";
  const from = toE164(process.env.TWILIO_PHONE_NUMBER ?? "") ?? process.env.TWILIO_PHONE_NUMBER?.trim() ?? "";
  let sent = 0;
  let error: string | undefined;
  for (const skill of skills) {
    const to = toE164(skill.phone);
    if (!to) continue;
    if (allowed.size > 0 && !allowed.has(to)) continue;
    if (recent.some((row) => row.skill_id === skill.id && row.unit === input.unit && Date.parse(row.created_at) > cutoff)) {
      continue;
    }
    const filled = fillCleanText(skill.drafts, input.unit, input.body);
    const result = await sendTwilioSms({ accountSid: sid, authToken: token, from, to, body: filled.text });
    if (!result.ok) {
      error = result.error || "Twilio did not send the text.";
      continue;
    }
    sent += 1;
    await addTextLog({ skill_id: skill.id, unit: input.unit, body: filled.text, link: filled.link }).catch(() => undefined);
  }
  return error && sent === 0 ? { sent, error } : { sent };
}
