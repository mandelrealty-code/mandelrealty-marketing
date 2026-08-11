/**
 * Stage-aware nurture SMS — no free-form AI at send time.
 * Bodies are fixed templates; for now always push a call (guide landing not ready).
 */
import { BOOK_A_CALL_URL } from "./auditEmails.js";
import { matchKnowledgeChunks } from "./knowledgeStore.js";
import type { LeadRow } from "./leadStore.js";
import { updateLeadCrm } from "./leadStore.js";
import { getSupabaseAdmin } from "./supabase.js";

const URL_RE = /https?:\/\/[^\s<>"'\)\]]+/gi;
/** ~30 days — soft check-in after they said not ready */
export const EDUCATION_NURTURE_DELAY_MINUTES = 60 * 24 * 30;
export const EDUCATION_NURTURE_STEP = 2;

function firstName(fullName: string): string {
  const part = fullName.trim().split(/\s+/)[0];
  return part || "there";
}

function cleanUrl(raw: string): string {
  return raw.replace(/[.,;:!?)\]]+$/g, "");
}

function urlsFromText(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(URL_RE)) {
    out.push(cleanUrl(m[0]));
  }
  return out;
}

/** Prefer a paid/advanced guide URL; never invent one. */
export async function findPaidGuideUrlFromKb(): Promise<string | null> {
  const chunks = await matchKnowledgeChunks(
    "paid advanced Airbnb guide download link URL price",
    10,
  );
  const scored: { url: string; score: number }[] = [];
  for (const c of chunks) {
    const lower = c.content.toLowerCase();
    const urls = urlsFromText(c.content);
    for (const url of urls) {
      let score = 1;
      if (/paid|advanced|premium|purchase|buy/i.test(lower)) score += 3;
      if (/guide/i.test(lower)) score += 2;
      if (/intro|free/i.test(lower) && !/paid|advanced/i.test(lower)) score -= 2;
      scored.push({ url, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.url ?? null;
}

/**
 * Pre-approved copy only. Always push a call — guide landing pages are not ready.
 */
export function buildEducationNurtureSms(input: {
  name: string;
  paidGuideUrl: string | null;
}): string {
  const name = firstName(input.name);
  void input.paidGuideUrl; // reserved for when guide landing is live
  return (
    `Hey ${name}, checking in from Mandel Realty Group, still happy to help when you're ready. ` +
    `Easiest next step is a free 15-min intro call with our team: ${BOOK_A_CALL_URL} ` +
    `If you have any questions before booking, just message us here.\n` +
    `Reply STOP to opt out.`
  );
}

/**
 * Schedule the education nurture bump once the lead is in nurturing.
 * Body is locked at schedule time from templates + KB URL only.
 */
export async function scheduleEducationNurtureFollowup(
  lead: LeadRow,
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  if (lead.status !== "nurturing") {
    return { ok: true, skipped: true };
  }
  if (lead.offer_path !== "education" && lead.offer_path !== "unknown") {
    return { ok: true, skipped: true };
  }

  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, error: "Supabase not configured" };

  const { data: existing } = await sb
    .from("lead_followups")
    .select("id, status")
    .eq("lead_id", lead.id)
    .eq("sequence", "nurture_sms")
    .eq("step", EDUCATION_NURTURE_STEP)
    .maybeSingle();

  if (existing && ["pending", "sent"].includes(String(existing.status))) {
    return { ok: true, skipped: true };
  }

  const paidGuideUrl = await findPaidGuideUrlFromKb();
  const body = buildEducationNurtureSms({ name: lead.name, paidGuideUrl });
  const sendAt = new Date(
    Date.now() + EDUCATION_NURTURE_DELAY_MINUTES * 60_000,
  ).toISOString();

  const { error } = await sb.from("lead_followups").upsert(
    {
      lead_id: lead.id,
      sequence: "nurture_sms",
      step: EDUCATION_NURTURE_STEP,
      channel: "sms",
      body,
      send_at: sendAt,
      status: "pending",
      sent_at: null,
      error: null,
      provider_sid: null,
    },
    { onConflict: "lead_id,sequence,step", ignoreDuplicates: false },
  );

  if (error) {
    console.error("[nurture] schedule failed", error.message);
    return { ok: false, error: error.message };
  }

  const note = paidGuideUrl
    ? `Nurture scheduled (~30d): check-in + paid guide link from KB`
    : `Nurture scheduled (~30d): soft check-in (no paid-guide URL in KB yet)`;
  const prev = (lead.whats_next || "").trim();
  await updateLeadCrm(lead.id, {
    whatsNext: prev.includes("Nurture scheduled")
      ? prev
      : [note, prev].filter(Boolean).join(" · ").slice(0, 900),
  });

  return { ok: true };
}
