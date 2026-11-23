-- Onboarding portal link timestamp. Run in ADMIN Supabase SQL editor after review.
-- Do not auto-run from the app.

ALTER TABLE public.onboarding_units
  ADD COLUMN IF NOT EXISTS portal_link_sent_at timestamptz;

COMMENT ON COLUMN public.onboarding_units.portal_link_sent_at IS
  'When the onboarder staff portal invite was last sent from the Audit tab.';
