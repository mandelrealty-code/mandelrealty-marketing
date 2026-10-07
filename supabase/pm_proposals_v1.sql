-- Unit proposals. Run in the Supabase SQL editor.
-- Each edit is a new row. Earlier versions stay on the client.

create table if not exists public.pm_proposals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id uuid not null references public.pm_clients (id) on delete cascade,
  address text not null default '',
  version int not null,
  status text not null default 'draft' check (status in ('draft', 'sent')),
  sourced_on date not null,
  total_cents int not null default 0,
  currency text not null default 'CAD',
  estimate text not null default '',
  images_note text not null default '',
  ready text not null default '',
  rooms jsonb not null default '[]'::jsonb,
  storage_path text not null default ''
);

create index if not exists pm_proposals_client_idx
  on public.pm_proposals (client_id, created_at desc);
