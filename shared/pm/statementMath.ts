import { getSupabaseAdmin } from "../supabase.js";
import { getPmPropertyDetail } from "./propertyStore.js";
import {
  listReservationsForPropertyMonth,
  monthBounds,
  type PmReservationRow,
} from "./reservationStore.js";
import type { PmCommissionTerm } from "./types.js";

function db() {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  return sb;
}

export type ManualExpense = {
  id: string;
  property_id: string;
  expense_date: string;
  category: string;
  label: string;
  amount_cents: number;
  note: string;
  created_at: string;
};

export type StatementLine = {
  kind: "reservation" | "expense" | "commission";
  label: string;
  amount_cents: number;
  meta?: string;
};

export type MonthStatement = {
  year_month: string;
  property_id: string;
  currency: string;
  reservation_count: number;
  gross_cents: number;
  host_payout_cents: number;
  expense_cents: number;
  mrg_commission_cents: number;
  net_to_host_cents: number;
  rate_bps_used: number | null;
  reservations: PmReservationRow[];
  expenses: ManualExpense[];
  lines: StatementLine[];
};

function rateOnDate(terms: PmCommissionTerm[], onDate: string): number | null {
  const open = terms.filter((t) => {
    if (t.effective_from > onDate) return false;
    if (t.effective_to && t.effective_to < onDate) return false;
    return true;
  });
  open.sort((a, b) => b.effective_from.localeCompare(a.effective_from));
  return open[0]?.rate_bps ?? null;
}

export async function listManualExpenses(
  propertyId: string,
  yearMonth: string,
): Promise<ManualExpense[]> {
  const { start, end } = monthBounds(yearMonth);
  const { data, error } = await db()
    .from("pm_manual_expenses")
    .select("*")
    .eq("property_id", propertyId)
    .gte("expense_date", start)
    .lte("expense_date", end)
    .order("expense_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ManualExpense[];
}

export async function createManualExpense(input: {
  property_id: string;
  expense_date: string;
  category?: string;
  label: string;
  amount_cents: number;
  note?: string;
}): Promise<ManualExpense> {
  const amount = Math.round(input.amount_cents);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Amount must be a non-negative number.");
  }
  const label = input.label.trim();
  if (!label) throw new Error("Label is required.");
  const { data, error } = await db()
    .from("pm_manual_expenses")
    .insert({
      property_id: input.property_id,
      expense_date: input.expense_date,
      category: input.category || "other",
      label,
      amount_cents: amount,
      note: (input.note ?? "").trim(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ManualExpense;
}

export async function deleteManualExpense(id: string): Promise<void> {
  const { error } = await db().from("pm_manual_expenses").delete().eq("id", id);
  if (error) throw error;
}

export async function buildMonthStatement(
  propertyId: string,
  yearMonth: string,
): Promise<MonthStatement> {
  const detail = await getPmPropertyDetail(propertyId);
  if (!detail) throw new Error("Property not found.");

  const [reservations, expenses] = await Promise.all([
    listReservationsForPropertyMonth(propertyId, yearMonth),
    listManualExpenses(propertyId, yearMonth),
  ]);

  const lines: StatementLine[] = [];
  let hostPayout = 0;
  let gross = 0;
  let mrgCommission = 0;
  let lastRate: number | null = detail.current_term?.rate_bps ?? null;

  for (const r of reservations) {
    const payout = Number(r.host_payout_cents) || Number(r.gross_cents) || 0;
    const g = Number(r.gross_cents) || payout;
    hostPayout += payout;
    gross += g;
    const on = r.check_out || r.check_in || `${yearMonth}-01`;
    const rate = rateOnDate(detail.terms, on) ?? lastRate ?? 0;
    lastRate = rate;
    const commission = Math.round((payout * rate) / 10000);
    mrgCommission += commission;
    const guest = r.platform_id || r.platform || "Stay";
    lines.push({
      kind: "reservation",
      label: `${guest} · ${r.check_in ?? "?"} → ${r.check_out ?? "?"}`,
      amount_cents: payout,
      meta: `${(rate / 100).toFixed(rate % 100 === 0 ? 0 : 2)}% MRG = $${(commission / 100).toFixed(2)}`,
    });
  }

  let expenseTotal = 0;
  for (const e of expenses) {
    expenseTotal += Number(e.amount_cents) || 0;
    lines.push({
      kind: "expense",
      label: e.label || e.category,
      amount_cents: -Number(e.amount_cents) || 0,
      meta: e.expense_date,
    });
  }

  if (mrgCommission > 0) {
    lines.push({
      kind: "commission",
      label: "MRG management fee",
      amount_cents: -mrgCommission,
      meta: lastRate != null ? `${lastRate / 100}% of host payout` : undefined,
    });
  }

  const currency = reservations[0]?.currency || detail.currency || "CAD";

  return {
    year_month: yearMonth,
    property_id: propertyId,
    currency,
    reservation_count: reservations.length,
    gross_cents: gross,
    host_payout_cents: hostPayout,
    expense_cents: expenseTotal,
    mrg_commission_cents: mrgCommission,
    net_to_host_cents: hostPayout - expenseTotal - mrgCommission,
    rate_bps_used: lastRate,
    reservations,
    expenses,
    lines,
  };
}
