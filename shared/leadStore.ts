import type { HasListing } from "./auditEmails.js";
import {
  normalizeLeadStatus,
  normalizeOfferPath,
  type LeadStatus,
  type OfferPath,
} from "./crmTypes.js";
import { getSupabaseAdmin, isSupabaseConfigured } from "./supabase.js";

export type { LeadStatus, OfferPath } from "./crmTypes.js";
export {
  LEAD_STATUSES,
  PIPELINE_STATUSES,
  STATUS_LABEL,
  STATUS_JOURNEY,
  OFFER_PATHS,
  OFFER_PATH_LABEL,
  normalizeLeadStatus,
  normalizeOfferPath,
  inferOfferPath,
} from "./crmTypes.js";

export type LeadRow = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  earnings: string;
  listing_title: string;
  has_listing: HasListing;
  call_start_iso: string | null;
  call_booking: string;
  source: string;
  marketing_opt_in: boolean;
  property_stage: string | null;
  permit_status: string | null;
  str_allowed: string | null;
  launch_timeline: string | null;
  status: LeadStatus;
  notes: string;
  /** Claude/human summaries of CRM phone calls */
  call_notes: string;
  whats_next: string;
  notes_updated_at: string | null;
  qualified_at: string | null;
  ai_paused: boolean;
  /** When true, AI runs for this lead even if global AI is off (test override). */
  ai_force_on: boolean;
  /** draft = queue SMS for approve; autopilot = send now */
  ai_send_mode: "draft" | "autopilot";
  playbook_steps: import("./playbookTypes.js").PlaybookStep[];
  offer_path: OfferPath;
  sms_last_read_at: string | null;
};

export type InsertLeadInput = {
  name: string;
  email: string;
  phone: string;
  address: string;
  earnings: string;
  listingTitle?: string;
  hasListing: HasListing;
  callStartIso: string;
  callBooking: string;
  source: string;
  marketingOptIn: boolean;
  propertyStage?: string | null;
  permitStatus?: string | null;
  strAllowed?: string | null;
  launchTimeline?: string | null;
  /** When set, skips auto status from qualifiers */
  status?: LeadStatus;
  notes?: string;
  aiPaused?: boolean;
  offerPath?: OfferPath;
};

export type QualifierInput = {
  propertyStage: string;
  permitStatus: string;
  launchTimeline?: string;
  strAllowed?: string;
};

export type LeadCrmUpdate = {
  status?: LeadStatus;
  notes?: string;
  callNotes?: string;
  whatsNext?: string;
  aiPaused?: boolean;
  aiForceOn?: boolean;
  aiSendMode?: "draft" | "autopilot";
  playbookSteps?: import("./playbookTypes.js").PlaybookStep[];
  offerPath?: OfferPath;
};

function mapLead(row: Record<string, unknown>): LeadRow {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    phone: String(row.phone ?? ""),
    address: String(row.address ?? ""),
    earnings: String(row.earnings ?? ""),
    listing_title: String(row.listing_title ?? ""),
    has_listing: (row.has_listing as LeadRow["has_listing"]) || "unknown",
    call_start_iso: (row.call_start_iso as string | null) ?? null,
    call_booking: String(row.call_booking ?? ""),
    source: String(row.source ?? ""),
    marketing_opt_in: Boolean(row.marketing_opt_in),
    property_stage: (row.property_stage as string | null) ?? null,
    permit_status: (row.permit_status as string | null) ?? null,
    str_allowed: (row.str_allowed as string | null) ?? null,
    launch_timeline: (row.launch_timeline as string | null) ?? null,
    status: normalizeLeadStatus(row.status as string),
    notes: String(row.notes ?? ""),
    call_notes: String(row.call_notes ?? ""),
    whats_next: String(row.whats_next ?? ""),
    notes_updated_at: (row.notes_updated_at as string | null) ?? null,
    qualified_at: (row.qualified_at as string | null) ?? null,
    ai_paused: Boolean(row.ai_paused),
    ai_force_on: Boolean(row.ai_force_on),
    ai_send_mode: row.ai_send_mode === "draft" ? "draft" : "autopilot",
    playbook_steps: Array.isArray(row.playbook_steps)
      ? (row.playbook_steps as import("./playbookTypes.js").PlaybookStep[])
      : [],
    offer_path: normalizeOfferPath(row.offer_path as string),
    sms_last_read_at: (row.sms_last_read_at as string | null) ?? null,
  };
}

export function suggestStatusFromQualifier(q: QualifierInput): LeadStatus {
  if (q.permitStatus === "not_planning" || q.strAllowed === "no") {
    return "low_fit";
  }
  if (q.propertyStage === "researching" || q.launchTimeline === "later") {
    return "nurturing";
  }
  return "engaging";
}

export async function insertLead(input: InsertLeadInput): Promise<string | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;

  const hasNoQualifier =
    input.hasListing === "no" &&
    Boolean(input.propertyStage && input.permitStatus && input.strAllowed);

  const status =
    input.status ??
    (hasNoQualifier
      ? suggestStatusFromQualifier({
          propertyStage: input.propertyStage!,
          permitStatus: input.permitStatus!,
          strAllowed: input.strAllowed || undefined,
          launchTimeline: input.launchTimeline || undefined,
        })
      : "new");

  const { data, error } = await sb
    .from("leads")
    .insert({
      name: input.name,
      email: input.email,
      phone: input.phone,
      address: input.address,
      earnings: input.earnings,
      listing_title: input.listingTitle ?? "",
      has_listing: input.hasListing,
      call_start_iso: input.callStartIso || null,
      call_booking: input.callBooking,
      source: input.source,
      marketing_opt_in: input.marketingOptIn,
      property_stage: input.propertyStage ?? null,
      permit_status: input.permitStatus ?? null,
      str_allowed: input.strAllowed ?? null,
      launch_timeline: input.launchTimeline ?? null,
      status,
      notes: input.notes ?? "",
      ai_paused: input.aiPaused ?? false,
      offer_path: input.offerPath ?? "unknown",
      qualified_at:
        status === "engaging" ||
        status === "interested" ||
        status === "nurturing" ||
        hasNoQualifier
          ? new Date().toISOString()
          : null,
    })
    .select("id")
    .single();

  if (error) {
    // Retry without offer_path if migration crm_ai_v2 not applied yet
    if (/offer_path/i.test(error.message)) {
      const retry = await sb
        .from("leads")
        .insert({
          name: input.name,
          email: input.email,
          phone: input.phone,
          address: input.address,
          earnings: input.earnings,
          listing_title: input.listingTitle ?? "",
          has_listing: input.hasListing,
          call_start_iso: input.callStartIso || null,
          call_booking: input.callBooking,
          source: input.source,
          marketing_opt_in: input.marketingOptIn,
          property_stage: input.propertyStage ?? null,
          permit_status: input.permitStatus ?? null,
          str_allowed: input.strAllowed ?? null,
          launch_timeline: input.launchTimeline ?? null,
          status,
          notes: input.notes ?? "",
          ai_paused: input.aiPaused ?? false,
          qualified_at:
            status === "engaging" ||
            status === "interested" ||
            status === "nurturing" ||
            hasNoQualifier
              ? new Date().toISOString()
              : null,
        })
        .select("id")
        .single();
      if (retry.error) {
        console.error("[leads] insert failed", retry.error.message);
        return null;
      }
      return retry.data?.id ?? null;
    }
    console.error("[leads] insert failed", error.message);
    return null;
  }
  return data?.id ?? null;
}

export async function getLeadById(leadId: string): Promise<LeadRow | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb.from("leads").select("*").eq("id", leadId).maybeSingle();
  if (error || !data) {
    if (error) console.error("[leads] get failed", error.message);
    return null;
  }
  return mapLead(data as Record<string, unknown>);
}

export async function updateLeadQualifier(
  leadId: string,
  q: QualifierInput,
): Promise<LeadRow | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;

  const status = suggestStatusFromQualifier(q);
  const { data, error } = await sb
    .from("leads")
    .update({
      property_stage: q.propertyStage,
      permit_status: q.permitStatus,
      launch_timeline: q.launchTimeline ?? null,
      str_allowed: q.strAllowed ?? null,
      status,
      qualified_at: new Date().toISOString(),
    })
    .eq("id", leadId)
    .select("*")
    .single();

  if (error) {
    console.error("[leads] qualifier update failed", error.message);
    return null;
  }
  return mapLead(data as Record<string, unknown>);
}

export async function listLeads(limit = 100, q?: string): Promise<LeadRow[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];

  let query = sb
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  const term = q?.trim();
  if (term) {
    const safe = term.replace(/[%",]/g, " ").trim();
    if (safe) {
      const pattern = `%${safe}%`;
      query = query.or(
        `name.ilike."${pattern}",email.ilike."${pattern}",phone.ilike."${pattern}",address.ilike."${pattern}",listing_title.ilike."${pattern}"`,
      );
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error("[leads] list failed", error.message);
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => mapLead(row as Record<string, unknown>));
}

export async function updateLeadCrm(
  leadId: string,
  patch: LeadCrmUpdate,
): Promise<LeadRow | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;

  const update: Record<string, unknown> = {};
  if (patch.status) update.status = patch.status;
  if (patch.notes !== undefined) {
    update.notes = patch.notes;
    update.notes_updated_at = new Date().toISOString();
  }
  if (patch.callNotes !== undefined) {
    update.call_notes = patch.callNotes;
    update.notes_updated_at = new Date().toISOString();
  }
  if (patch.whatsNext !== undefined) {
    update.whats_next = patch.whatsNext;
    update.notes_updated_at = new Date().toISOString();
  }
  if (patch.aiPaused !== undefined) {
    update.ai_paused = patch.aiPaused;
  }
  if (patch.aiForceOn !== undefined) {
    update.ai_force_on = patch.aiForceOn;
  }
  if (patch.aiSendMode !== undefined) {
    update.ai_send_mode = patch.aiSendMode === "draft" ? "draft" : "autopilot";
  }
  if (patch.playbookSteps !== undefined) {
    update.playbook_steps = patch.playbookSteps;
  }
  if (patch.offerPath !== undefined) {
    update.offer_path = patch.offerPath;
  }

  if (Object.keys(update).length === 0) return null;

  const { data, error } = await sb
    .from("leads")
    .update(update)
    .eq("id", leadId)
    .select("*")
    .single();

  if (error) {
    const missing =
      /call_notes|playbook_steps|ai_send_mode/i.test(error.message) &&
      ["call_notes", "playbook_steps", "ai_send_mode"].filter(
        (key) => update[key] !== undefined && new RegExp(key, "i").test(error.message),
      );
    if (missing && missing.length) {
      for (const key of missing) delete update[key];
      if (Object.keys(update).length === 0) return null;
      const retry = await sb
        .from("leads")
        .update(update)
        .eq("id", leadId)
        .select("*")
        .single();
      if (retry.error || !retry.data) {
        console.error("[leads] crm update failed", retry.error?.message || error.message);
        return null;
      }
      return mapLead(retry.data as Record<string, unknown>);
    }
    console.error("[leads] crm update failed", error.message);
    return null;
  }
  return mapLead(data as Record<string, unknown>);
}

export async function setLeadAiPaused(
  leadId: string,
  paused: boolean,
): Promise<LeadRow | null> {
  return updateLeadCrm(leadId, { aiPaused: paused });
}

export async function deleteLead(leadId: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb) return false;

  const { error } = await sb.from("leads").delete().eq("id", leadId);
  if (error) {
    console.error("[leads] delete failed", error.message);
    return false;
  }
  return true;
}

/** Mark a lead as having booked a call (stops SMS when cron sees call_start_iso). */
export async function markLeadBooked(
  leadId: string,
  input: {
    callStartIso?: string | null;
    callBooking?: string | null;
    note?: string | null;
  },
): Promise<LeadRow | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;

  const { data: existing, error: readErr } = await sb
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .maybeSingle();
  if (readErr || !existing) {
    console.error("[leads] mark booked read failed", readErr?.message);
    return null;
  }

  const prevNotes = String(existing.notes ?? "").trim();
  const noteLine = input.note?.trim();
  const update: Record<string, unknown> = {
    status: "booked",
    ai_paused: true,
    notes_updated_at: new Date().toISOString(),
  };
  if (input.callStartIso) update.call_start_iso = input.callStartIso;
  if (input.callBooking !== undefined && input.callBooking !== null) {
    update.call_booking = input.callBooking;
  } else if (input.callStartIso && !existing.call_booking) {
    try {
      update.call_booking = new Date(input.callStartIso).toLocaleString("en-CA", {
        timeZone: "America/Toronto",
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      update.call_booking = input.callStartIso;
    }
  }
  if (noteLine) {
    update.notes = prevNotes ? `${prevNotes}\n${noteLine}` : noteLine;
  }

  const { data, error } = await sb
    .from("leads")
    .update(update)
    .eq("id", leadId)
    .select("*")
    .single();

  if (error) {
    console.error("[leads] mark booked failed", error.message);
    return null;
  }
  return mapLead(data as Record<string, unknown>);
}

export async function getBookedCallIsosFromLeads(): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabaseAdmin();
  if (!sb) return [];

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data, error } = await sb
    .from("leads")
    .select("call_start_iso")
    .not("call_start_iso", "is", null)
    .gte("call_start_iso", since);

  if (error) {
    console.warn("[leads] booked slots query failed", error.message);
    return [];
  }

  return (data ?? [])
    .map((r) => r.call_start_iso as string | null)
    .filter((iso): iso is string => Boolean(iso));
}

/** Digits only for loose phone matching (+1 optional). */
export function normalizePhoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

export async function findLeadByEmailOrPhone(
  email: string,
  phone: string,
): Promise<LeadRow | null> {
  const rows = await findLeadsByEmailOrPhone(email, phone);
  return rows[0] ?? null;
}

/** All CRM rows matching email and/or phone (newest first). */
export async function findLeadsByEmailOrPhone(
  email: string,
  phone: string,
): Promise<LeadRow[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];

  const found = new Map<string, LeadRow>();
  const emailNorm = email.trim().toLowerCase();

  if (emailNorm) {
    const { data, error } = await sb
      .from("leads")
      .select("*")
      .ilike("email", emailNorm)
      .order("created_at", { ascending: false })
      .limit(20);
    if (!error && data) {
      for (const row of data) {
        const mapped = mapLead(row as Record<string, unknown>);
        found.set(mapped.id, mapped);
      }
    }
  }

  const want = normalizePhoneDigits(phone);
  if (want.length >= 7) {
    const { data, error } = await sb
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (!error && data) {
      for (const row of data) {
        const existing = normalizePhoneDigits(String(row.phone ?? ""));
        if (
          existing &&
          (existing === want || existing.endsWith(want) || want.endsWith(existing))
        ) {
          const mapped = mapLead(row as Record<string, unknown>);
          found.set(mapped.id, mapped);
        }
      }
    }
  }

  return [...found.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}
