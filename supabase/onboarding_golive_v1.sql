-- Go-live check (Sprint 7B Phase 2). Run in the ADMIN Supabase (qyowojkufarzhcpsiram) SQL editor after review.
-- Do not auto-run from the app. Safe to run twice.
--
-- onboarding_golive_ticks    one row per ticked check on a unit's Go-live check tab (Parts A to E).
--                            state: 'done' (manual tick), 'yes' (Part A "Confirmed in place"), 'no' (Part A "Couldn't find it").
--                            Unticking deletes the row.
-- onboarding_golive_signoffs one row per unit: who pressed "Ready to list" and when. Records the sign-off only;
--                            nothing else (Hospitable, listings, pricing, stages) changes.

create table if not exists public.onboarding_golive_ticks (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.onboarding_units (id) on delete cascade,
  item_key text not null,            -- 'b1'..'e12', or 'a:<owner_report_items.id>' for Part A rows
  state text not null default 'done' check (state in ('done', 'yes', 'no')),
  ticked_by text not null default 'Admin',
  ticked_at timestamptz not null default now(),
  unique (unit_id, item_key)
);

create table if not exists public.onboarding_golive_signoffs (
  unit_id uuid primary key references public.onboarding_units (id) on delete cascade,
  signed_by text not null default 'Admin',
  signed_at timestamptz not null default now()
);

-- Server-only, like the other onboarding tables: RLS on, no policies (the app uses the service-role key).
alter table public.onboarding_golive_ticks enable row level security;
alter table public.onboarding_golive_signoffs enable row level security;
