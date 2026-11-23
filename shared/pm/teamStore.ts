/** OPS team member roster — assignee names for tasks. */

import { getSupabaseAdmin } from "../supabase.js";

function db() {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  return sb;
}

export const STAFF_TYPES = ["onboarder", "va", "software", "booker", "operations", "partner"] as const;
export type StaffType = (typeof STAFF_TYPES)[number] | "";

export type PmTeamMember = {
  id: string;
  created_at: string;
  name: string;
  /** What kind of team member this is. Empty until a partner sets it. */
  staff_type: StaffType;
  /** Optional cell for CRM caller dropdown. */
  phone: string;
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function mapMember(row: Record<string, unknown>): PmTeamMember {
  return {
    id: String(row.id),
    created_at: String(row.created_at || ""),
    name: str(row.name),
    staff_type: (STAFF_TYPES as readonly string[]).includes(str(row.staff_type)) ? (str(row.staff_type) as StaffType) : "",
    phone: str(row.phone),
  };
}

export async function listPmTeamMembers(): Promise<PmTeamMember[]> {
  const { data, error } = await db()
    .from("pm_team_members")
    .select("*")
    .order("name", { ascending: true });
  if (error) {
    if (/pm_team_members|relation/i.test(error.message || "")) {
      throw new Error(
        "Team members table missing. Run supabase/pm_team_members_v1.sql in Supabase, then retry.",
      );
    }
    throw error;
  }
  return (data ?? []).map((r) => mapMember(r as Record<string, unknown>));
}

export async function createPmTeamMember(input: {
  name: string;
}): Promise<PmTeamMember> {
  const name = str(input.name);
  if (!name) throw new Error("Name is required.");

  const { data: existing } = await db()
    .from("pm_team_members")
    .select("*")
    .ilike("name", name)
    .maybeSingle();
  if (existing) {
    return mapMember(existing as Record<string, unknown>);
  }

  const { data, error } = await db()
    .from("pm_team_members")
    .insert({ name })
    .select("*")
    .single();
  if (error) {
    if (/pm_team_members|relation/i.test(error.message || "")) {
      throw new Error(
        "Team members table missing. Run supabase/pm_team_members_v1.sql in Supabase, then retry.",
      );
    }
    if (/unique|duplicate/i.test(error.message || "")) {
      const { data: again } = await db()
        .from("pm_team_members")
        .select("*")
        .ilike("name", name)
        .maybeSingle();
      if (again) return mapMember(again as Record<string, unknown>);
    }
    throw error;
  }
  return mapMember(data as Record<string, unknown>);
}

export async function deletePmTeamMember(id: string): Promise<void> {
  const { error } = await db().from("pm_team_members").delete().eq("id", id);
  if (error) throw error;
}

/** Sets what kind of team member someone is. The roster row is created first when the name is not on it yet. */
export async function setPmTeamMemberType(input: { name: string; staff_type: string }): Promise<PmTeamMember> {
  const type = str(input.staff_type);
  if (type && !(STAFF_TYPES as readonly string[]).includes(type)) throw new Error("Unknown staff type.");
  const member = await createPmTeamMember({ name: str(input.name) });
  const { data, error } = await db()
    .from("pm_team_members")
    .update({ staff_type: type })
    .eq("id", member.id)
    .select("*")
    .single();
  if (error) {
    const msg = error.message || "";
    if (/staff_type/i.test(msg)) {
      if (/check|violates|invalid|not.?in/i.test(msg)) {
        throw new Error(
          "That staff type is blocked by the database check (booker was missing). Run supabase/staff_type_booker_v1.sql in Supabase, then retry.",
        );
      }
      throw new Error(
        "Staff type column missing. Run supabase/onboarding_v1.sql (or staff_type_booker_v1.sql) in Supabase, then retry.",
      );
    }
    throw error;
  }
  return mapMember(data as Record<string, unknown>);
}

/** Team members with a phone set — for the CRM “whose phone rings first” dropdown. */
export async function listTeamCallers(): Promise<Array<{ name: string; phone: string }>> {
  const { data, error } = await db()
    .from("pm_team_members")
    .select("name, phone")
    .not("phone", "is", null)
    .order("name", { ascending: true });
  if (error) {
    if (/phone|pm_team_members|relation/i.test(error.message || "")) {
      throw new Error(
        "Team phone column missing. Run supabase/crm_caller_v1.sql in Supabase, then retry.",
      );
    }
    throw error;
  }
  return (data ?? [])
    .map((r) => ({
      name: str((r as Record<string, unknown>).name),
      phone: str((r as Record<string, unknown>).phone),
    }))
    .filter((r) => r.phone);
}

/** Saves a phone number on a roster row (CRM caller dropdown). */
export async function setPmTeamMemberPhone(input: {
  id: string;
  phone: string;
}): Promise<PmTeamMember> {
  const id = str(input.id);
  if (!id) throw new Error("id required.");
  const phone = str(input.phone);
  const { data, error } = await db()
    .from("pm_team_members")
    .update({ phone: phone || null })
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    if (/phone/i.test(error.message || "")) {
      throw new Error("Phone column missing. Run supabase/crm_caller_v1.sql in Supabase, then retry.");
    }
    throw error;
  }
  return mapMember(data as Record<string, unknown>);
}
