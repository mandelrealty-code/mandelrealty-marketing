-- Guest reviews cached from Hospitable (run after pm_earnings_contracts_v1.sql).

create table if not exists public.pm_reviews (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.pm_properties (id) on delete cascade,
  hospitable_review_id text not null,
  hospitable_reservation_id text not null default '',
  platform text not null default '',
  /** Overall public rating 1–5 when present. */
  rating numeric null,
  rating_raw text not null default '',
  public_review text not null default '',
  public_response text not null default '',
  guest_first_name text not null default '',
  check_in date null,
  check_out date null,
  reviewed_at timestamptz null,
  responded_at timestamptz null,
  /** [{ type, rating }] with rating 1–5 only. */
  category_ratings_json jsonb not null default '[]'::jsonb,
  raw_json jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  unique (hospitable_review_id)
);

create index if not exists pm_reviews_property_reviewed_idx
  on public.pm_reviews (property_id, reviewed_at desc);

create index if not exists pm_reviews_property_checkout_idx
  on public.pm_reviews (property_id, check_out);

comment on table public.pm_reviews is
  'Hospitable guest reviews — public rating/text only for host statements';
