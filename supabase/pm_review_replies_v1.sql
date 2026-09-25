-- Review reply automation jobs (run after pm_reviews_v1.sql).

alter table public.pm_reviews
  add column if not exists private_feedback text not null default '';

comment on column public.pm_reviews.private_feedback is
  'Guest private feedback from Hospitable private.feedback — never shown in public replies.';

create table if not exists public.pm_review_reply_jobs (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.pm_reviews (id) on delete cascade,
  hospitable_review_id text not null,
  property_id uuid not null references public.pm_properties (id) on delete cascade,
  listing_nickname text not null default '',
  guest_first_name text not null default '',
  stars numeric null,
  platform text not null default 'airbnb',
  class text not null default 'A',
  status text not null default 'pending',
  /** pending | posted | held */
  decision_json jsonb not null default '{}'::jsonb,
  draft_reply text not null default '',
  edited_reply text not null default '',
  posted_reply text not null default '',
  posted_by text not null default '',
  posted_at timestamptz null,
  removal_packet_json jsonb null,
  removal_filed boolean not null default false,
  removal_filed_at timestamptz null,
  removal_outcome text not null default '',
  draft_before_edit text not null default '',
  confidence text not null default 'high',
  needs_human boolean not null default true,
  reason_for_escalation text not null default '',
  sign_off boolean not null default true,
  notified_at timestamptz null,
  dry_run boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hospitable_review_id)
);

create index if not exists pm_review_reply_jobs_status_idx
  on public.pm_review_reply_jobs (status, created_at desc);

create index if not exists pm_review_reply_jobs_property_idx
  on public.pm_review_reply_jobs (property_id, created_at desc);

comment on table public.pm_review_reply_jobs is
  'AI draft + approval queue for public Airbnb review replies (OPS Reviews tab).';
