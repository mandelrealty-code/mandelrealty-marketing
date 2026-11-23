/**
 * Intake progress — read-only from cleaner app Supabase (hyndmdjvjlsbthlqrxge).
 * Admin never writes to cleaner DB. Flag acks stay in admin dashboard_actions.
 */

import { getSupabaseAdmin } from "../supabase.js";
import { createDashboardAction } from "../adminApi/dashboard.js";

function db() {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  return sb;
}

export const INTAKE_TOTAL_ITEMS = 140;

/** Fixed 18 sections from Intake_Progress.html (totals sum to 140). */
export const INTAKE_SECTIONS: { key: string; name: string; total: number; required?: boolean }[] = [
  { key: "s1", name: "Setup", total: 12 },
  { key: "s2", name: "Owner", total: 10 },
  { key: "s3", name: "Arrival", total: 4 },
  { key: "s4", name: "Access", total: 8 },
  { key: "s5", name: "Safety", total: 9, required: true },
  { key: "s6", name: "Wi-Fi & Tech", total: 6 },
  { key: "s7", name: "Utilities", total: 7 },
  { key: "s8", name: "Entry", total: 5 },
  { key: "s9", name: "Living & Dining", total: 10 },
  { key: "s10", name: "Kitchen appliances", total: 9 },
  { key: "s11", name: "Kitchen inventory", total: 12 },
  { key: "s12", name: "Bedroom", total: 10 },
  { key: "s13", name: "Bathroom", total: 9 },
  { key: "s14", name: "Laundry", total: 5 },
  { key: "s15", name: "Supplies", total: 6 },
  { key: "s16", name: "Outdoor", total: 6 },
  { key: "s17", name: "Condition", total: 7 },
  { key: "s18", name: "Measurements", total: 5 },
];

const CLEANER_REST =
  (process.env.CLEANER_HUB_SUPABASE_URL || "").trim().replace(/\/$/, "") ||
  "https://hyndmdjvjlsbthlqrxge.supabase.co";

function cleanerServiceKey(): string {
  return (
    process.env.CLEANER_SUPABASE_SERVICE_KEY ||
    process.env.CLEANER_HUB_SERVICE_ROLE_KEY ||
    ""
  ).trim();
}

type AnswerRow = {
  id?: string;
  item_id: string;
  section_id: string;
  status: string;
  answer_type: string | null;
  answer_value: string | null;
  flag_type: string | null;
  flag_note: string | null;
  flag_photo_url: string | null;
  answered_by: string | null;
  answered_at: string | null;
};

export type IntakeActivityRow = {
  itemId: string;
  sectionId: string;
  label: string;
  status: string;
  answerType: string | null;
  answerValue: string | null;
  flagType: string | null;
  flagNote: string | null;
  photoUrl: string | null;
  answeredAt: string | null;
  kind: "ans" | "flag" | "skip" | "sub";
};

export type IntakePhoto = {
  itemId: string;
  sectionId: string;
  sectionLabel: string;
  label: string;
  url: string;
  answeredAt: string | null;
};

export type IntakeFlag = {
  id: string;
  itemId: string;
  sectionId: string;
  sectionLabel: string;
  name: string;
  type: string;
  note: string;
  photoUrl: string | null;
  answeredAt: string | null;
  acknowledged: boolean;
};

export type IntakeProgressPayload = {
  unitId: string;
  address: string;
  cleanerPropertyId: string;
  totalItems: number;
  answeredItems: number;
  progress: number;
  lastActivity: string | null;
  answeredBy: string | null;
  isActive: boolean;
  idleMinutes: number | null;
  photoCount: number;
  activeMinutes: number | null;
  sectionProgress: Record<string, { total: number; answered: number; name: string; required?: boolean }>;
  recentActivity: IntakeActivityRow[];
  photos: IntakePhoto[];
  flags: IntakeFlag[];
  leadId: string | null;
  ownerPhone: string | null;
  sections: typeof INTAKE_SECTIONS;
};

export type IntakeStreamPayload = {
  lastActivityAt: string | null;
  answeredItems: number;
  isActive: boolean;
};

async function cleanerGet<T>(pathAndQuery: string): Promise<T> {
  const key = cleanerServiceKey();
  if (!key) {
    throw new Error(
      "CLEANER_SUPABASE_SERVICE_KEY is not set. Add it for intake progress monitoring.",
    );
  }
  const url = `${CLEANER_REST}/rest/v1/${pathAndQuery}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      Prefer: "count=exact",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Cleaner REST ${res.status}: ${text.slice(0, 200) || res.statusText}`);
  }
  return (await res.json()) as T;
}

function normalizeSectionKey(raw: string): string {
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return "";
  const m = /^s?(\d{1,2})$/.exec(s);
  if (m) return `s${Number(m[1])}`;
  const byName = INTAKE_SECTIONS.find((x) => x.name.toLowerCase() === s || x.key === s);
  return byName?.key || s;
}

function itemLabel(itemId: string): string {
  const raw = String(itemId || "").replace(/^item[_-]?/i, "").replace(/[_-]+/g, " ").trim();
  if (!raw) return "Checklist item";
  return raw.replace(/\b\w/g, (c) => c.toUpperCase());
}

function sectionLabel(sectionId: string): string {
  const key = normalizeSectionKey(sectionId);
  const sec = INTAKE_SECTIONS.find((s) => s.key === key);
  if (!sec) return sectionId || "Section";
  const idx = INTAKE_SECTIONS.indexOf(sec) + 1;
  return `Section ${idx} · ${sec.name}`;
}

function isAnswered(row: AnswerRow): boolean {
  const st = String(row.status || "").toLowerCase();
  if (!st || st === "pending" || st === "todo" || st === "unanswered") return false;
  return true;
}

function activityKind(row: AnswerRow): IntakeActivityRow["kind"] {
  const st = String(row.status || "").toLowerCase();
  if (st === "flagged" || st === "flag") return "flag";
  if (st === "skipped" || st === "skip" || st === "na") return "skip";
  if (st === "submitted" || st === "complete" || st === "completed") return "sub";
  return "ans";
}

function photoUrlOf(row: AnswerRow): string | null {
  const flag = (row.flag_photo_url || "").trim();
  if (flag) return flag;
  const t = String(row.answer_type || "").toLowerCase();
  const v = (row.answer_value || "").trim();
  if (t === "photo" && v) return v;
  if (/^https?:\/\//i.test(v) && /\.(jpe?g|png|webp|gif)(\?|$)/i.test(v)) return v;
  return null;
}

async function signIfNeeded(url: string): Promise<string> {
  const u = url.trim();
  if (!u) return u;
  if (/^https?:\/\//i.test(u)) return u;
  const key = cleanerServiceKey();
  if (!key) return u;
  const bucket =
    (process.env.CLEANER_INTAKE_STORAGE_BUCKET || "").trim() || "onboarding-media";
  const path = u.replace(/^\//, "");
  try {
    const res = await fetch(`${CLEANER_REST}/storage/v1/object/sign/${bucket}/${path}`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: 3600 }),
    });
    if (!res.ok) return u;
    const data = (await res.json()) as { signedURL?: string; signedUrl?: string };
    const signed = data.signedURL || data.signedUrl || "";
    if (!signed) return u;
    if (/^https?:\/\//i.test(signed)) return signed;
    return `${CLEANER_REST}/storage/v1${signed.startsWith("/") ? "" : "/"}${signed}`;
  } catch {
    return u;
  }
}

async function loadAckKeys(unitId: string): Promise<Set<string>> {
  const sb = db();
  const { data, error } = await sb
    .from("dashboard_actions")
    .select("body")
    .eq("type", "intake_flag_ack")
    .eq("unit_id", unitId)
    .not("actioned_at", "is", null);
  if (error) {
    if (/dashboard_actions|does not exist|schema cache/i.test(error.message || "")) return new Set();
    throw error;
  }
  return new Set(
    ((data ?? []) as { body?: string }[]).map((r) => String(r.body || "").trim()).filter(Boolean),
  );
}

async function fetchAnswers(propertyId: string): Promise<AnswerRow[]> {
  const q =
    `onboarding_item_answers?property_id=eq.${encodeURIComponent(propertyId)}` +
    `&select=id,item_id,section_id,status,answer_type,answer_value,flag_type,flag_note,flag_photo_url,answered_by,answered_at` +
    `&order=answered_at.desc.nullslast`;
  return cleanerGet<AnswerRow[]>(q);
}

async function fetchOnboarderName(propertyId: string): Promise<string | null> {
  try {
    const assigns = await cleanerGet<
      { user_id: string; assigned_at: string | null }[]
    >(
      `onboarder_assignments?property_id=eq.${encodeURIComponent(propertyId)}` +
        `&select=user_id,assigned_at&order=assigned_at.desc.nullslast&limit=1`,
    );
    const userId = assigns[0]?.user_id;
    if (!userId) return null;
    const profiles = await cleanerGet<{ first_name?: string; last_name?: string }[]>(
      `profiles?id=eq.${encodeURIComponent(userId)}&select=first_name,last_name`,
    );
    const p = profiles[0];
    if (!p) return null;
    const name = [p.first_name, p.last_name].map((x) => String(x || "").trim()).filter(Boolean).join(" ");
    return name || null;
  } catch {
    return null;
  }
}

function emptySectionProgress(): IntakeProgressPayload["sectionProgress"] {
  const out: IntakeProgressPayload["sectionProgress"] = {};
  for (const s of INTAKE_SECTIONS) {
    out[s.key] = { total: s.total, answered: 0, name: s.name, required: s.required };
  }
  return out;
}

export async function getUnitIntakeLink(unitId: string): Promise<{
  address: string;
  cleanerPropertyId: string;
  leadId: string | null;
  ownerPhone: string | null;
}> {
  const sb = db();
  const { data, error } = await sb
    .from("onboarding_units")
    .select("id, address, cleaner_property_id, lead_id, owner_phone")
    .eq("id", unitId)
    .maybeSingle();
  if (error) {
    if (/cleaner_property_id|column.*does not exist|schema cache/i.test(error.message || "")) {
      const fallback = await sb
        .from("onboarding_units")
        .select("id, address, lead_id, owner_phone")
        .eq("id", unitId)
        .maybeSingle();
      if (fallback.error) throw fallback.error;
      if (!fallback.data) throw new Error("Unit not found.");
      const row = fallback.data as Record<string, unknown>;
      return {
        address: String(row.address || ""),
        cleanerPropertyId: "",
        leadId: row.lead_id ? String(row.lead_id) : null,
        ownerPhone: row.owner_phone ? String(row.owner_phone) : null,
      };
    }
    throw error;
  }
  if (!data) throw new Error("Unit not found.");
  const row = data as Record<string, unknown>;
  return {
    address: String(row.address || ""),
    cleanerPropertyId: String(row.cleaner_property_id || "").trim(),
    leadId: row.lead_id ? String(row.lead_id) : null,
    ownerPhone: row.owner_phone ? String(row.owner_phone) : null,
  };
}

function buildFromAnswers(
  answers: AnswerRow[],
  acks: Set<string>,
  meta: {
    unitId: string;
    address: string;
    cleanerPropertyId: string;
    answeredBy: string | null;
    leadId: string | null;
    ownerPhone: string | null;
  },
): IntakeProgressPayload {
  const sectionProgress = emptySectionProgress();
  let answeredItems = 0;
  let lastActivity: string | null = null;
  let firstActivity: string | null = null;

  for (const row of answers) {
    const key = normalizeSectionKey(row.section_id);
    if (isAnswered(row)) {
      answeredItems += 1;
      if (key && sectionProgress[key]) {
        sectionProgress[key]!.answered = Math.min(
          sectionProgress[key]!.total,
          sectionProgress[key]!.answered + 1,
        );
      }
      const at = row.answered_at;
      if (at) {
        if (!lastActivity || at > lastActivity) lastActivity = at;
        if (!firstActivity || at < firstActivity) firstActivity = at;
      }
    }
  }

  const now = Date.now();
  const lastMs = lastActivity ? Date.parse(lastActivity) : NaN;
  const isActive = Number.isFinite(lastMs) && now - lastMs <= 5 * 60 * 1000;
  const idleMinutes =
    Number.isFinite(lastMs) && !isActive
      ? Math.max(0, Math.round((now - lastMs) / 60000))
      : Number.isFinite(lastMs)
        ? 0
        : null;

  const firstMs = firstActivity ? Date.parse(firstActivity) : NaN;
  const activeMinutes =
    Number.isFinite(lastMs) && Number.isFinite(firstMs)
      ? Math.max(0, Math.round((lastMs - firstMs) / 60000))
      : null;

  const recent = answers
    .filter((r) => isAnswered(r) && r.answered_at)
    .slice()
    .sort((a, b) => String(b.answered_at).localeCompare(String(a.answered_at)))
    .slice(0, 20)
    .map((r): IntakeActivityRow => {
      const kind = activityKind(r);
      const photo = photoUrlOf(r);
      return {
        itemId: r.item_id,
        sectionId: normalizeSectionKey(r.section_id),
        label: itemLabel(r.item_id),
        status: r.status,
        answerType: r.answer_type,
        answerValue: r.answer_value,
        flagType: r.flag_type,
        flagNote: r.flag_note,
        photoUrl: photo,
        answeredAt: r.answered_at,
        kind: String(r.answer_type || "").toLowerCase() === "photo" && kind === "ans" ? "ans" : kind,
      };
    });

  const photosRaw = answers
    .filter((r) => String(r.answer_type || "").toLowerCase() === "photo" && isAnswered(r))
    .slice()
    .sort((a, b) => String(b.answered_at || "").localeCompare(String(a.answered_at || "")))
    .map((r): IntakePhoto => ({
      itemId: r.item_id,
      sectionId: normalizeSectionKey(r.section_id),
      sectionLabel: sectionLabel(r.section_id),
      label: itemLabel(r.item_id),
      url: photoUrlOf(r) || "",
      answeredAt: r.answered_at,
    }))
    .filter((p) => p.url);

  const flags = answers
    .filter((r) => String(r.status || "").toLowerCase() === "flagged")
    .map((r): IntakeFlag => {
      const id = String(r.id || `${r.item_id}`);
      return {
        id,
        itemId: r.item_id,
        sectionId: normalizeSectionKey(r.section_id),
        sectionLabel: sectionLabel(r.section_id),
        name: itemLabel(r.item_id),
        type: (r.flag_type || "Flagged").trim() || "Flagged",
        note: (r.flag_note || "").trim(),
        photoUrl: photoUrlOf(r),
        answeredAt: r.answered_at,
        acknowledged: acks.has(id) || acks.has(r.item_id),
      };
    });

  const progress = Math.round((answeredItems / INTAKE_TOTAL_ITEMS) * 100);

  return {
    unitId: meta.unitId,
    address: meta.address,
    cleanerPropertyId: meta.cleanerPropertyId,
    totalItems: INTAKE_TOTAL_ITEMS,
    answeredItems,
    progress: Math.min(100, progress),
    lastActivity,
    answeredBy: meta.answeredBy,
    isActive,
    idleMinutes,
    photoCount: photosRaw.length,
    activeMinutes,
    sectionProgress,
    recentActivity: recent,
    photos: photosRaw,
    flags,
    leadId: meta.leadId,
    ownerPhone: meta.ownerPhone,
    sections: INTAKE_SECTIONS,
  };
}

export async function getIntakeProgress(unitId: string): Promise<IntakeProgressPayload> {
  const link = await getUnitIntakeLink(unitId);
  if (!link.cleanerPropertyId) {
    return {
      unitId,
      address: link.address,
      cleanerPropertyId: "",
      totalItems: INTAKE_TOTAL_ITEMS,
      answeredItems: 0,
      progress: 0,
      lastActivity: null,
      answeredBy: null,
      isActive: false,
      idleMinutes: null,
      photoCount: 0,
      activeMinutes: null,
      sectionProgress: emptySectionProgress(),
      recentActivity: [],
      photos: [],
      flags: [],
      leadId: link.leadId,
      ownerPhone: link.ownerPhone,
      sections: INTAKE_SECTIONS,
    };
  }

  const [answers, answeredBy, acks] = await Promise.all([
    fetchAnswers(link.cleanerPropertyId),
    fetchOnboarderName(link.cleanerPropertyId),
    loadAckKeys(unitId),
  ]);

  const payload = buildFromAnswers(answers, acks, {
    unitId,
    address: link.address,
    cleanerPropertyId: link.cleanerPropertyId,
    answeredBy,
    leadId: link.leadId,
    ownerPhone: link.ownerPhone,
  });

  // Sign relative storage paths (best-effort; never write).
  payload.photos = await Promise.all(
    payload.photos.map(async (p) => ({ ...p, url: await signIfNeeded(p.url) })),
  );
  payload.recentActivity = await Promise.all(
    payload.recentActivity.map(async (r) =>
      r.photoUrl ? { ...r, photoUrl: await signIfNeeded(r.photoUrl) } : r,
    ),
  );
  payload.flags = await Promise.all(
    payload.flags.map(async (f) =>
      f.photoUrl ? { ...f, photoUrl: await signIfNeeded(f.photoUrl) } : f,
    ),
  );

  return payload;
}

export async function getIntakeProgressStream(unitId: string): Promise<IntakeStreamPayload> {
  const link = await getUnitIntakeLink(unitId);
  if (!link.cleanerPropertyId) {
    return { lastActivityAt: null, answeredItems: 0, isActive: false };
  }
  const answers = await fetchAnswers(link.cleanerPropertyId);
  let answeredItems = 0;
  let lastActivityAt: string | null = null;
  for (const row of answers) {
    if (!isAnswered(row)) continue;
    answeredItems += 1;
    if (row.answered_at && (!lastActivityAt || row.answered_at > lastActivityAt)) {
      lastActivityAt = row.answered_at;
    }
  }
  const lastMs = lastActivityAt ? Date.parse(lastActivityAt) : NaN;
  const isActive = Number.isFinite(lastMs) && Date.now() - lastMs <= 5 * 60 * 1000;
  return { lastActivityAt, answeredItems, isActive };
}

export type StravoPropertyHit = {
  id: string;
  name: string;
  address: string;
};

/** Search cleaner-app properties by name (ilike). Read-only. */
export async function searchStravoProperties(q: string): Promise<StravoPropertyHit[]> {
  const term = String(q || "").trim().replace(/[%*,]/g, " ").slice(0, 80);
  if (!term) return [];
  const pattern = `*${term}*`;
  try {
    const rows = await cleanerGet<
      { id?: string; name?: string; address?: string; title?: string }[]
    >(
      `properties?or=(name.ilike.${encodeURIComponent(pattern)},address.ilike.${encodeURIComponent(pattern)})` +
        `&select=id,name,address&order=name.asc&limit=25`,
    );
    return (rows || [])
      .map((r) => ({
        id: String(r.id || "").trim(),
        name: String(r.name || r.title || "").trim() || "Untitled property",
        address: String(r.address || "").trim(),
      }))
      .filter((r) => r.id);
  } catch {
    // Fallback: name-only filter if `or=` / address column differs.
    const rows = await cleanerGet<
      { id?: string; name?: string; address?: string; title?: string }[]
    >(
      `properties?name=ilike.${encodeURIComponent(pattern)}` +
        `&select=id,name,address&order=name.asc&limit=25`,
    );
    return (rows || [])
      .map((r) => ({
        id: String(r.id || "").trim(),
        name: String(r.name || r.title || "").trim() || "Untitled property",
        address: String(r.address || "").trim(),
      }))
      .filter((r) => r.id);
  }
}

export async function linkStravoProperty(
  unitId: string,
  cleanerPropertyId: string,
): Promise<void> {
  const id = String(unitId || "").trim();
  const pid = String(cleanerPropertyId || "").trim();
  if (!id || !pid) throw new Error("unitId and cleanerPropertyId required.");
  const sb = db();
  const { error } = await sb
    .from("onboarding_units")
    .update({
      cleaner_property_id: pid,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function markPortalLinkSent(unitId: string): Promise<string> {
  const id = String(unitId || "").trim();
  if (!id) throw new Error("unitId required.");
  const now = new Date().toISOString();
  const sb = db();
  const { error } = await sb
    .from("onboarding_units")
    .update({
      portal_link_sent_at: now,
      updated_at: now,
    })
    .eq("id", id);
  if (error) {
    if (/portal_link_sent_at|column.*does not exist|schema cache/i.test(error.message || "")) {
      throw new Error(
        "portal_link_sent_at missing. Run supabase/onboarding_portal_link_v1.sql in Supabase, then retry.",
      );
    }
    throw error;
  }
  return now;
}

export async function acknowledgeIntakeFlag(unitId: string, flagId: string): Promise<void> {
  const key = String(flagId || "").trim();
  if (!unitId || !key) throw new Error("unit_id and flag_id required.");
  const sb = db();
  const { data: existing } = await sb
    .from("dashboard_actions")
    .select("id")
    .eq("type", "intake_flag_ack")
    .eq("unit_id", unitId)
    .eq("body", key)
    .limit(1)
    .maybeSingle();
  const now = new Date().toISOString();
  if (existing?.id) {
    await sb
      .from("dashboard_actions")
      .update({ actioned_at: now })
      .eq("id", existing.id);
    return;
  }
  const made = await createDashboardAction({
    type: "intake_flag_ack",
    unitId,
    title: "Intake flag acknowledged",
    body: key,
  });
  if (made?.id) {
    await sb.from("dashboard_actions").update({ actioned_at: now }).eq("id", made.id);
  }
}
