import { getSupabaseAdmin } from "../supabase.js";
import { generateTempPassword, hashPassword } from "../portalAuth.js";

function db() {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  return sb;
}

export type PortalUser = {
  id: string;
  created_at: string;
  updated_at: string;
  pm_client_id: string;
  email: string;
  slug: string;
  password_hash: string;
  must_change_password: boolean;
  invite_token: string;
  invited_at: string | null;
  last_login_at: string | null;
  first_name: string;
};

function slugify(input: string): string {
  const base = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "owner";
}

export function firstNameFromFullName(name: string): string {
  const part = name.trim().split(/\s+/)[0] || "Owner";
  return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
}

export async function allocateSlug(preferred: string): Promise<string> {
  const base = slugify(preferred);
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const { data, error } = await db()
      .from("portal_users")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (error) throw error;
    if (!data) return candidate;
  }
  throw new Error("Could not allocate a unique owner slug.");
}

export async function getPortalUserById(id: string): Promise<PortalUser | null> {
  const { data, error } = await db()
    .from("portal_users")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as PortalUser | null) ?? null;
}

export async function getPortalUserBySlug(slug: string): Promise<PortalUser | null> {
  const clean = slug.trim().toLowerCase();
  if (!clean) return null;
  const { data, error } = await db()
    .from("portal_users")
    .select("*")
    .eq("slug", clean)
    .maybeSingle();
  if (error) throw error;
  return (data as PortalUser | null) ?? null;
}

export async function getPortalUserByClientId(
  clientId: string,
): Promise<PortalUser | null> {
  const { data, error } = await db()
    .from("portal_users")
    .select("*")
    .eq("pm_client_id", clientId)
    .maybeSingle();
  if (error) throw error;
  return (data as PortalUser | null) ?? null;
}

export async function createOrRefreshPortalInvite(input: {
  pm_client_id: string;
  email: string;
  fullName: string;
  slug?: string;
}): Promise<{ user: PortalUser; tempPassword: string; created: boolean }> {
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Valid email is required.");
  const firstName = firstNameFromFullName(input.fullName);
  const tempPassword = generateTempPassword();
  const password_hash = hashPassword(tempPassword);
  const now = new Date().toISOString();

  const existing = await getPortalUserByClientId(input.pm_client_id);
  if (existing) {
    const { data, error } = await db()
      .from("portal_users")
      .update({
        email,
        first_name: firstName,
        password_hash,
        must_change_password: true,
        invited_at: now,
        updated_at: now,
        invite_token: generateTempPassword(),
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return { user: data as PortalUser, tempPassword, created: false };
  }

  const slug =
    (input.slug && slugify(input.slug)) ||
    (await allocateSlug(firstNameFromFullName(input.fullName)));

  const { data, error } = await db()
    .from("portal_users")
    .insert({
      pm_client_id: input.pm_client_id,
      email,
      slug,
      password_hash,
      must_change_password: true,
      first_name: firstName,
      invited_at: now,
      invite_token: generateTempPassword(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return { user: data as PortalUser, tempPassword, created: true };
}

export async function setPortalPassword(
  userId: string,
  newPassword: string,
): Promise<PortalUser> {
  const pw = newPassword.trim();
  if (pw.length < 8) throw new Error("Password must be at least 8 characters.");
  const { data, error } = await db()
    .from("portal_users")
    .update({
      password_hash: hashPassword(pw),
      must_change_password: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return data as PortalUser;
}

export async function touchPortalLogin(userId: string): Promise<void> {
  await db()
    .from("portal_users")
    .update({
      last_login_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
}

export function publicPortalUser(user: PortalUser) {
  return {
    id: user.id,
    email: user.email,
    slug: user.slug,
    first_name: user.first_name,
    must_change_password: user.must_change_password,
    pm_client_id: user.pm_client_id,
    invited_at: user.invited_at,
    last_login_at: user.last_login_at,
  };
}
