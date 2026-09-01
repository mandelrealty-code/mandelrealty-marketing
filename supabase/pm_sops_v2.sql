-- Mandel Realty Group: SOP video URL column (for video walkthrough guides)
-- Run in Supabase SQL editor after pm_sops_v1.sql

alter table public.pm_sops
  add column if not exists video_url text;

comment on column public.pm_sops.video_url is
  'Signed URL or API redirect for sop-videos/{slug}.webm in pm-contracts bucket';
