/** Cache + sync Hospitable guest reviews. */

import { getSupabaseAdmin } from "../supabase.js";
import { getHospitablePat } from "./clientStore.js";
import {
  listHospitableReviews,
  type HospitableReviewNormalized,
} from "./hospitableClient.js";
import { listPmProperties } from "./propertyStore.js";
import { monthBounds, SYNC_STALE_MS } from "./reservationStore.js";

function db() {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  return sb;
}

export type PmReviewRow = {
  id: string;
  property_id: string;
  hospitable_review_id: string;
  hospitable_reservation_id: string;
  platform: string;
  rating: number | null;
  rating_raw: string;
  public_review: string;
  public_response: string;
  guest_first_name: string;
  check_in: string | null;
  check_out: string | null;
  reviewed_at: string | null;
  responded_at: string | null;
  category_ratings_json: Array<{ type: string; rating: number }>;
  synced_at: string;
};

async function upsertReview(
  propertyId: string,
  r: HospitableReviewNormalized,
): Promise<void> {
  let checkIn = r.check_in;
  let checkOut = r.check_out;
  // Backfill stay dates from cached reservations when the review include omits them.
  if ((!checkIn || !checkOut) && r.reservation_id) {
    try {
      const { data } = await db()
        .from("pm_reservations")
        .select("check_in, check_out")
        .eq("hospitable_reservation_id", r.reservation_id)
        .maybeSingle();
      if (data) {
        const row = data as { check_in?: string | null; check_out?: string | null };
        if (!checkIn && row.check_in) checkIn = String(row.check_in).slice(0, 10);
        if (!checkOut && row.check_out) checkOut = String(row.check_out).slice(0, 10);
      }
    } catch {
      /* ignore */
    }
  }

  const { error } = await db().from("pm_reviews").upsert(
    {
      property_id: propertyId,
      hospitable_review_id: r.id,
      hospitable_reservation_id: r.reservation_id,
      platform: r.platform,
      rating: r.rating,
      rating_raw: r.rating_raw,
      public_review: r.public_review,
      public_response: r.public_response,
      guest_first_name: r.guest_first_name,
      check_in: checkIn,
      check_out: checkOut,
      reviewed_at: r.reviewed_at,
      responded_at: r.responded_at,
      category_ratings_json: r.category_ratings,
      raw_json: r.raw,
      synced_at: new Date().toISOString(),
    },
    { onConflict: "hospitable_review_id" },
  );
  if (error) {
    if (/pm_reviews|relation|column/i.test(error.message || "")) {
      throw new Error(
        "Reviews table missing. Run supabase/pm_reviews_v1.sql in Supabase, then retry.",
      );
    }
    throw error;
  }
}

export async function syncHospitableReviews(input?: {
  propertyId?: string;
}): Promise<{ synced: number; properties: number }> {
  const pat = await getHospitablePat();
  if (!pat) throw new Error("Hospitable is not connected.");

  const props = await listPmProperties();
  const targets = props.filter((p) => {
    if (!p.hospitable_property_id) return false;
    if (input?.propertyId) return p.id === input.propertyId;
    return p.active !== false;
  });
  if (!targets.length) {
    throw new Error(
      input?.propertyId
        ? "Property is not linked to Hospitable."
        : "No linked Hospitable properties to sync reviews.",
    );
  }

  let synced = 0;
  for (const target of targets) {
    const rows = await listHospitableReviews({
      pat,
      propertyId: target.hospitable_property_id,
    });
    for (const r of rows) {
      await upsertReview(target.id, r);
      synced += 1;
    }
  }

  return { synced, properties: targets.length };
}

export async function latestReviewSyncAt(
  propertyId: string,
): Promise<string | null> {
  const { data, error } = await db()
    .from("pm_reviews")
    .select("synced_at")
    .eq("property_id", propertyId)
    .order("synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (/pm_reviews|relation/i.test(error.message || "")) return null;
    throw error;
  }
  return typeof data?.synced_at === "string" ? data.synced_at : null;
}

export async function propertyNeedsReviewSync(
  propertyId: string,
): Promise<{ needed: boolean; reason: string }> {
  const latest = await latestReviewSyncAt(propertyId);
  if (!latest) return { needed: true, reason: "never_synced" };
  const age = Date.now() - new Date(latest).getTime();
  if (!Number.isFinite(age) || age > SYNC_STALE_MS) {
    return { needed: true, reason: "stale" };
  }
  return { needed: false, reason: "fresh" };
}

function mapReviewRow(row: Record<string, unknown>): PmReviewRow {
  const cats = row.category_ratings_json;
  return {
    id: String(row.id),
    property_id: String(row.property_id),
    hospitable_review_id: String(row.hospitable_review_id || ""),
    hospitable_reservation_id: String(row.hospitable_reservation_id || ""),
    platform: String(row.platform || ""),
    rating:
      row.rating == null || row.rating === ""
        ? null
        : Number(row.rating),
    rating_raw: String(row.rating_raw || ""),
    public_review: String(row.public_review || ""),
    public_response: String(row.public_response || ""),
    guest_first_name: String(row.guest_first_name || ""),
    check_in: (row.check_in as string) || null,
    check_out: (row.check_out as string) || null,
    reviewed_at: (row.reviewed_at as string) || null,
    responded_at: (row.responded_at as string) || null,
    category_ratings_json: Array.isArray(cats)
      ? (cats as Array<{ type: string; rating: number }>)
      : [],
    synced_at: String(row.synced_at || ""),
  };
}

/** Reviews attributed to a calendar month (prefer checkout, else reviewed_at). */
export async function listReviewsForPropertyMonth(
  propertyId: string,
  yearMonth: string,
): Promise<PmReviewRow[]> {
  const { start, end } = monthBounds(yearMonth);
  const { data, error } = await db()
    .from("pm_reviews")
    .select("*")
    .eq("property_id", propertyId)
    .order("reviewed_at", { ascending: true });
  if (error) {
    if (/pm_reviews|relation/i.test(error.message || "")) return [];
    throw error;
  }
  return (data ?? [])
    .map((r) => mapReviewRow(r as Record<string, unknown>))
    .filter((r) => reviewMatchesMonth(r, start, end));
}

/** Reviews attributed to a calendar month.
 * Match if the stay checked out in-month OR the guest left the review in-month.
 * (Checkout-only missed reviews posted after month-end; reviewed_at-only missed
 * when reservation dates were missing from the Hospitable include.)
 */
function reviewInMonth(r: PmReviewRow, start: string, end: string): boolean {
  if (r.check_out) {
    const out = r.check_out.slice(0, 10);
    if (out >= start && out <= end) return true;
  }
  if (r.reviewed_at) {
    const day = r.reviewed_at.slice(0, 10);
    if (day >= start && day <= end) return true;
  }
  return false;
}

/** Also keep reviews whose reservation id matches a stay in the month. */
export function reviewMatchesMonth(
  r: PmReviewRow,
  start: string,
  end: string,
  monthReservationIds?: Set<string>,
): boolean {
  if (reviewInMonth(r, start, end)) return true;
  if (
    monthReservationIds &&
    r.hospitable_reservation_id &&
    monthReservationIds.has(r.hospitable_reservation_id)
  ) {
    return true;
  }
  return false;
}

export async function listReviewsForPropertiesInRange(
  propertyIds: string[],
  startDate: string,
  endDate: string,
  monthReservationIds?: Set<string>,
): Promise<PmReviewRow[]> {
  if (!propertyIds.length) return [];
  const { data, error } = await db()
    .from("pm_reviews")
    .select("*")
    .in("property_id", propertyIds)
    .order("reviewed_at", { ascending: true });
  if (error) {
    if (/pm_reviews|relation/i.test(error.message || "")) return [];
    throw error;
  }
  return (data ?? [])
    .map((r) => mapReviewRow(r as Record<string, unknown>))
    .filter((r) =>
      reviewMatchesMonth(r, startDate, endDate, monthReservationIds),
    );
}

export async function listReviewsForPropertiesSince(
  propertyIds: string[],
  sinceIso: string,
  untilIso: string,
): Promise<PmReviewRow[]> {
  if (!propertyIds.length) return [];
  const { data, error } = await db()
    .from("pm_reviews")
    .select("*")
    .in("property_id", propertyIds)
    .gte("reviewed_at", sinceIso)
    .lte("reviewed_at", untilIso)
    .order("reviewed_at", { ascending: true });
  if (error) {
    if (/pm_reviews|relation/i.test(error.message || "")) return [];
    throw error;
  }
  return (data ?? []).map((r) => mapReviewRow(r as Record<string, unknown>));
}

/** Fill missing check_in/out on reviews from pm_reservations (no Hospitable call). */
export async function backfillReviewStayDates(
  propertyIds: string[],
): Promise<number> {
  if (!propertyIds.length) return 0;
  const { data: reviews, error } = await db()
    .from("pm_reviews")
    .select("id, hospitable_reservation_id, check_in, check_out")
    .in("property_id", propertyIds)
    .neq("hospitable_reservation_id", "");
  if (error) {
    if (/pm_reviews|relation/i.test(error.message || "")) return 0;
    throw error;
  }
  const needing = (reviews ?? []).filter((row) => {
    const r = row as {
      check_in?: string | null;
      check_out?: string | null;
      hospitable_reservation_id?: string;
    };
    return Boolean(r.hospitable_reservation_id) && (!r.check_in || !r.check_out);
  });
  if (!needing.length) return 0;

  const resIds = [
    ...new Set(
      needing.map((r) =>
        String((r as { hospitable_reservation_id: string }).hospitable_reservation_id),
      ),
    ),
  ];
  const { data: resRows, error: resErr } = await db()
    .from("pm_reservations")
    .select("hospitable_reservation_id, check_in, check_out")
    .in("hospitable_reservation_id", resIds);
  if (resErr) throw resErr;
  const byRes = new Map(
    (resRows ?? []).map((row) => {
      const r = row as {
        hospitable_reservation_id: string;
        check_in: string | null;
        check_out: string | null;
      };
      return [r.hospitable_reservation_id, r] as const;
    }),
  );

  let updated = 0;
  await Promise.all(
    needing.map(async (row) => {
      const r = row as {
        id: string;
        hospitable_reservation_id: string;
        check_in: string | null;
        check_out: string | null;
      };
      const match = byRes.get(r.hospitable_reservation_id);
      if (!match) return;
      const check_in = r.check_in || match.check_in;
      const check_out = r.check_out || match.check_out;
      if (check_in === r.check_in && check_out === r.check_out) return;
      const { error: upErr } = await db()
        .from("pm_reviews")
        .update({ check_in, check_out })
        .eq("id", r.id);
      if (!upErr) updated += 1;
    }),
  );
  return updated;
}
