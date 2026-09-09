-- Revenue Audit saved reports + emailed unique links
-- Run in Supabase → SQL Editor

create extension if not exists "pgcrypto";

create table if not exists public.revenue_audit_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  email text not null,
  name text not null default '',
  phone text not null default '',
  unlocked boolean not null default false,
  unlock_method text not null default 'preview'
    check (unlock_method in ('preview', 'paid_2499', 'paid_1999', 'code', 'call')),
  unlock_note text not null default '',
  lead_id uuid,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists revenue_audit_reports_email_idx
  on public.revenue_audit_reports (lower(email));

create index if not exists revenue_audit_reports_created_idx
  on public.revenue_audit_reports (created_at desc);

alter table public.revenue_audit_reports enable row level security;
