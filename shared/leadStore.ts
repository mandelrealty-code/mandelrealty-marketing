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
  /** Sale details, filled on the call or when onboarding starts. Empty until then. */
  plan: string;
  booked_by: string;
  closed_by: string;
  contract_status: "" | "signed" | "sent" | "not_sent" | "cancelled";
  referred_by: string;
  /** The onboarding unit this lead became, once onboarding has started. */
  onboarding_unit_id: string | null;
  /** pm_clients.id — set when the first contract is sent from CRM. */
  client_id: string | null;
  /** pm_contracts.id — most recent contract sent from CRM. */
  contract_id: string | null;
  /** Contract send form (crm_contract_details_v1). */
  contract_plan_tier: string;
  contract_term: string;
  contract_launch_payment: string;
  contract_benchmarks: Record<string, number> | null;
  contract_is_blank: boolean;
  /** Sales-call property profile (crm_profile_v1). */
  property_address: string;
  property_place_id: string;
  property_city: string;
  full_name: string;
  ownership: string;
  airbnb_live: boolean | null;
  furnished: string;
  occupants: string;
  occupant_notes: string;
  str_rules_checked_at: string | null;
  str_rules_city: string;
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
  plan?: string;
  bookedBy?: string;
  closedBy?: string;
  contractStatus?: "signed" | "sent" | "not_sent" | "cancelled";
  referredBy?: string;
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
  name?: string;
  email?: string;
  address?: string;
  listingTitle?: string;
  phone?: string;
  hasListing?: HasListing;
  plan?: string;
  bookedBy?: string;
  closedBy?: string;
  contractStatus?: "" | "signed" | "sent" | "not_sent" | "cancelled";
  referredBy?: string;
  onboardingUnitId?: string | null;
  clientId?: string | null;
  contractId?: string | null;
  contractPlanTier?: string | null;
  contractTerm?: string | null;
  contractLaunchPayment?: string | null;
  contractBenchmarks?: Record<string, number> | null;
  contractIsBlank?: boolean | null;
};

export type LeadProfileUpdate = {
  property_address?: string;
  property_place_id?: string;
  property_city?: string;
  full_name?: string;
  ownership?: string;
  airbnb_live?: boolean | null;
  permit_status?: string;
  furnished?: string;
  occupants?: string;
  occupant_notes?: string;
};

const SALE_COLUMNS = ["plan", "booked_by", "closed_by", "contract_status", "referred_by", "onboarding_unit_id"];
/** Only treat as missing columns when Postgres says the column is absent — not check-constraint failures. */
const saleColumnMissing = (message: string) => {
  if (!/does not exist|Could not find/i.test(message)) return [];
  return SALE_COLUMNS.filter((c) => new RegExp(`\\b${c}\\b`, "i").test(message));
};
export const SALE_COLUMNS_NOTE = "Run supabase/onboarding_v4.sql in Supabase, then retry.";
export const CONTRACT_STATUS_NOTE =
  "Run supabase/crm_contract_status_v1.sql in Supabase, then retry.";

export function mapLead(row: Record<string, unknown>): LeadRow {
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
    plan: String(row.plan ?? ""),
    booked_by: String(row.booked_by ?? ""),
    closed_by: String(row.closed_by ?? ""),
    contract_status: (["signed", "sent", "not_sent", "cancelled"].includes(String(row.contract_status ?? ""))
      ? String(row.contract_status)
      : "") as LeadRow["contract_status"],
    referred_by: String(row.referred_by ?? ""),
    onboarding_unit_id: (row.onboarding_unit_id as string | null) ?? null,
    client_id: (row.client_id as string | null) ?? null,
    contract_id: row.contract_id != null && String(row.contract_id).trim() ? String(row.contract_id) : null,
    contract_plan_tier: String(row.contract_plan_tier ?? ""),
    contract_term: String(row.contract_term ?? ""),
    contract_launch_payment: String(row.contract_launch_payment ?? ""),
    contract_benchmarks:
      row.contract_benchmarks && typeof row.contract_benchmarks === "object" && !Array.isArray(row.contract_benchmarks)
        ? (row.contract_benchmarks as Record<string, number>)
        : null,
    contract_is_blank: Boolean(row.contract_is_blank),
    property_address: String(row.property_address ?? ""),
    property_place_id: String(row.property_place_id ?? ""),
    property_city: String(row.property_city ?? ""),
    full_name: String(row.full_name ?? ""),
    ownership: String(row.ownership ?? ""),
    airbnb_live:
      row.airbnb_live === true ? true : row.airbnb_live === false ? false : null,
    furnished: String(row.furnished ?? ""),
    occupants: String(row.occupants ?? ""),
    occupant_notes: String(row.occupant_notes ?? ""),
    str_rules_checked_at: (row.str_rules_checked_at as string | null) ?? null,
    str_rules_city: String(row.str_rules_city ?? ""),
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

  const sale: Record<string, unknown> = {};
  if (input.plan) sale.plan = input.plan;
  if (input.bookedBy) sale.booked_by = input.bookedBy;
  if (input.closedBy) sale.closed_by = input.closedBy;
  if (input.contractStatus) sale.contract_status = input.contractStatus;
  if (input.referredBy) sale.referred_by = input.referredBy;

  const { data, error } = await sb
    .from("leads")
    .insert({
      ...sale,
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
    if (Object.keys(sale).length && saleColumnMissing(error.message).length) {
      throw new Error("The CRM is missing the sale columns. " + SALE_COLUMNS_NOTE);
    }
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
  if (patch.name !== undefined) {
    update.name = patch.name;
  }
  if (patch.email !== undefined) {
    update.email = patch.email;
  }
  if (patch.address !== undefined) {
    update.address = patch.address;
  }
  if (patch.listingTitle !== undefined) {
    update.listing_title = patch.listingTitle;
  }
  if (patch.phone !== undefined) {
    update.phone = patch.phone;
  }
  if (patch.hasListing !== undefined) {
    update.has_listing = patch.hasListing;
  }
  if (patch.plan !== undefined) update.plan = patch.plan || null;
  if (patch.bookedBy !== undefined) update.booked_by = patch.bookedBy || null;
  if (patch.closedBy !== undefined) update.closed_by = patch.closedBy || null;
  if (patch.contractStatus !== undefined) update.contract_status = patch.contractStatus || null;
  if (patch.referredBy !== undefined) update.referred_by = patch.referredBy || null;
  if (patch.onboardingUnitId !== undefined) update.onboarding_unit_id = patch.onboardingUnitId;
  if (patch.clientId !== undefined) update.client_id = patch.clientId || null;
  if (patch.contractId !== undefined) update.contract_id = patch.contractId || null;
  if (patch.contractPlanTier !== undefined) update.contract_plan_tier = patch.contractPlanTier || null;
  if (patch.contractTerm !== undefined) update.contract_term = patch.contractTerm || null;
  if (patch.contractLaunchPayment !== undefined) {
    update.contract_launch_payment = patch.contractLaunchPayment || null;
  }
  if (patch.contractBenchmarks !== undefined) update.contract_benchmarks = patch.contractBenchmarks;
  if (patch.contractIsBlank !== undefined) update.contract_is_blank = Boolean(patch.contractIsBlank);

  if (Object.keys(update).length === 0) return null;

  const { data, error } = await sb
    .from("leads")
    .update(update)
    .eq("id", leadId)
    .select("*")
    .single();

  if (error) {
    if (saleColumnMissing(error.message).some((c) => update[c] !== undefined)) {
      throw new Error("The CRM is missing the sale columns. " + SALE_COLUMNS_NOTE);
    }
    if (
      update.contract_status !== undefined &&
      /leads_contract_status_check|check constraint.*contract_status/i.test(error.message)
    ) {
      throw new Error(
        `Contract status "${String(update.contract_status)}" is not allowed yet. ${CONTRACT_STATUS_NOTE}`,
      );
    }
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

const PROFILE_COLUMNS_NOTE = "Run supabase/crm_profile_v1.sql in Supabase, then retry.";

/** Partial update of sales-call property profile fields. */
export async function updateLeadProfile(
  leadId: string,
  patch: LeadProfileUpdate,
): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb) return false;

  const update: Record<string, unknown> = {};
  if (patch.property_address !== undefined) update.property_address = patch.property_address;
  if (patch.property_place_id !== undefined) update.property_place_id = patch.property_place_id;
  if (patch.property_city !== undefined) update.property_city = patch.property_city;
  if (patch.full_name !== undefined) update.full_name = patch.full_name;
  if (patch.ownership !== undefined) update.ownership = patch.ownership;
  if (patch.airbnb_live !== undefined) update.airbnb_live = patch.airbnb_live;
  if (patch.permit_status !== undefined) update.permit_status = patch.permit_status;
  if (patch.furnished !== undefined) update.furnished = patch.furnished;
  if (patch.occupants !== undefined) update.occupants = patch.occupants;
  if (patch.occupant_notes !== undefined) update.occupant_notes = patch.occupant_notes;

  if (Object.keys(update).length === 0) return true;

  const { error } = await sb.from("leads").update(update).eq("id", leadId);
  if (error) {
    if (/property_address|property_place_id|property_city|full_name|ownership|airbnb_live|furnished|occupants|occupant_notes|str_rules/i.test(error.message)) {
      throw new Error("The CRM is missing the property profile columns. " + PROFILE_COLUMNS_NOTE);
    }
    console.error("[leads] profile update failed", error.message);
    return false;
  }
  return true;
}

/** Stamp when STR rules were last checked for this lead's property city. */
export async function markLeadStrRulesChecked(
  leadId: string,
  city: string,
): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb) return false;
  const { error } = await sb
    .from("leads")
    .update({
      str_rules_checked_at: new Date().toISOString(),
      str_rules_city: city,
    })
    .eq("id", leadId);
  if (error) {
    console.error("[leads] str rules stamp failed", error.message);
    return false;
  }
  return true;
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
