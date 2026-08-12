export type PmClientStatus = "active" | "paused";

export type PmClient = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  email: string;
  phone: string;
  status: PmClientStatus;
  lead_id: string | null;
};

export type PmProperty = {
  id: string;
  created_at: string;
  updated_at: string;
  client_id: string;
  name: string;
  address: string;
  hospitable_property_id: string;
  guidebook_property_id: string;
  hub_property_id: string;
  currency: string;
  active: boolean;
  cleaning_fee_keeper: "mrg" | "host";
  /**
   * nightly = room fee × commission % (bill gross bookings);
   * nightly_minus_host_fee = (room fee − Airbnb host fee) × commission %.
   */
  commission_base_mode: "nightly" | "nightly_minus_host_fee";
  /** cohost = HST % on commission base; invoice = HST % of MRG fee via QuickBooks */
  hst_mode: "cohost" | "invoice";
  hst_bps: number;
};

export type PmCommissionTerm = {
  id: string;
  created_at: string;
  property_id: string;
  rate_bps: number;
  effective_from: string;
  effective_to: string | null;
  note: string;
};

export type PmSettings = {
  default_commission_bps: number;
  default_hst_bps: number;
  updated_at: string;
};

export type PmPropertyListItem = PmProperty & {
  client_name: string;
  current_rate_bps: number | null;
};

export type PmPropertyDetail = PmProperty & {
  client_name: string;
  current_term: PmCommissionTerm | null;
  terms: PmCommissionTerm[];
};

export type PmClientListItem = PmClient & {
  property_count: number;
};

export function rateBpsToPercent(bps: number): number {
  return Math.round((bps / 100) * 100) / 100;
}

export function percentToRateBps(percent: number): number {
  return Math.round(percent * 100);
}

export function formatRatePercent(bps: number | null | undefined): string {
  if (bps == null) return "—";
  const p = rateBpsToPercent(bps);
  return Number.isInteger(p) ? `${p}%` : `${p}%`;
}
