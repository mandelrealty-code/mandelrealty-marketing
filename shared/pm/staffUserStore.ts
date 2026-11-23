import { getSupabaseAdmin } from "../supabase.js";
import {
  generateTempPassword,
  hashPassword,
} from "../staffAuth.js";
import {
  createPmTeamMember,
  STAFF_TYPES,
  type StaffType,
} from "./teamStore.js";

function db() {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  return sb;
}

export type StaffUser = {
  id: string;
  created_at: string;
  updated_at: string;
  email: string;
  slug: string;
  display_name: string;
  first_name: string;
  password_hash: string;
  must_change_password: boolean;
  invite_token: string;
  invited_at: string | null;
  last_login_at: string | null;
  active: boolean;
  /** When set, login is blocked. Ops data is never deleted. */
  deactivated_at: string | null;
};

function mapStaffUser(row: Record<string, unknown>): StaffUser {
  return {
    id: String(row.id),
    created_at: String(row.created_at || ""),
    updated_at: String(row.updated_at || ""),
    email: str(row.email),
    slug: str(row.slug),
    display_name: str(row.display_name),
    first_name: str(row.first_name),
    password_hash: String(row.password_hash || ""),
    must_change_password: Boolean(row.must_change_password),
    invite_token: str(row.invite_token),
    invited_at: row.invited_at ? String(row.invited_at) : null,
    last_login_at: row.last_login_at ? String(row.last_login_at) : null,
    active: row.active !== false,
    deactivated_at: row.deactivated_at ? String(row.deactivated_at) : null,
  };
}

/** True when the account must not log in (flag or deactivated_at). */
export function isStaffLoginBlocked(user: StaffUser): boolean {
  return !user.active || Boolean(user.deactivated_at);
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function slugify(input: string): string {
  const base = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "team";
}

export function firstNameFromFullName(name: string): string {
  const part = name.trim().split(/\s+/)[0] || "Team";
  return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
}

function missingTableError(error: { message?: string }): Error | null {
  if (/staff_users|relation|does not exist/i.test(error.message || "")) {
    return new Error(
      "Staff portal table missing. Run supabase/staff_portal_v1.sql in Supabase, then retry.",
    );
  }
  return null;
}

export async function allocateStaffSlug(preferred: string): Promise<string> {
  const base = slugify(preferred);
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const { data, error } = await db()
      .from("staff_users")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (error) {
      const mapped = missingTableError(error);
      if (mapped) throw mapped;
      throw error;
    }
    if (!data) return candidate;
  }
  throw new Error("Could not allocate a unique team slug.");
}

export async function getStaffUserById(id: string): Promise<StaffUser | null> {
  const { data, error } = await db()
    .from("staff_users")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    const mapped = missingTableError(error);
    if (mapped) throw mapped;
    throw error;
  }
  return data ? mapStaffUser(data as Record<string, unknown>) : null;
}

export async function getStaffUserBySlug(slug: string): Promise<StaffUser | null> {
  const clean = slug.trim().toLowerCase();
  if (!clean) return null;
  const { data, error } = await db()
    .from("staff_users")
    .select("*")
    .eq("slug", clean)
    .maybeSingle();
  if (error) {
    const mapped = missingTableError(error);
    if (mapped) throw mapped;
    throw error;
  }
  return data ? mapStaffUser(data as Record<string, unknown>) : null;
}

export async function listStaffUsers(): Promise<StaffUser[]> {
  const { data, error } = await db()
    .from("staff_users")
    .select("*")
    .order("display_name", { ascending: true });
  if (error) {
    const mapped = missingTableError(error);
    if (mapped) throw mapped;
    throw error;
  }
  return (data ?? []).map((row) => mapStaffUser(row as Record<string, unknown>));
}

/**
 * Look up roster role by display name (case-insensitive).
 * Returns '' when no pm_team_members row matches.
 */
export async function getStaffType(displayName: string): Promise<StaffType | ""> {
  const name = str(displayName);
  if (!name) return "";
  const { data, error } = await db()
    .from("pm_team_members")
    .select("staff_type, name")
    .limit(200);
  if (error) {
    // Roster missing or unreadable — portals fall back to TasksBoard
    if (/pm_team_members|relation|does not exist/i.test(error.message || "")) return "";
    throw error;
  }
  const needle = name.toLowerCase();
  const row = (data ?? []).find(
    (r) => str((r as { name?: unknown }).name).toLowerCase() === needle,
  ) as { staff_type?: unknown } | undefined;
  if (!row) return "";
  const t = str(row.staff_type);
  return (STAFF_TYPES as readonly string[]).includes(t) ? (t as StaffType) : "";
}

export async function createOrRefreshStaffInvite(input: {
  email: string;
  displayName: string;
  slug?: string;
}): Promise<{ user: StaffUser; tempPassword: string; created: boolean }> {
  const email = str(input.email).toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Valid email is required.");
  const displayName = str(input.displayName);
  if (!displayName) throw new Error("Display name is required.");

  const firstName = firstNameFromFullName(displayName);
  const tempPassword = generateTempPassword();
  const password_hash = hashPassword(tempPassword);
  const now = new Date().toISOString();

  // Keep OPS assignee roster in sync
  await createPmTeamMember({ name: displayName }).catch(() => null);

  const { data: byEmail } = await db()
    .from("staff_users")
    .select("*")
    .ilike("email", email)
    .maybeSingle();

  if (byEmail) {
    const { data, error } = await db()
      .from("staff_users")
      .update({
        email,
        display_name: displayName,
        first_name: firstName,
        password_hash,
        must_change_password: true,
        invited_at: now,
        updated_at: now,
        invite_token: generateTempPassword(),
        active: true,
        deactivated_at: null,
      })
      .eq("id", (byEmail as StaffUser).id)
      .select("*")
      .single();
    if (error) {
      const mapped = missingTableError(error);
      if (mapped) throw mapped;
      throw error;
    }
    return {
      user: mapStaffUser(data as Record<string, unknown>),
      tempPassword,
      created: false,
    };
  }

  const slug =
    (input.slug && slugify(input.slug)) || (await allocateStaffSlug(firstName));

  const { data, error } = await db()
    .from("staff_users")
    .insert({
      email,
      slug,
      display_name: displayName,
      first_name: firstName,
      password_hash,
      must_change_password: true,
      invited_at: now,
      invite_token: generateTempPassword(),
      active: true,
    })
    .select("*")
    .single();
  if (error) {
    const mapped = missingTableError(error);
    if (mapped) throw mapped;
    if (/unique|duplicate/i.test(error.message || "")) {
      throw new Error(
        "That email, slug, or display name is already used by another team member.",
      );
    }
    throw error;
  }
  return {
    user: mapStaffUser(data as Record<string, unknown>),
    tempPassword,
    created: true,
  };
}

export async function setStaffPassword(
  userId: string,
  newPassword: string,
): Promise<StaffUser> {
  const pw = newPassword.trim();
  if (pw.length < 8) throw new Error("Password must be at least 8 characters.");
  const { data, error } = await db()
    .from("staff_users")
    .update({
      password_hash: hashPassword(pw),
      must_change_password: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return mapStaffUser(data as Record<string, unknown>);
}

export async function touchStaffLogin(userId: string): Promise<void> {
  await db()
    .from("staff_users")
    .update({
      last_login_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
}

export async function deleteStaffUser(id: string): Promise<void> {
  const clean = id.trim();
  if (!clean) throw new Error("id required.");
  const { error } = await db().from("staff_users").delete().eq("id", clean);
  if (error) {
    const mapped = missingTableError(error);
    if (mapped) throw mapped;
    throw error;
  }
}

/**
 * Takes an employee out: login stops; hours/tasks/units stay.
 * Sets deactivated_at when the column exists; always sets active=false.
 * Does NOT clear assignee fields anywhere.
 */
export async function deactivateStaffUser(id: string): Promise<StaffUser | null> {
  const clean = id.trim();
  if (!clean) throw new Error("id required.");
  const now = new Date().toISOString();
  const { data, error } = await db()
    .from("staff_users")
    .update({ active: false, deactivated_at: now, updated_at: now })
    .eq("id", clean)
    .select("*")
    .maybeSingle();
  if (error) {
    // Column may not exist until staff_portals_v1.sql runs — fall back to active only
    if (/deactivated_at|column/i.test(error.message || "")) {
      const fallback = await db()
        .from("staff_users")
        .update({ active: false, updated_at: now })
        .eq("id", clean)
        .select("*")
        .maybeSingle();
      if (fallback.error) {
        const mapped = missingTableError(fallback.error);
        if (mapped) throw mapped;
        throw fallback.error;
      }
      return fallback.data
        ? mapStaffUser(fallback.data as Record<string, unknown>)
        : null;
    }
    const mapped = missingTableError(error);
    if (mapped) throw mapped;
    throw error;
  }
  return data ? mapStaffUser(data as Record<string, unknown>) : null;
}

/** Alias — same as deactivateStaffUser. Never deletes ops data. */
export async function deactivateStaff(id: string): Promise<void> {
  await deactivateStaffUser(id);
}

export function publicStaffUser(user: StaffUser) {
  return {
    id: user.id,
    email: user.email,
    slug: user.slug,
    display_name: user.display_name,
    first_name: user.first_name,
    must_change_password: user.must_change_password,
    invited_at: user.invited_at,
    last_login_at: user.last_login_at,
    active: user.active,
  };
}

/** Employee portal response — never expose login/invite timestamps to them. */
export function staffUserForEmployee(user: StaffUser) {
  return {
    id: user.id,
    email: user.email,
    slug: user.slug,
    display_name: user.display_name,
    first_name: user.first_name,
    must_change_password: user.must_change_password,
    active: user.active,
  };
}
