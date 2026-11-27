/**
 * Go-live check (mrg-onboarding-go-live-check.html). Shared by the admin UI and the server so "Ready to list" is
 * gated the same way in both places.
 *
 * Part A comes from the owner report decisions (cleaner DB). Parts B to E have no data source yet, so each row is a
 * manual tick stored in the admin DB (onboarding_golive_ticks).
 */

export type ReviewDecision = "buy" | "supply" | "already_there" | "declined" | null;

/** One owner_report_items row, as the admin server returns it. Column names follow owner_report_v1.sql / v2_admin.sql. */
export type ReviewItem = {
  id: string;
  itemId: string;
  name: string;
  sectionName: string;
  reason: string;
  shortBy: number | null;
  isEssential: boolean;
  isOptional: boolean;
  suggestedProduct: string | null;
  suggestedPrice: number | null;
  qty: number;
  decision: ReviewDecision;
  note: string | null;
  supplyBy: string | null;
  location: string | null;
  waived: boolean;
  waivedReason: string | null;
  waivedAt: string | null;
  waivedBy: string | null;
  /** v3: added back to client review ("We couldn't find it"). */
  reopened: boolean;
  /** Added back and the client hasn't answered it again yet. */
  reopenPending: boolean;
};

export type ReviewReport = {
  id: string;
  /** owner_reports.status: pending_client | client_reviewing | client_responded | complete */
  status: string;
  submittedAt: string | null;
  submittedBy: string | null;
  /** Only when sent after the latest submission (a resubmitted checklist needs sending again). */
  sentAt: string | null;
  sentBy: string | null;
  viewedAt: string | null;
  respondedAt: string | null;
  ccAuthorized: boolean;
  ccHolderName: string | null;
  ccLast4: string | null;
  ccAuthorizedAt: string | null;
  /** Optional "Don't spend more than" from the authorization. */
  ccSpendingCap: number | null;
  totalToPurchase: number;
  url: string;
};

export type GoLiveTick = { state: "done" | "yes" | "no"; by: string; at: string };

export type PartARow = {
  key: string;
  label: string;
  sub: string;
  /** inst: manual "installed" tick · find: Confirmed / Couldn't find · waived: auto green · blocked: red, not tickable */
  kind: "inst" | "find" | "waived" | "blocked";
  group: string;
  /** "Couldn't find it" sent this line back to the client. */
  reopened?: boolean;
};

export const RESPONDED = ["client_responded", "complete"];

export const PARTS_BE: { k: "B" | "C" | "D" | "E"; t: string; own: "o" | "p" | "op"; rows: [string, string][] }[] = [
  {
    k: "B",
    t: "Unit ready",
    own: "o",
    rows: [
      ["b1", "All Essential counts at minimum"],
      ["b2", "Safety items tested (alarms, extinguisher)"],
      ["b3", "Labels on cupboards and supply closet"],
      ["b4", "Owner closet locked"],
      ["b5", "MRG supply closet stocked"],
      ["b6", "Signs up (WiFi QR, house rules, emergency contacts, guidebook QR)"],
      ["b7", "Welcome basket placed"],
      ["b8", "All REPAIR items fixed or waived"],
      ["b9", "Launch deep clean done"],
      ["b10", "Batteries replaced (remotes, locks, detectors)"],
    ],
  },
  {
    k: "C",
    t: "Tech tested",
    own: "o",
    rows: [
      ["c1", "Test lock code created, works, deleted"],
      ["c2", "Backup lockbox working"],
      ["c3", "WiFi speed test per room"],
      ["c4", "TV signed into MRG account"],
      ["c5", "Thermostat at default, remote access works"],
      ["c6", "Noise monitor online under MRG account"],
      ["c7", "All smart devices on MRG accounts"],
    ],
  },
  {
    k: "D",
    t: "Media",
    own: "op",
    rows: [
      ["d1", "All guidebook slots filmed and approved"],
      ["d2", "Professional listing photos done"],
      ["d3", "MagicPlan floor plan saved"],
    ],
  },
  {
    k: "E",
    t: "Listing and admin",
    own: "p",
    rows: [
      ["e1", "Management agreement signed"],
      ["e2", "STR registration confirmed or waived"],
      ["e3", "Building allows STR confirmed"],
      ["e4", "Owner’s STR insurance uploaded"],
      ["e5", "Taxes set up on listing"],
      ["e6", "Listing amenities match unit"],
      ["e7", "Pricing: base, minimum nights, cleaning fee, dynamic pricing connected"],
      ["e8", "Owner-blocked dates entered"],
      ["e9", "Cleaner assigned and walked through"],
      ["e10", "Guidebook published, messages loaded"],
      ["e11", "Client sent go-live summary"],
      ["e12", "First stay buffer or test stay confirmed"],
    ],
  },
];

export const BE_KEYS = new Set(PARTS_BE.flatMap((p) => p.rows.map((r) => r[0])));
export const isPartAKey = (k: string) => /^a:[0-9a-f-]{36}$/i.test(k);

/** Part A rows from the owner report decisions. */
export function partARows(items: ReviewItem[]): PartARow[] {
  const out: PartARow[] = [];
  for (const i of items) {
    const key = `a:${i.id}`;
    const room = i.sectionName;
    /* Couldn't find it: back with the client until they answer (Buy / I'll supply / Decline). */
    if (i.reopenPending) {
      out.push({ key, label: i.name, sub: `Couldn't find it · waiting for the client`, kind: "find", group: "Find and confirm", reopened: true });
      continue;
    }
    if (i.decision === "buy") out.push({ key, label: i.qty > 1 ? `${i.name} × ${i.qty}` : i.name, sub: `Purchased · ${room}`, kind: "inst", group: "Purchased and supplied" });
    else if (i.decision === "supply") out.push({ key, label: i.name, sub: `Client supplied · ${room}`, kind: "inst", group: "Purchased and supplied" });
    else if (i.decision === "already_there")
      out.push({ key, label: i.name, sub: `Client said: ${i.location || "already there"}`, kind: "find", group: "Find and confirm" });
    else if (i.decision === "declined") {
      if (!i.isEssential) continue;
      out.push(
        i.waived
          ? { key, label: i.name, sub: `Declined · waived${i.waivedBy ? ` by ${i.waivedBy}` : ""}`, kind: "waived", group: "Declined Essentials" }
          : { key, label: i.name, sub: "Declined by client · waive it in Client review", kind: "blocked", group: "Declined Essentials" },
      );
    } else if (i.isEssential) {
      out.push({ key, label: i.name, sub: `${room} · no client decision yet`, kind: "blocked", group: "Awaiting client" });
    }
  }
  return out;
}

export const partARowOk = (r: PartARow, ticks: Record<string, GoLiveTick>) =>
  r.kind === "waived" ? true : r.kind === "blocked" ? false : r.kind === "find" ? ticks[r.key]?.state === "yes" : ticks[r.key]?.state === "done";

/** Part A is green only once a report exists and every row is settled. */
export function partAOk(report: ReviewReport | null, items: ReviewItem[], ticks: Record<string, GoLiveTick>): boolean {
  if (!report) return false;
  return partARows(items).every((r) => partARowOk(r, ticks));
}

export function allPartsOk(report: ReviewReport | null, items: ReviewItem[], ticks: Record<string, GoLiveTick>): boolean {
  return partAOk(report, items, ticks) && [...BE_KEYS].every((k) => !!ticks[k]);
}
