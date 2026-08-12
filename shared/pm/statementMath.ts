import { getSupabaseAdmin } from "../supabase.js";
import { breakdownFromFinancials } from "./financialBreakdown.js";
import { getPmPropertyDetail, listPmProperties } from "./propertyStore.js";
import {
  listReservationsForPropertyMonth,
  monthBounds,
  SYNC_STALE_MS,
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
  receipt_filename?: string;
  receipt_mime?: string;
  receipt_storage_path?: string;
};

export type StayStatementLine = {
  kind: "stay";
  label: string;
  check_in: string | null;
  check_out: string | null;
  nights: number;
  base_cents: number;
  mrg_cents: number;
  hst_cents: number;
  cleaning_cents: number;
  /** Net to host for this stay before monthly expenses */
  net_cents: number;
  meta: string;
};

export type StatementLine =
  | StayStatementLine
  | { kind: "expense"; label: string; amount_cents: number; meta?: string }
  | { kind: "commission"; label: string; amount_cents: number; meta?: string };

export type MonthStatement = {
  year_month: string;
  property_id: string;
  currency: string;
  reservation_count: number;
  nights_total: number;
  commission_base_cents: number;
  /** Sum of nightly/accommodation (invoice HST base). */
  nightly_total_cents: number;
  gross_cents: number;
  host_payout_cents: number;
  expense_cents: number;
  expense_count: number;
  mrg_commission_cents: number;
  hst_cents: number;
  hst_mode: "cohost" | "invoice";
  cleaning_fee_cents: number;
  cleaning_fee_keeper: "mrg" | "host";
  mrg_cleaning_cents: number;
  cleaning_turnovers: number;
  /** Net from stays + expenses (cohost HST already deducted if mode=cohost). */
  net_to_host_cents: number;
  /** When invoice mode: net after subtracting QB HST. Same as net_to_host when cohost. */
  net_after_hst_invoice_cents: number;
  rate_bps_used: number | null;
  hst_bps_used: number;
  last_synced_at: string | null;
  reservations: PmReservationRow[];
  expenses: ManualExpense[];
  stays: StayStatementLine[];
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

function moneyLabel(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function shortStayRange(checkIn: string | null, checkOut: string | null): string {
  const fmt = (iso: string | null) => {
    if (!iso) return "?";
    const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime())) return iso.slice(5);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  return `${fmt(checkIn)} – ${fmt(checkOut)}`;
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
  receipt?: {
    filename: string;
    mime: string;
    buffer: Buffer;
  } | null;
}): Promise<ManualExpense> {
  const amount = Math.round(input.amount_cents);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Amount must be a non-negative number.");
  }
  const label = input.label.trim();
  if (!label) throw new Error("Label is required.");
  const category = (input.category || "other").trim().toLowerCase();
  const allowed = new Set([
    "cleaning",
    "supplies",
    "maintenance",
    "utilities",
    "other",
  ]);
  if (!allowed.has(category)) {
    throw new Error("Invalid expense category.");
  }

  const { data, error } = await db()
    .from("pm_manual_expenses")
    .insert({
      property_id: input.property_id,
      expense_date: input.expense_date,
      category,
      label,
      amount_cents: amount,
      note: (input.note ?? "").trim(),
    })
    .select("*")
    .single();
  if (error) {
    if (/receipt_/i.test(error.message || "")) {
      throw new Error(
        "Expense receipt columns missing. Run supabase/pm_expense_receipts_v1.sql in Supabase, then retry.",
      );
    }
    throw error;
  }

  let expense = data as ManualExpense;
  const receipt = input.receipt;
  if (receipt && receipt.buffer.length) {
    if (receipt.buffer.length > 10_000_000) {
      await db().from("pm_manual_expenses").delete().eq("id", expense.id);
      throw new Error("Receipt too large (max 10MB).");
    }
    const safeName =
      receipt.filename.replace(/[^\w.-]+/g, "_") || "receipt.pdf";
    const storagePath = `expense-receipts/${expense.id}/${safeName}`;
    const { error: upErr } = await db()
      .storage.from("pm-contracts")
      .upload(storagePath, receipt.buffer, {
        contentType: receipt.mime || "application/pdf",
        upsert: true,
      });
    if (upErr) {
      await db().from("pm_manual_expenses").delete().eq("id", expense.id);
      throw new Error(`Receipt upload failed: ${upErr.message}`);
    }
    const { data: updated, error: updErr } = await db()
      .from("pm_manual_expenses")
      .update({
        receipt_filename: receipt.filename.trim() || safeName,
        receipt_mime: receipt.mime || "application/pdf",
        receipt_storage_path: storagePath,
      })
      .eq("id", expense.id)
      .select("*")
      .single();
    if (updErr) throw updErr;
    expense = updated as ManualExpense;
  }

  return expense;
}

export async function getExpenseReceiptUrl(id: string): Promise<string> {
  const { data, error } = await db()
    .from("pm_manual_expenses")
    .select("receipt_storage_path")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  const path = data?.receipt_storage_path;
  if (!path) throw new Error("No receipt attached.");
  const { data: signed, error: signErr } = await db()
    .storage.from("pm-contracts")
    .createSignedUrl(path, 60 * 30);
  if (signErr || !signed?.signedUrl) {
    throw new Error(signErr?.message || "Could not sign receipt URL.");
  }
  return signed.signedUrl;
}

export async function deleteManualExpense(id: string): Promise<void> {
  const { data } = await db()
    .from("pm_manual_expenses")
    .select("receipt_storage_path")
    .eq("id", id)
    .maybeSingle();
  const path = data?.receipt_storage_path;
  if (path) {
    await db().storage.from("pm-contracts").remove([path]).catch(() => undefined);
  }
  const { error } = await db().from("pm_manual_expenses").delete().eq("id", id);
  if (error) throw error;
}

export async function buildMonthStatement(
  propertyId: string,
  yearMonth: string,
): Promise<MonthStatement> {
  const detail = await getPmPropertyDetail(propertyId);
  if (!detail) throw new Error("Property not found.");

  const keeper = detail.cleaning_fee_keeper === "host" ? "host" : "mrg";
  const hstMode = detail.hst_mode === "invoice" ? "invoice" : "cohost";
  const hstBps = Number.isFinite(detail.hst_bps) ? detail.hst_bps : 300;

  const [reservations, expenses] = await Promise.all([
    listReservationsForPropertyMonth(propertyId, yearMonth),
    listManualExpenses(propertyId, yearMonth),
  ]);

  const stays: StayStatementLine[] = [];
  const lines: StatementLine[] = [];
  let baseTotal = 0;
  let nightlyTotal = 0;
  let mrgTotal = 0;
  let hstTotal = 0;
  let cleaningTotal = 0;
  let cleaningTurnovers = 0;
  let nightsTotal = 0;
  let gross = 0;
  let hostPayoutLegacy = 0;
  let lastRate: number | null = detail.current_term?.rate_bps ?? null;
  let lastSynced: string | null = null;

  for (const r of reservations) {
    const fin =
      r.financials_json && typeof r.financials_json === "object"
        ? (r.financials_json as Record<string, unknown>)
        : {};
    const bd = breakdownFromFinancials(fin, {
      host_payout_cents: Number(r.host_payout_cents) || 0,
      gross_cents: Number(r.gross_cents) || 0,
      currency: r.currency,
    });

    const on = r.check_out || r.check_in || `${yearMonth}-01`;
    const rate = rateOnDate(detail.terms, on) ?? lastRate ?? 0;
    lastRate = rate;

    const base = bd.commission_base_cents;
    const nightly = bd.accommodation_cents || base;
    const mrg = Math.round((base * rate) / 10000);
    // Cohost: % of commission base taken with fee. Invoice: % of nightly (QB).
    const hst =
      hstMode === "invoice"
        ? Math.round((nightly * hstBps) / 10000)
        : Math.round((base * hstBps) / 10000);
    const cleaning = bd.cleaning_fee_cents;
    if (cleaning > 0) cleaningTurnovers += 1;

    const hostCleaning = keeper === "host" ? cleaning : 0;
    // Stay-level net never subtracts invoice HST (billed separately via QB).
    const cohostHst = hstMode === "cohost" ? hst : 0;
    const net = base - mrg - cohostHst + hostCleaning;

    baseTotal += base;
    nightlyTotal += nightly;
    mrgTotal += mrg;
    hstTotal += hst;
    cleaningTotal += cleaning;
    nightsTotal += Number(r.nights) || 0;
    gross += bd.guest_total_cents || Number(r.gross_cents) || base + cleaning;
    hostPayoutLegacy += Number(r.host_payout_cents) || 0;
    if (r.synced_at && (!lastSynced || r.synced_at > lastSynced)) {
      lastSynced = r.synced_at;
    }

    const guest = r.platform_id || r.platform || "Stay";
    const label = `${shortStayRange(r.check_in, r.check_out)} · ${guest}`;
    const meta =
      hstMode === "invoice"
        ? `Base ${moneyLabel(base)} · MRG ${moneyLabel(mrg)} · HST inv ${moneyLabel(hst)}`
        : `Base ${moneyLabel(base)} · MRG ${moneyLabel(mrg)} · HST ${moneyLabel(hst)}`;
    const stay: StayStatementLine = {
      kind: "stay",
      label,
      check_in: r.check_in,
      check_out: r.check_out,
      nights: Number(r.nights) || 0,
      base_cents: base,
      mrg_cents: mrg,
      hst_cents: hst,
      cleaning_cents: cleaning,
      net_cents: net,
      meta,
    };
    stays.push(stay);
    lines.push(stay);
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

  const mrgCleaning = keeper === "mrg" ? cleaningTotal : 0;
  const hostCleaningTotal = keeper === "host" ? cleaningTotal : 0;
  const cohostHstTotal = hstMode === "cohost" ? hstTotal : 0;
  const netToHost =
    baseTotal - mrgTotal - cohostHstTotal + hostCleaningTotal - expenseTotal;
  const netAfterInvoice =
    hstMode === "invoice" ? netToHost - hstTotal : netToHost;

  const currency =
    reservations[0]?.currency || detail.currency || "CAD";

  return {
    year_month: yearMonth,
    property_id: propertyId,
    currency,
    reservation_count: reservations.length,
    nights_total: nightsTotal,
    commission_base_cents: baseTotal,
    nightly_total_cents: nightlyTotal,
    gross_cents: gross,
    host_payout_cents: hostPayoutLegacy || baseTotal + hostCleaningTotal,
    expense_cents: expenseTotal,
    expense_count: expenses.length,
    mrg_commission_cents: mrgTotal,
    hst_cents: hstTotal,
    hst_mode: hstMode,
    cleaning_fee_cents: cleaningTotal,
    cleaning_fee_keeper: keeper,
    mrg_cleaning_cents: mrgCleaning,
    cleaning_turnovers: cleaningTurnovers,
    net_to_host_cents: netToHost,
    net_after_hst_invoice_cents: netAfterInvoice,
    rate_bps_used: lastRate,
    hst_bps_used: hstBps,
    last_synced_at: lastSynced,
    reservations,
    expenses,
    stays,
    lines,
  };
}

export type PortfolioSyncStatus = "fresh" | "stale" | "empty" | "unlinked";

export type PortfolioUnitRow = {
  property_id: string;
  property_name: string;
  client_id: string;
  client_name: string;
  linked: boolean;
  active: boolean;
  hst_mode: "cohost" | "invoice";
  hst_bps: number;
  sync_status: PortfolioSyncStatus;
  sync_reason: string | null;
  last_synced_at: string | null;
  reservation_count: number;
  /** null when unlinked (excluded from totals). */
  net_to_host_cents: number | null;
  mrg_commission_cents: number | null;
  /** Nightly accommodation total for the month (invoice HST base). */
  nightly_total_cents: number | null;
  /** Invoice-mode HST only; null when cohost or unlinked. */
  hst_invoice_cents: number | null;
  expense_cents: number | null;
  currency: string;
};

export type MonthPortfolio = {
  year_month: string;
  currency: string;
  unit_count: number;
  linked_count: number;
  unlinked_count: number;
  net_to_host_cents: number;
  mrg_commission_cents: number;
  hst_invoice_cents: number;
  expense_cents: number;
  reservation_count: number;
  fleet_last_synced_at: string | null;
  units: PortfolioUnitRow[];
};

function syncStatusFor(input: {
  linked: boolean;
  lastSyncedAt: string | null;
  zeroFinancials: boolean;
}): { status: PortfolioSyncStatus; reason: string | null } {
  if (!input.linked) return { status: "unlinked", reason: null };
  if (input.zeroFinancials) {
    return { status: "empty", reason: "zero_financials" };
  }
  if (!input.lastSyncedAt) {
    return { status: "stale", reason: "never_synced" };
  }
  const t = new Date(input.lastSyncedAt).getTime();
  if (!Number.isFinite(t) || Date.now() - t > SYNC_STALE_MS) {
    return { status: "stale", reason: "stale" };
  }
  return { status: "fresh", reason: null };
}

/** Portfolio rollup for Month close — one statement per active property. */
export async function buildMonthPortfolio(
  yearMonth: string,
  opts?: { clientId?: string },
): Promise<MonthPortfolio> {
  const props = await listPmProperties(opts?.clientId);
  const active = props.filter((p) => p.active !== false);

  const units: PortfolioUnitRow[] = [];
  let netTotal = 0;
  let mrgTotal = 0;
  let hstInvoiceTotal = 0;
  let expenseTotal = 0;
  let reservationTotal = 0;
  let linkedCount = 0;
  let fleetLast: string | null = null;
  let currency = "CAD";

  for (const p of active) {
    const linked = Boolean(p.hospitable_property_id);
    if (linked) linkedCount += 1;

    if (!linked) {
      units.push({
        property_id: p.id,
        property_name: p.name,
        client_id: p.client_id,
        client_name: p.client_name,
        linked: false,
        active: true,
        hst_mode: p.hst_mode === "invoice" ? "invoice" : "cohost",
        hst_bps: Number.isFinite(p.hst_bps) ? p.hst_bps : 300,
        sync_status: "unlinked",
        sync_reason: null,
        last_synced_at: null,
        reservation_count: 0,
        net_to_host_cents: null,
        mrg_commission_cents: null,
        nightly_total_cents: null,
        hst_invoice_cents: null,
        expense_cents: null,
        currency: p.currency || "CAD",
      });
      continue;
    }

    const statement = await buildMonthStatement(p.id, yearMonth);
    currency = statement.currency || currency;
    const lastSynced = statement.last_synced_at;
    if (lastSynced && (!fleetLast || lastSynced > fleetLast)) {
      fleetLast = lastSynced;
    }

    const invoiceHst =
      statement.hst_mode === "invoice" ? statement.hst_cents : null;
    const zeroFinancials =
      statement.reservation_count > 0 &&
      statement.commission_base_cents === 0 &&
      (statement.gross_cents === 0 || !statement.gross_cents);
    const sync = syncStatusFor({
      linked: true,
      lastSyncedAt: lastSynced,
      zeroFinancials,
    });

    netTotal += statement.net_to_host_cents;
    mrgTotal += statement.mrg_commission_cents;
    if (invoiceHst != null) hstInvoiceTotal += invoiceHst;
    expenseTotal += statement.expense_cents;
    reservationTotal += statement.reservation_count;

    units.push({
      property_id: p.id,
      property_name: p.name,
      client_id: p.client_id,
      client_name: p.client_name,
      linked: true,
      active: true,
      hst_mode: statement.hst_mode,
      hst_bps: statement.hst_bps_used,
      sync_status: sync.status,
      sync_reason: sync.reason,
      last_synced_at: lastSynced,
      reservation_count: statement.reservation_count,
      net_to_host_cents: statement.net_to_host_cents,
      mrg_commission_cents: statement.mrg_commission_cents,
      nightly_total_cents: statement.nightly_total_cents ?? null,
      hst_invoice_cents: invoiceHst,
      expense_cents: statement.expense_cents,
      currency: statement.currency,
    });
  }

  units.sort((a, b) => {
    const c = a.client_name.localeCompare(b.client_name);
    if (c !== 0) return c;
    return a.property_name.localeCompare(b.property_name);
  });

  return {
    year_month: yearMonth,
    currency,
    unit_count: units.length,
    linked_count: linkedCount,
    unlinked_count: units.length - linkedCount,
    net_to_host_cents: netTotal,
    mrg_commission_cents: mrgTotal,
    hst_invoice_cents: hstInvoiceTotal,
    expense_cents: expenseTotal,
    reservation_count: reservationTotal,
    fleet_last_synced_at: fleetLast,
    units,
  };
}
