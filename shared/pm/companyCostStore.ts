/** Company overhead for Month close — subscriptions + one-offs. Not host charges. */

import { getSupabaseAdmin } from "../supabase.js";

function db() {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  return sb;
}

export const COMPANY_CATEGORIES = [
  "software",
  "ads",
  "insurance",
  "contractor",
  "other",
] as const;

export type CompanyCategory = (typeof COMPANY_CATEGORIES)[number];
export type CompanyCadence = "monthly" | "yearly";

export type CompanySubscription = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  category: CompanyCategory;
  amount_cents: number;
  cadence: CompanyCadence;
  active: boolean;
  start_year_month: string;
  monthly_cents: number;
};

export type CompanyExpense = {
  id: string;
  created_at: string;
  year_month: string;
  expense_date: string;
  category: CompanyCategory;
  label: string;
  amount_cents: number;
  note: string;
  override_subscription_id: string | null;
};

export type CompanyCostLine = {
  id: string;
  kind: "recurring" | "override" | "manual";
  source: "Auto · recurring" | "Manual";
  category: CompanyCategory;
  label: string;
  amount_cents: number;
  subscription_id: string | null;
  expense_id: string | null;
  note: string;
};

export type CompanyMonthPnl = {
  year_month: string;
  management_fees_cents: number;
  ads_cents: number;
  software_cents: number;
  other_cents: number;
  costs_cents: number;
  net_earnings_cents: number;
  hst_cohost_cents: number;
  hst_invoice_cents: number;
  hst_to_remit_cents: number;
  has_ads_line: boolean;
  has_software_line: boolean;
  recurring_monthly_cents: number;
  lines: CompanyCostLine[];
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function asCategory(v: unknown): CompanyCategory {
  const s = str(v);
  return (COMPANY_CATEGORIES as readonly string[]).includes(s)
    ? (s as CompanyCategory)
    : "other";
}

function asCadence(v: unknown): CompanyCadence {
  return str(v) === "yearly" ? "yearly" : "monthly";
}

export function monthlyFromAmount(amountCents: number, cadence: CompanyCadence): number {
  const n = Math.max(0, Math.round(Number(amountCents) || 0));
  if (cadence === "yearly") return Math.round(n / 12);
  return n;
}

function mapSub(row: Record<string, unknown>): CompanySubscription {
  const cadence = asCadence(row.cadence);
  const amount_cents = Number(row.amount_cents) || 0;
  return {
    id: str(row.id),
    created_at: str(row.created_at),
    updated_at: str(row.updated_at),
    name: str(row.name),
    category: asCategory(row.category),
    amount_cents,
    cadence,
    active: Boolean(row.active),
    start_year_month: str(row.start_year_month),
    monthly_cents: monthlyFromAmount(amount_cents, cadence),
  };
}

function mapExpense(row: Record<string, unknown>): CompanyExpense {
  return {
    id: str(row.id),
    created_at: str(row.created_at),
    year_month: str(row.year_month),
    expense_date: str(row.expense_date),
    category: asCategory(row.category),
    label: str(row.label),
    amount_cents: Number(row.amount_cents) || 0,
    note: str(row.note),
    override_subscription_id: str(row.override_subscription_id) || null,
  };
}

function appliesThisMonth(sub: CompanySubscription, yearMonth: string): boolean {
  if (!sub.active) return false;
  const start = sub.start_year_month;
  if (start && start > yearMonth) return false;
  return true;
}

export async function listCompanySubscriptions(): Promise<CompanySubscription[]> {
  const { data, error } = await db()
    .from("pm_company_subscriptions")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => mapSub(r as Record<string, unknown>));
}

export async function upsertCompanySubscription(input: {
  id?: string;
  name: string;
  category?: string;
  amount_cents: number;
  cadence?: string;
  active?: boolean;
  start_year_month?: string;
}): Promise<CompanySubscription> {
  const name = str(input.name);
  if (!name) throw new Error("Name required.");
  const amount_cents = Math.round(Number(input.amount_cents) || 0);
  if (amount_cents < 0) throw new Error("Amount cannot be negative.");
  const cadence = asCadence(input.cadence);
  const category = asCategory(input.category);
  const start_year_month = str(input.start_year_month);
  const now = new Date().toISOString();

  if (input.id) {
    const patch: Record<string, unknown> = {
      name,
      category,
      amount_cents,
      cadence,
      updated_at: now,
    };
    if (typeof input.active === "boolean") patch.active = input.active;
    if (input.start_year_month != null) patch.start_year_month = start_year_month;
    const { data, error } = await db()
      .from("pm_company_subscriptions")
      .update(patch)
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    return mapSub(data as Record<string, unknown>);
  }

  const { data, error } = await db()
    .from("pm_company_subscriptions")
    .insert({
      name,
      category,
      amount_cents,
      cadence,
      active: input.active !== false,
      start_year_month,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapSub(data as Record<string, unknown>);
}

export async function deleteCompanySubscription(id: string): Promise<void> {
  const { error } = await db().from("pm_company_subscriptions").delete().eq("id", id);
  if (error) throw error;
}

export async function listCompanyExpenses(yearMonth: string): Promise<CompanyExpense[]> {
  const { data, error } = await db()
    .from("pm_company_expenses")
    .select("*")
    .eq("year_month", yearMonth)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => mapExpense(r as Record<string, unknown>));
}

export async function createCompanyExpense(input: {
  year_month: string;
  expense_date?: string;
  category?: string;
  label: string;
  amount_cents: number;
  note?: string;
  override_subscription_id?: string | null;
}): Promise<CompanyExpense> {
  const year_month = str(input.year_month);
  if (!/^\d{4}-\d{2}$/.test(year_month)) throw new Error("Month required (YYYY-MM).");
  const amount_cents = Math.round(Number(input.amount_cents) || 0);
  if (amount_cents < 0) throw new Error("Amount cannot be negative.");
  const label = str(input.label) || "Company cost";
  const expense_date = str(input.expense_date) || `${year_month}-01`;
  const override = str(input.override_subscription_id) || null;

  if (override) {
    await db()
      .from("pm_company_expenses")
      .delete()
      .eq("year_month", year_month)
      .eq("override_subscription_id", override);
  }

  const { data, error } = await db()
    .from("pm_company_expenses")
    .insert({
      year_month,
      expense_date,
      category: asCategory(input.category),
      label,
      amount_cents,
      note: str(input.note),
      override_subscription_id: override,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapExpense(data as Record<string, unknown>);
}

export async function deleteCompanyExpense(id: string): Promise<void> {
  const { error } = await db().from("pm_company_expenses").delete().eq("id", id);
  if (error) throw error;
}

export function emptyCompanyMonthPnl(
  yearMonth: string,
  fees: { management_fees_cents: number; hst_cohost_cents: number; hst_invoice_cents: number },
): CompanyMonthPnl {
  return {
    year_month: yearMonth,
    management_fees_cents: fees.management_fees_cents,
    ads_cents: 0,
    software_cents: 0,
    other_cents: 0,
    costs_cents: 0,
    net_earnings_cents: fees.management_fees_cents,
    hst_cohost_cents: fees.hst_cohost_cents,
    hst_invoice_cents: fees.hst_invoice_cents,
    hst_to_remit_cents: fees.hst_cohost_cents + fees.hst_invoice_cents,
    has_ads_line: false,
    has_software_line: false,
    recurring_monthly_cents: 0,
    lines: [],
  };
}

export async function buildCompanyMonthPnl(
  yearMonth: string,
  fees: { management_fees_cents: number; hst_cohost_cents: number; hst_invoice_cents: number },
): Promise<CompanyMonthPnl> {
  const [subs, expenses] = await Promise.all([
    listCompanySubscriptions(),
    listCompanyExpenses(yearMonth),
  ]);

  const overrideBySub = new Map<string, CompanyExpense>();
  const oneOffs: CompanyExpense[] = [];
  for (const e of expenses) {
    if (e.override_subscription_id) overrideBySub.set(e.override_subscription_id, e);
    else oneOffs.push(e);
  }

  const lines: CompanyCostLine[] = [];
  let recurringMonthly = 0;
  const monthTitleShort = monthShort(yearMonth);

  for (const sub of subs) {
    const monthly = sub.monthly_cents;
    if (sub.active) recurringMonthly += monthly;
    if (!appliesThisMonth(sub, yearMonth)) continue;
    const override = overrideBySub.get(sub.id);
    if (override) {
      lines.push({
        id: override.id,
        kind: "override",
        source: "Manual",
        category: override.category,
        label:
          sub.category === "ads"
            ? `${sub.name} · ${monthTitleShort} actual`
            : override.label || sub.name,
        amount_cents: override.amount_cents,
        subscription_id: sub.id,
        expense_id: override.id,
        note: override.note || `Overrides recurring ${moneyHint(monthly)}`,
      });
    } else {
      lines.push({
        id: `sub:${sub.id}`,
        kind: "recurring",
        source: "Auto · recurring",
        category: sub.category,
        label: sub.name,
        amount_cents: monthly,
        subscription_id: sub.id,
        expense_id: null,
        note:
          sub.cadence === "yearly"
            ? `Yearly ${moneyHint(sub.amount_cents)} → ${moneyHint(monthly)} / mo`
            : "",
      });
    }
  }

  for (const e of oneOffs) {
    lines.push({
      id: e.id,
      kind: "manual",
      source: "Manual",
      category: e.category,
      label: e.label,
      amount_cents: e.amount_cents,
      subscription_id: null,
      expense_id: e.id,
      note: e.note,
    });
  }

  const ads_cents = sumCat(lines, "ads");
  const software_cents = sumCat(lines, "software");
  const other_cents = lines
    .filter((l) => l.category !== "ads" && l.category !== "software")
    .reduce((s, l) => s + l.amount_cents, 0);
  const costs_cents = ads_cents + software_cents + other_cents;

  return {
    year_month: yearMonth,
    management_fees_cents: fees.management_fees_cents,
    ads_cents,
    software_cents,
    other_cents,
    costs_cents,
    net_earnings_cents: fees.management_fees_cents - costs_cents,
    hst_cohost_cents: fees.hst_cohost_cents,
    hst_invoice_cents: fees.hst_invoice_cents,
    hst_to_remit_cents: fees.hst_cohost_cents + fees.hst_invoice_cents,
    has_ads_line: lines.some((l) => l.category === "ads"),
    has_software_line: lines.some((l) => l.category === "software"),
    recurring_monthly_cents: recurringMonthly,
    lines,
  };
}

function sumCat(lines: CompanyCostLine[], cat: CompanyCategory): number {
  return lines.filter((l) => l.category === cat).reduce((s, l) => s + l.amount_cents, 0);
}

function moneyHint(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function monthShort(yearMonth: string): string {
  const [ys, ms] = yearMonth.split("-");
  const d = new Date(Date.UTC(Number(ys), Number(ms) - 1, 1));
  if (Number.isNaN(d.getTime())) return yearMonth;
  return d.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
}
