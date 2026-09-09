-- Run once in Supabase → SQL Editor
-- Durable call-slot locks without creating CRM leads.

create extension if not exists "pgcrypto";

create table if not exists public.call_bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  call_start_iso timestamptz not null,
  name text not null default '',
  email text not null default '',
  phone text not null default '',
  source text not null default ''
);

create unique index if not exists call_bookings_start_iso_uidx
  on public.call_bookings (call_start_iso);

create index if not exists call_bookings_start_iso_idx
  on public.call_bookings (call_start_iso);

alter table public.call_bookings enable row level security;
