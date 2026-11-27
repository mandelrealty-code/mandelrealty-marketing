/**
 * Client review + Go-live check for an onboarding unit (Sprint 7B Phase 2).
 *
 * The owner report lives in the CLEANER Supabase (hyndmdjvjlsbthlqrxge): owner_reports / owner_report_items, schema in
 * property-cleaner-hub/supabase/owner_report_v1.sql + owner_report_v2_admin.sql. This server reads it and writes only
 * two things back, with the service key (never sent to the browser):
 *   - "Send to client": owner_reports.sent_at / sent_by
 *   - "Waive" on a declined Essential: owner_report_items.status = 'waived' + reason / time / who
 * Go-live ticks and the "Ready to list" sign-off are stored in the ADMIN Supabase (supabase/onboarding_golive_v1.sql).
 * Nothing is ever sent to the client from here; Ryan or Shane copy the link and send it themselves.
 */

import { getSupabaseAdmin } from "../supabase.js";
import { getUnitIntakeLink } from "./intakeProgress.js";
import {
  allPartsOk,
  BE_KEYS,
  isPartAKey,

  RESPONDED,
  type GoLiveTick,
  type ReviewDecision,
  type ReviewItem,
  type ReviewReport,
} from "./goLiveParts.js";

const CLEANER_REST =
  (process.env.CLEANER_HUB_SUPABASE_URL || "").trim().replace(/\/$/, "") || "https://hyndmdjvjlsbthlqrxge.supabase.co";
const OWNER_SITE = "https://portal.stravo.ai";

const V1_SQL = "Run property-cleaner-hub/supabase/owner_report_v1.sql in the cleaner Supabase first.";
const V2_SQL = "Run property-cleaner-hub/supabase/owner_report_v2_admin.sql in the cleaner Supabase first.";
const V3_SQL = "Run property-cleaner-hub/supabase/owner_report_v3.sql in the cleaner Supabase first.";
const GOLIVE_SQL = "Run supabase/onboarding_golive_v1.sql in the admin Supabase first.";

function cleanerKey(): string {
  const key = (process.env.CLEANER_SUPABASE_SERVICE_KEY || process.env.CLEANER_HUB_SERVICE_ROLE_KEY || "").trim();
  if (!key) throw new Error("CLEANER_SUPABASE_SERVICE_KEY is not set.");
  return key;
}

/** Turns PostgREST "missing table / column" errors into the SQL file to run. */
function explain(status: number, text: string, columnSql = V2_SQL): Error {
  if (/owner_report/i.test(text) && /(relation|table).*(does not exist|could not find)|PGRST205|42P01/i.test(text)) return new Error(V1_SQL);
  if (/column|PGRST204|42703/i.test(text) && /reopen|spending_cap/i.test(text)) return new Error(V3_SQL);
  if (/column|PGRST204|42703/i.test(text) && /sent_at|sent_by|waived|status/i.test(text)) return new Error(columnSql);
  return new Error(`Cleaner REST ${status}: ${text.slice(0, 200)}`);
}

async function cleaner<T>(path: string, init?: { method: "PATCH"; body: Record<string, unknown> }): Promise<T> {
  const key = cleanerKey();
  const res = await fetch(`${CLEANER_REST}/rest/v1/${path}`, {
    method: init?.method ?? "GET",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init ? { Prefer: "return=representation" } : {}),
    },
    body: init ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) throw explain(res.status, await res.text().catch(() => res.statusText));
  return (await res.json()) as T;
}

function admin() {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  return sb;
}

const s = (v: unknown) => (v == null || v === "" ? null : String(v));
const n = (v: unknown) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

function toReport(r: Record<string, unknown>): ReviewReport {
  const submittedAt = s(r.submitted_at);
  const rawSent = s(r.sent_at);
  /* A resubmitted checklist replaces the report, so an older send no longer counts. */
  const sent = rawSent && (!submittedAt || Date.parse(rawSent) >= Date.parse(submittedAt)) ? rawSent : null;
  return {
    id: String(r.id),
    status: String(r.status || "pending_client"),
    submittedAt,
    submittedBy: s(r.submitted_by),
    sentAt: sent,
    sentBy: sent ? s(r.sent_by) : null,
    viewedAt: s(r.client_viewed_at),
    respondedAt: s(r.client_responded_at),
    ccAuthorized: r.cc_authorized === true,
    ccHolderName: s(r.cc_holder_name),
    ccLast4: s(r.cc_last4),
    ccAuthorizedAt: s(r.cc_authorized_at),
    ccSpendingCap: n(r.cc_spending_cap),
    totalToPurchase: n(r.total_to_purchase) ?? 0,
    url: s(r.report_url) || `${OWNER_SITE}/report/${String(r.id)}`,
  };
}

function toItem(r: Record<string, unknown>): ReviewItem {
  const d = s(r.client_decision);
  return {
    id: String(r.id),
    itemId: String(r.item_id || ""),
    name: String(r.item_name || r.item_id || "Item"),
    sectionName: String(r.section_name || r.section_id || "Other"),
    reason: String(r.reason || "missing"),
    shortBy: n(r.short_by),
    isEssential: r.is_essential === true,
    isOptional: r.is_optional === true,
    suggestedProduct: s(r.suggested_product),
    suggestedPrice: n(r.suggested_price),
    qty: Math.max(1, n(r.suggested_qty) ?? 1),
    decision: (["buy", "supply", "already_there", "declined"].includes(d || "") ? d : null) as ReviewDecision,
    note: s(r.client_decision_note),
    supplyBy: s(r.client_supply_by_date),
    location: s(r.client_already_there_location),
    waived: r.status === "waived",
    waivedReason: s(r.waived_reason),
    waivedAt: s(r.waived_at),
    waivedBy: s(r.waived_by),
    reopened: !!r.reopened_at,
    reopenPending: !!r.reopened_at && !r.reopen_answered_at,
  };
}

export type LaundryAnswer = { washer: "yes" | "no" | null; dryer: "yes" | "no" | null; at: string | null };

export type ClientReviewPayload = {
  linked: boolean;
  address: string;
  report: ReviewReport | null;
  items: ReviewItem[];
  laundry: LaundryAnswer | null;
  /** The SQL that still needs running, when a table or column is missing. */
  setupError: string | null;
};

export type GoLivePayload = {
  ticks: Record<string, GoLiveTick>;
  signoff: { by: string; at: string } | null;
  setupError: string | null;
};

async function loadLaundry(propertyId: string): Promise<LaundryAnswer | null> {
  try {
    const rows = await cleaner<{ item_id: string; answer_value: unknown; answered_at: string | null; status: string }[]>(
      `onboarding_item_answers?property_id=eq.${encodeURIComponent(propertyId)}&item_id=in.(washer,dryer)&select=item_id,answer_value,answered_at,status`,
    );
    if (!rows.length) return null;
    const val = (id: string) => {
      const v = String(rows.find((r) => r.item_id === id)?.answer_value ?? "").toLowerCase();
      return v === "yes" ? "yes" : v === "no" ? "no" : null;
    };
    const at = rows.map((r) => r.answered_at).filter(Boolean).sort().pop() ?? null;
    return { washer: val("washer"), dryer: val("dryer"), at };
  } catch {
    return null;
  }
}

async function reportFor(propertyId: string): Promise<{ report: ReviewReport | null; raw: Record<string, unknown> | null }> {
  const rows = await cleaner<Record<string, unknown>[]>(
    `owner_reports?property_id=eq.${encodeURIComponent(propertyId)}&select=*&limit=1`,
  );
  return rows[0] ? { report: toReport(rows[0]), raw: rows[0] } : { report: null, raw: null };
}

export async function getClientReview(unitId: string): Promise<ClientReviewPayload> {
  const link = await getUnitIntakeLink(unitId);
  const out: ClientReviewPayload = { linked: !!link.cleanerPropertyId, address: link.address, report: null, items: [], laundry: null, setupError: null };
  if (!out.linked) return out;
  try {
    const { report } = await reportFor(link.cleanerPropertyId);
    out.report = report;
    if (report) {
      const rows = await cleaner<Record<string, unknown>[]>(
        `owner_report_items?report_id=eq.${report.id}&select=*&order=is_optional.asc,sort_order.asc,item_name.asc`,
      );
      out.items = rows.map(toItem);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === V1_SQL || msg === V2_SQL || msg === V3_SQL) out.setupError = msg;
    else throw e;
  }
  out.laundry = await loadLaundry(link.cleanerPropertyId);
  return out;
}

export async function getGoLive(unitId: string): Promise<GoLivePayload> {
  const sb = admin();
  const out: GoLivePayload = { ticks: {}, signoff: null, setupError: null };
  const t = await sb.from("onboarding_golive_ticks").select("item_key, state, ticked_by, ticked_at").eq("unit_id", unitId);
  if (t.error) {
    if (/onboarding_golive|does not exist|schema cache/i.test(t.error.message || "")) return { ...out, setupError: GOLIVE_SQL };
    throw t.error;
  }
  for (const r of (t.data ?? []) as { item_key: string; state: GoLiveTick["state"]; ticked_by: string; ticked_at: string }[]) {
    out.ticks[r.item_key] = { state: r.state, by: r.ticked_by, at: r.ticked_at };
  }
  const so = await sb.from("onboarding_golive_signoffs").select("signed_by, signed_at").eq("unit_id", unitId).maybeSingle();
  if (so.error) {
    if (/onboarding_golive|does not exist|schema cache/i.test(so.error.message || "")) return { ...out, setupError: GOLIVE_SQL };
    throw so.error;
  }
  if (so.data) out.signoff = { by: String(so.data.signed_by), at: String(so.data.signed_at) };
  return out;
}

/** "Send to client": records the send. Nothing is emailed; the admin copies the link and sends it themselves. */
export async function markReviewSent(unitId: string, by: string): Promise<{ sentAt: string; url: string }> {
  const link = await getUnitIntakeLink(unitId);
  if (!link.cleanerPropertyId) throw new Error("Link this unit to Stravo first.");
  const { report } = await reportFor(link.cleanerPropertyId);
  if (!report) throw new Error("No owner report yet. The onboarder submits it from the checklist wrap-up.");
  if (RESPONDED.includes(report.status)) {
    /* After the client responded, Send is only for lines added back ("Couldn't find it"). */
    const pending = await cleaner<unknown[]>(
      `owner_report_items?report_id=eq.${report.id}&reopened_at=not.is.null&reopen_answered_at=is.null&select=id`,
    );
    if (!pending.length) throw new Error("The client has already responded.");
  }
  const now = new Date().toISOString();
  await cleaner(`owner_reports?id=eq.${report.id}`, { method: "PATCH", body: { sent_at: now, sent_by: by || "Admin" } });
  return { sentAt: now, url: report.url };
}

/** Waive a declined Essential. Reason required. Allowed after authorization too (the only change after it). */
export async function waiveReviewItem(unitId: string, itemRowId: string, reason: string, by: string): Promise<void> {
  const why = reason.trim();
  if (!why) throw new Error("A reason is required to waive.");
  if (!/^[0-9a-f-]{36}$/i.test(itemRowId)) throw new Error("Unknown item.");
  const link = await getUnitIntakeLink(unitId);
  if (!link.cleanerPropertyId) throw new Error("Link this unit to Stravo first.");
  const { report } = await reportFor(link.cleanerPropertyId);
  if (!report) throw new Error("No owner report yet.");
  const rows = await cleaner<unknown[]>(
    `owner_report_items?id=eq.${itemRowId}&report_id=eq.${report.id}&is_essential=is.true&client_decision=eq.declined`,
    { method: "PATCH", body: { status: "waived", waived_reason: why.slice(0, 500), waived_at: new Date().toISOString(), waived_by: by || "Admin" } },
  );
  if (!rows.length) throw new Error("Only a declined Essential can be waived.");
}

/**
 * "Couldn't find it" on a Part A "already there" line: reopen that one line for the client ("We couldn't find it.
 * Buy it?") and clear sent_at, so the client only sees it after admin presses Send again. Undo (the line was found
 * after all) puts it back to "already there" while the client hasn't answered it yet.
 */
async function setReopen(unitId: string, itemRowId: string, reopen: boolean): Promise<void> {
  const link = await getUnitIntakeLink(unitId);
  if (!link.cleanerPropertyId) return;
  const { report } = await reportFor(link.cleanerPropertyId);
  if (!report) return;
  if (reopen) {
    const rows = await cleaner<unknown[]>(
      `owner_report_items?id=eq.${itemRowId}&report_id=eq.${report.id}&reopen_answered_at=is.null&or=(client_decision.eq.already_there,reopened_at.not.is.null)`,
      { method: "PATCH", body: { reopened_at: new Date().toISOString(), reopen_reason: "not_found", client_decision: null } },
    );
    if (rows.length) await cleaner(`owner_reports?id=eq.${report.id}`, { method: "PATCH", body: { sent_at: null, sent_by: null } });
  } else {
    await cleaner(`owner_report_items?id=eq.${itemRowId}&report_id=eq.${report.id}&reopened_at=not.is.null&reopen_answered_at=is.null`, {
      method: "PATCH",
      body: { reopened_at: null, reopen_reason: null, client_decision: "already_there" },
    });
  }
}

export async function setGoLiveTick(unitId: string, key: string, state: GoLiveTick["state"] | null, by: string): Promise<void> {
  if (!BE_KEYS.has(key) && !isPartAKey(key)) throw new Error("Unknown check.");
  if (state && !["done", "yes", "no"].includes(state)) throw new Error("Unknown state.");
  const sb = admin();
  const signed = await sb.from("onboarding_golive_signoffs").select("unit_id").eq("unit_id", unitId).maybeSingle();
  if (signed.error) throw new Error(GOLIVE_SQL);
  if (signed.data) throw new Error("Already signed off as ready to list.");
  /* Part A "Couldn't find it" reopens that line for the client; changing it back undoes that. */
  if (isPartAKey(key)) {
    const prev = await sb.from("onboarding_golive_ticks").select("state").eq("unit_id", unitId).eq("item_key", key).maybeSingle();
    const itemRowId = key.slice(2);
    if (state === "no") await setReopen(unitId, itemRowId, true);
    else if (prev.data?.state === "no") await setReopen(unitId, itemRowId, false);
  }
  if (!state) {
    const { error } = await sb.from("onboarding_golive_ticks").delete().eq("unit_id", unitId).eq("item_key", key);
    if (error) throw error;
    return;
  }
  const { error } = await sb
    .from("onboarding_golive_ticks")
    .upsert({ unit_id: unitId, item_key: key, state, ticked_by: by || "Admin", ticked_at: new Date().toISOString() }, { onConflict: "unit_id,item_key" });
  if (error) {
    if (/onboarding_golive|does not exist|schema cache/i.test(error.message || "")) throw new Error(GOLIVE_SQL);
    throw error;
  }
}

/** "Ready to list": records who signed off and when. Touches nothing else. Re-checks every part on the server. */
export async function signOffGoLive(unitId: string, by: string): Promise<{ by: string; at: string }> {
  const [review, live] = await Promise.all([getClientReview(unitId), getGoLive(unitId)]);
  if (live.setupError) throw new Error(live.setupError);
  if (review.setupError) throw new Error(review.setupError);
  if (live.signoff) return live.signoff;
  if (!allPartsOk(review.report, review.items, live.ticks)) throw new Error("Every part must be green before Ready to list.");
  const at = new Date().toISOString();
  const { error } = await admin().from("onboarding_golive_signoffs").insert({ unit_id: unitId, signed_by: by || "Admin", signed_at: at });
  if (error) throw error;
  return { by: by || "Admin", at };
}
