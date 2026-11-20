-- Cascade delete: removing a lead removes
-- all its calls, bookings and history.
-- Run in Supabase SQL Editor. Do not auto-run from deploy.

-- lead_calls (may already be CASCADE — re-apply safely)
ALTER TABLE public.lead_calls
  DROP CONSTRAINT IF EXISTS lead_calls_lead_id_fkey,
  ADD CONSTRAINT lead_calls_lead_id_fkey
    FOREIGN KEY (lead_id)
    REFERENCES public.leads(id)
    ON DELETE CASCADE;

-- crm_bookings (ensure table + FK)
CREATE TABLE IF NOT EXISTS public.crm_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  lead_id uuid NOT NULL,
  slot_start timestamptz NOT NULL,
  slot_end timestamptz NOT NULL,
  google_event_id text,
  booked_by text NOT NULL DEFAULT 'booker',
  confirmation_sent_at timestamptz
);

ALTER TABLE public.crm_bookings
  DROP CONSTRAINT IF EXISTS crm_bookings_lead_id_fkey,
  ADD CONSTRAINT crm_bookings_lead_id_fkey
    FOREIGN KEY (lead_id)
    REFERENCES public.leads(id)
    ON DELETE CASCADE;

-- SMS thread: was ON DELETE SET NULL — cascade so deletes don't leave orphans
ALTER TABLE public.lead_sms_messages
  DROP CONSTRAINT IF EXISTS lead_sms_messages_lead_id_fkey,
  ADD CONSTRAINT lead_sms_messages_lead_id_fkey
    FOREIGN KEY (lead_id)
    REFERENCES public.leads(id)
    ON DELETE CASCADE;

-- Clean up existing orphaned rows
DELETE FROM public.lead_calls
  WHERE lead_id NOT IN (SELECT id FROM public.leads);

DELETE FROM public.crm_bookings
  WHERE lead_id NOT IN (SELECT id FROM public.leads);

DELETE FROM public.lead_sms_messages
  WHERE lead_id IS NOT NULL
    AND lead_id NOT IN (SELECT id FROM public.leads);

-- Already CASCADE elsewhere (no change needed):
--   sms_drafts, lead_followups
-- Intentionally SET NULL (keep row, unlink lead):
--   onboarding_units.lead_id, pm_clients.lead_id, hospitable properties lead_id
