/** OPS team member roster — assignee names for tasks. */

import { getSupabaseAdmin } from "../supabase.js";

function db() {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  return sb;
}

export type PmTeamMember = {
  id: string;
  created_at: string;
  name: string;
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function mapMember(row: Record<string, unknown>): PmTeamMember {
  return {
    id: String(row.id),
    created_at: String(row.created_at || ""),
    name: str(row.name),
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
