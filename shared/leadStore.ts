import type { HasListing } from "./auditEmails.js";
import {
  normalizeNextActions,
  type LeadStatus,
  type NeedsFrom,
  type NextAction,
} from "./crmTypes.js";
import { getSupabaseAdmin, isSupabaseConfigured } from "./supabase.js";

export type { LeadStatus, NeedsFrom, NextAction } from "./crmTypes.js";
export {
  LEAD_STATUSES,
  STATUS_LABEL,
  NEXT_ACTION_PRESETS,
  NEEDS_FROM_LABEL,
  normalizeNextActions,
  openActionsForShane,
} from "./crmTypes.js";

export type LeadRow = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  earnings: string;
  has_listing: HasListing;
  call_start_iso: string | null;
  call_booking: string;
  source: string;
  marketing_opt_in: boolean;
  property_stage: string | null;
  permit_status: string | null;
  launch_timeline: string | null;
  status: LeadStatus;
  notes: string;
  next_actions: NextAction[];
  needs_from: NeedsFrom;
  notes_updated_at: string | null;
  qualified_at: string | null;
};

export type InsertLeadInput = {
  name: string;
  email: string;
  phone: string;
  address: string;
  earnings: string;
  hasListing: HasListing;
  callStartIso: string;
  callBooking: string;
  source: string;
  marketingOptIn: boolean;
};

export type QualifierInput = {
  propertyStage: string;
  permitStatus: string;
  launchTimeline: string;
};

export type LeadCrmUpdate = {
  status?: LeadStatus;
  notes?: string;
  nextActions?: NextAction[];
  needsFrom?: NeedsFrom;
};

function mapLead(row: Record<string, unknown>): LeadRow {
  const needs = String(row.needs_from ?? "none");
  const needsFrom: NeedsFrom =
    needs === "shane" || needs === "partner" || needs === "client" || needs === "none"
      ? needs
      : "none";

  return {
    id: String(row.id),
    created_at: String(row.created_at),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    phone: String(row.phone ?? ""),
    address: String(row.address ?? ""),
    earnings: String(row.earnings ?? ""),
    has_listing: (row.has_listing as LeadRow["has_listing"]) || "unknown",
    call_start_iso: (row.call_start_iso as string | null) ?? null,
    call_booking: String(row.call_booking ?? ""),
    source: String(row.source ?? ""),
    marketing_opt_in: Boolean(row.marketing_opt_in),
    property_stage: (row.property_stage as string | null) ?? null,
    permit_status: (row.permit_status as string | null) ?? null,
    launch_timeline: (row.launch_timeline as string | null) ?? null,
    status: (row.status as LeadStatus) || "new",
    notes: String(row.notes ?? ""),
    next_actions: normalizeNextActions(row.next_actions),
    needs_from: needsFrom,
    notes_updated_at: (row.notes_updated_at as string | null) ?? null,
    qualified_at: (row.qualified_at as string | null) ?? null,
  };
}

export function suggestStatusFromQualifier(q: QualifierInput): LeadStatus {
  if (
    q.propertyStage === "researching" ||
    q.permitStatus === "not_planning" ||
    q.launchTimeline === "later"
  ) {
    return "low_fit";
  }
  return "qualified";
}

export async function insertLead(input: InsertLeadInput): Promise<string | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;

  const { data, error } = await sb
    .from("leads")
    .insert({
      name: input.name,
      email: input.email,
      phone: input.phone,
      address: input.address,
      earnings: input.earnings,
      has_listing: input.hasListing,
      call_start_iso: input.callStartIso || null,
      call_booking: input.callBooking,
      source: input.source,
      marketing_opt_in: input.marketingOptIn,
      status: "new",
      next_actions: [],
      needs_from: "none",
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
      launch_timeline: q.launchTimeline,
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

export async function updateLeadStatus(
  leadId: string,
  status: LeadStatus,
): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb) return false;

  const { error } = await sb.from("leads").update({ status }).eq("id", leadId);
  if (error) {
    console.error("[leads] status update failed", error.message);
    return false;
  }
  return true;
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
  if (patch.nextActions !== undefined) update.next_actions = patch.nextActions;
  if (patch.needsFrom !== undefined) update.needs_from = patch.needsFrom;

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
