import { getSupabaseAdmin } from "../supabase.js";
import { getHospitablePat } from "./clientStore.js";
import {
  listHospitableReservations,
  type HospitableReservationNormalized,
} from "./hospitableClient.js";
import { listPmProperties } from "./propertyStore.js";

function db() {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  return sb;
}

export type PmReservationRow = {
  id: string;
  property_id: string;
  hospitable_reservation_id: string;
  platform: string;
  platform_id: string;
  status: string;
  check_in: string | null;
  check_out: string | null;
  nights: number;
  currency: string;
  gross_cents: number;
  host_payout_cents: number;
  financials_json: Record<string, unknown>;
  synced_at: string;
};

export function monthBounds(yearMonth: string): { start: string; end: string } {
  const [y, m] = yearMonth.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  const end = `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { start, end };
}

export function previousYearMonth(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function upsertReservation(
  propertyId: string,
  r: HospitableReservationNormalized,
): Promise<void> {
  const { error } = await db().from("pm_reservations").upsert(
    {
      property_id: propertyId,
      hospitable_reservation_id: r.id,
      platform: r.platform,
      platform_id: r.platform_id,
      status: r.status,
      check_in: r.check_in,
      check_out: r.check_out,
      nights: r.nights,
      currency: r.currency,
      gross_cents: r.gross_cents,
      host_payout_cents: r.host_payout_cents,
      financials_json: r.financials,
      raw_json: r.raw,
      synced_at: new Date().toISOString(),
    },
    { onConflict: "hospitable_reservation_id" },
  );
  if (error) throw error;
}

/** Sync reservations for one property or all linked properties for a month. */
export async function syncHospitableReservations(input: {
  yearMonth: string;
  propertyId?: string;
}): Promise<{ synced: number; properties: number }> {
  const pat = await getHospitablePat();
  if (!pat) throw new Error("Hospitable is not connected.");

  const props = await listPmProperties();
  const targets = props.filter((p) => {
    if (!p.hospitable_property_id) return false;
    if (input.propertyId) return p.id === input.propertyId;
    return true;
  });
  if (!targets.length) {
    throw new Error(
      input.propertyId
        ? "Property is not linked to Hospitable."
        : "No linked Hospitable properties to sync.",
    );
  }

  const { start, end } = monthBounds(input.yearMonth);
  const byHospitable = new Map(
    targets.map((t) => [t.hospitable_property_id, t.id] as const),
  );

  let synced = 0;

  // Sync per property so assignment is unambiguous
  for (const target of targets) {
    const rows = await listHospitableReservations({
      pat,
      propertyIds: [target.hospitable_property_id],
      startDate: start,
      endDate: end,
    });
    for (const r of rows) {
      if (r.check_out && (r.check_out < start || r.check_out > end)) continue;
      // Prefer map when API returns property id; else this target
      const mapped =
        (r.property_id && byHospitable.get(r.property_id)) || target.id;
      await upsertReservation(mapped, r);
      synced += 1;
    }
  }

  try {
    await db()
      .from("pm_settings")
      .upsert(
        {
          id: 1,
          hospitable_last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
  } catch {
    /* optional until migration */
  }

  return { synced, properties: targets.length };
}

export async function listReservationsForPropertyMonth(
  propertyId: string,
  yearMonth: string,
): Promise<PmReservationRow[]> {
  const { start, end } = monthBounds(yearMonth);
  const { data, error } = await db()
    .from("pm_reservations")
    .select(
      "id, property_id, hospitable_reservation_id, platform, platform_id, status, check_in, check_out, nights, currency, gross_cents, host_payout_cents, financials_json, synced_at",
    )
    .eq("property_id", propertyId)
    .gte("check_out", start)
    .lte("check_out", end)
    .order("check_out", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PmReservationRow[];
}
