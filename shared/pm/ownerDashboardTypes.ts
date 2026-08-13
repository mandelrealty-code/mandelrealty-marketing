export type OwnerSetupStepState = "done" | "in_progress" | "next" | "pending";

export type OwnerSetupStep = {
  id: "airbnb" | "calendar" | "earnings";
  label: string;
  state: OwnerSetupStepState;
  status_label: string;
};

export type OwnerUpcomingStay = {
  check_in: string;
  check_out: string;
  nights: number;
  channel: string;
  amount_cents: number;
};

export type OwnerSparkPoint = {
  year_month: string;
  label: string;
  net_to_host_cents: number;
};

export type OwnerEarningsSnapshot = {
  year_month: string;
  month_title: string;
  currency: string;
  net_to_host_cents: number;
  mom_bps: number | null;
  reservation_count: number;
  nights_booked: number;
  occupancy_bps: number;
  projected_year: number;
  projected_year_cents: number | null;
  ytd_net_cents: number;
  sparkline: OwnerSparkPoint[];
  upcoming: OwnerUpcomingStay[];
  prior_month: {
    year_month: string;
    month_title: string;
    net_to_host_cents: number;
  } | null;
};

export type OwnerDashboardPayload = {
  linked: boolean;
  setup: OwnerSetupStep[];
  earnings: OwnerEarningsSnapshot | null;
};
