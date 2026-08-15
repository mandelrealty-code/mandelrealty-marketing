-- Company P&L (Month close). Recurring catalog + one-off / month overrides.
-- Company spend only — never host charges or cleaning as revenue.

create table if not exists public.pm_company_subscriptions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  category text not null default 'software'
    check (category in ('software', 'ads', 'insurance', 'contractor', 'other')),
  amount_cents bigint not null check (amount_cents >= 0),
  cadence text not null default 'monthly'
    check (cadence in ('monthly', 'yearly')),
  active boolean not null default true,
  start_year_month text not null default ''
);

create index if not exists pm_company_subscriptions_active_idx
  on public.pm_company_subscriptions (active);

comment on table public.pm_company_subscriptions is
  'Recurring company overhead that auto-applies on Month close. Yearly amounts are divided by 12.';

create table if not exists public.pm_company_expenses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  year_month text not null,
  expense_date date not null,
  category text not null default 'other'
    check (category in ('software', 'ads', 'insurance', 'contractor', 'other')),
  label text not null default '',
  amount_cents bigint not null check (amount_cents >= 0),
  note text not null default '',
  override_subscription_id uuid null
    references public.pm_company_subscriptions (id) on delete set null
);

create index if not exists pm_company_expenses_month_idx
  on public.pm_company_expenses (year_month);

create unique index if not exists pm_company_expenses_override_month_idx
  on public.pm_company_expenses (override_subscription_id, year_month)
  where override_subscription_id is not null;

comment on table public.pm_company_expenses is
  'One-off company costs for a month, or an amount that replaces a subscription for that month.';
