/**
 * Resolve local app IDs from the canonical Hospitable property UUID
 * using the Admin OPS registry (`pm_properties`).
 */
import { getSupabaseAdmin } from "../supabase.js";

export type PropertyIdentityMap = {
  adminPropertyId: string;
  hospitablePropertyId: string;
  hubPropertyId: string;
  guidebookPropertyId: string;
  name: string;
  clientId: string;
};

function db() {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  return sb;
}

export async function resolveByHospitablePropertyId(
  hospitablePropertyId: string,
): Promise<PropertyIdentityMap | null> {
  const hid = hospitablePropertyId.trim();
  if (!hid) return null;
  const { data, error } = await db()
    .from("pm_properties")
    .select(
      "id, name, client_id, hospitable_property_id, hub_property_id, guidebook_property_id",
    )
    .eq("hospitable_property_id", hid)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    adminPropertyId: String(data.id),
    hospitablePropertyId: String(data.hospitable_property_id || "").trim(),
    hubPropertyId: String(data.hub_property_id || "").trim(),
    guidebookPropertyId: String(data.guidebook_property_id || "").trim(),
    name: String(data.name || ""),
    clientId: String(data.client_id || ""),
  };
}
