/** Push / link Admin properties into Cleaner Hub via ops-hub-sync edge function. */

import { getPmPropertyDetail, updatePmProperty } from "./propertyStore.js";

function cleanerSyncUrl(): string {
  const explicit = (process.env.CLEANER_HUB_SYNC_URL || "").trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const base = (process.env.CLEANER_HUB_SUPABASE_URL || "").trim().replace(/\/$/, "");
  if (base) return `${base}/functions/v1/ops-hub-sync`;
  // Default Cleaner Hub Supabase project (portal.stravo.ai).
  return "https://hyndmdjvjlsbthlqrxge.supabase.co/functions/v1/ops-hub-sync";
}

function cleanerSyncKey(): string {
  return (process.env.CLEANER_HUB_SYNC_KEY || "").trim();
}

/** Gateway JWT (anon is enough); custom auth is x-api-key inside the function. */
function cleanerAnonKey(): string {
  return (
    process.env.CLEANER_HUB_ANON_KEY ||
    process.env.CLEANER_HUB_SUPABASE_ANON_KEY ||
    ""
  ).trim();
}

function parseAddressBits(address: string): {
  city?: string;
  state_province?: string;
  postal_code?: string;
  unit?: string;
} {
  const a = address.trim();
  if (!a) return {};
  // "606, 8 Charlotte Street, Toronto, ON, M5V 0K4, CA"
  const parts = a.split(",").map((part) => part.trim()).filter(Boolean);
  const out: {
    city?: string;
    state_province?: string;
    postal_code?: string;
    unit?: string;
  } = {};
  if (parts.length >= 1 && /^[0-9]+[A-Za-z]?$/.test(parts[0]!)) {
    out.unit = parts[0];
  }
  // Heuristic: city often third-to-last before province (CA postal A1A1A1)
  const postalRe = new RegExp("^[A-Z][0-9][A-Z][0-9][A-Z][0-9]$", "i");
  const postalIdx = parts.findIndex((part) =>
    postalRe.test(part.replace(/[ \t]/g, "")),
  );
  if (postalIdx >= 0) {
    out.postal_code = parts[postalIdx];
    if (postalIdx >= 1) out.state_province = parts[postalIdx - 1];
    if (postalIdx >= 2) out.city = parts[postalIdx - 2];
  }
  return out;
}

export async function pushPropertyToCleanerHub(adminPropertyId: string): Promise<{
  hub_property_id: string;
  created: boolean;
  open_url: string;
}> {
  const key = cleanerSyncKey();
  if (!key) {
    throw new Error(
      "CLEANER_HUB_SYNC_KEY is not set on Admin. Add it to .env.local / Vercel, matching Cleaner OPS_HUB_SYNC_KEY.",
    );
  }

  const detail = await getPmPropertyDetail(adminPropertyId);
  if (!detail) throw new Error("Property not found.");
  const hid = (detail.hospitable_property_id || "").trim();
  if (!hid) {
    throw new Error("Link Hospitable UUID on this property before creating it in Cleaner Hub.");
  }

  const bits = parseAddressBits(detail.address || "");
  const anon = cleanerAnonKey();
  const existingHubId = (detail.hub_property_id || "").trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": key,
  };
  // Optional when function has verify_jwt=false; still send if configured.
  if (anon) {
    headers.Authorization = `Bearer ${anon}`;
    headers.apikey = anon;
  }
  const res = await fetch(cleanerSyncUrl(), {
    method: "POST",
    headers,
    body: JSON.stringify({
      action: "upsert_property",
      hospitable_property_id: hid,
      hub_property_id: existingHubId || undefined,
      name: detail.name,
      address: detail.address || "",
      city: bits.city || "",
      state_province: bits.state_province || "",
      postal_code: bits.postal_code || "",
      unit: bits.unit || "",
      country: "CA",
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    property_id?: string;
    created?: boolean;
  };
  if (!res.ok) {
    throw new Error(data.error || `Cleaner Hub sync failed (${res.status}).`);
  }
  const hubId = String(data.property_id || "").trim();
  if (!hubId) throw new Error("Cleaner Hub did not return a property id.");

  await updatePmProperty(adminPropertyId, { hub_property_id: hubId });

  const portal = (
    process.env.VITE_CLEANER_HUB_URL ||
    process.env.CLEANER_HUB_URL ||
    "https://portal.stravo.ai"
  ).replace(/\/$/, "");

  return {
    hub_property_id: hubId,
    created: Boolean(data.created),
    open_url: `${portal}/properties/${hubId}`,
  };
}
