import type { HasListing } from "./auditEmails.js";
import { type LeadStatus } from "./crmTypes.js";
import { getSupabaseAdmin, isSupabaseConfigured } from "./supabase.js";

export type { LeadStatus } from "./crmTypes.js";
export { LEAD_STATUSES, STATUS_LABEL } from "./crmTypes.js";

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
  whats_next: string;
  notes_updated_at: string | null;
  qualified_at: string | null;
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
  whatsNext?: string;
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
    status: (row.status as LeadStatus) || "new",
    notes: String(row.notes ?? ""),
    whats_next: String(row.whats_next ?? ""),
    notes_updated_at: (row.notes_updated_at as string | null) ?? null,
    qualified_at: (row.qualified_at as string | null) ?? null,
  };
}

export function suggestStatusFromQualifier(q: QualifierInput): LeadStatus {
  if (
    q.propertyStage === "researching" ||
    q.permitStatus === "not_planning" ||
    q.strAllowed === "no" ||
    q.launchTimeline === "later"
  ) {
    return "low_fit";
  }
  return "qualified";
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
      qualified_at:
        status === "qualified" || hasNoQualifier ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[leads] insert failed", error.message);
    return null;
  }
  return data?.id ?? null;
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

export async function listLeads(limit = 100): Promise<LeadRow[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];

  const { data, error } = await sb
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

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
  if (patch.whatsNext !== undefined) {
    update.whats_next = patch.whatsNext;
    update.notes_updated_at = new Date().toISOString();
  }

  if (Object.keys(update).length === 0) return null;

  const { data, error } = await sb
    .from("leads")
    .update(update)
    .eq("id", leadId)
    .select("*")
    .single();

  if (error) {
    console.error("[leads] crm update failed", error.message);
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
  const sb = getSupabaseAdmin();
  if (!sb) return null;

  const emailNorm = email.trim().toLowerCase();
  if (emailNorm) {
    const { data, error } = await sb
      .from("leads")
      .select("*")
      .ilike("email", emailNorm)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && data) return mapLead(data as Record<string, unknown>);
  }

  const want = normalizePhoneDigits(phone);
  if (want.length >= 7) {
    const { data, error } = await sb
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error || !data) return null;
    for (const row of data) {
      const existing = normalizePhoneDigits(String(row.phone ?? ""));
      if (existing && (existing === want || existing.endsWith(want) || want.endsWith(existing))) {
        return mapLead(row as Record<string, unknown>);
      }
    }
  }

  return null;
}
