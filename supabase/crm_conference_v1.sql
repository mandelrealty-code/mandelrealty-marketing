-- CRM click-to-call: Twilio Conference room + Ryan warm transfer.
-- Run in Supabase SQL editor. Do not run from deploy.

ALTER TABLE public.lead_calls
  ADD COLUMN IF NOT EXISTS conference_name text,
  ADD COLUMN IF NOT EXISTS transfer_call_sid text,
  ADD COLUMN IF NOT EXISTS transfer_status text;

COMMENT ON COLUMN public.lead_calls.conference_name IS
  'Twilio Conference FriendlyName, e.g. mrg-{lead_calls.id}';

COMMENT ON COLUMN public.lead_calls.transfer_call_sid IS
  'Twilio Call SID for the Ryan transfer leg dialed into the conference';

COMMENT ON COLUMN public.lead_calls.transfer_status IS
  'connecting | connected | null when no transfer in progress';

CREATE INDEX IF NOT EXISTS lead_calls_conference_name_idx
  ON public.lead_calls (conference_name);

CREATE INDEX IF NOT EXISTS lead_calls_transfer_call_sid_idx
  ON public.lead_calls (transfer_call_sid);
