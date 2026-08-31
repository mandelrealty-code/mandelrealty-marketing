-- Mandel Realty Group: Standard Operating Procedures (SOPs) & Scribe-Style Playbooks
-- Run in Supabase SQL editor

create table if not exists public.pm_sops (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  slug text not null unique,
  title text not null,
  category text not null default 'outreach', -- 'outreach' | 'guest_ops' | 'team_comms' | 'maintenance' | 'software' | 'other'
  summary text not null default '',
  target_role text not null default 'va', -- 'va' | 'cleaner' | 'manager' | 'all'
  estimated_minutes integer not null default 15,
  steps jsonb not null default '[]'::jsonb,
  is_published boolean not null default true,
  author text not null default 'MRG Admin'
);

-- Index for slug lookups & category filtering
create index if not exists idx_pm_sops_slug on public.pm_sops (slug);
create index if not exists idx_pm_sops_category on public.pm_sops (category);
create index if not exists idx_pm_sops_published on public.pm_sops (is_published);
