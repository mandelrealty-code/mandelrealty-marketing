-- One-time Revenue Audit unlock codes (client gifts / comps)
-- Run in Supabase → SQL Editor

create extension if not exists "pgcrypto";

create table if not exists public.revenue_audit_unlock_codes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  code text not null,
  label text not null default '',
  note text not null default '',
  created_by text not null default '',
  redeemed_at timestamptz,
  redeemed_by_email text not null default '',
  redeemed_report_id uuid,
  constraint revenue_audit_unlock_codes_code_nonempty check (length(trim(code)) >= 4)
);

-- Case-insensitive uniqueness
create unique index if not exists revenue_audit_unlock_codes_code_uq
  on public.revenue_audit_unlock_codes (lower(code));

create index if not exists revenue_audit_unlock_codes_created_idx
  on public.revenue_audit_unlock_codes (created_at desc);

create index if not exists revenue_audit_unlock_codes_redeemed_idx
  on public.revenue_audit_unlock_codes (redeemed_at);

alter table public.revenue_audit_unlock_codes enable row level security;

-- Allow paid_3999 on saved reports (Stripe full price)
alter table public.revenue_audit_reports
  drop constraint if exists revenue_audit_reports_unlock_method_check;

alter table public.revenue_audit_reports
  add constraint revenue_audit_reports_unlock_method_check
  check (unlock_method in (
    'preview',
    'paid_3999',
    'paid_2499',
    'paid_1999',
    'code',
    'call'
  ));
