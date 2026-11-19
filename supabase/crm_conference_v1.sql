-- CRM click-to-call: Twilio Conference room + Ryan warm transfer + booker time.
-- Run in Supabase SQL editor. Do not run from deploy.

ALTER TABLE public.lead_calls
  ADD COLUMN IF NOT EXISTS conference_name text,
  ADD COLUMN IF NOT EXISTS transfer_call_sid text,
  ADD COLUMN IF NOT EXISTS transfer_status text,
  ADD COLUMN IF NOT EXISTS booker_joined_at timestamptz,
  ADD COLUMN IF NOT EXISTS booker_left_at timestamptz,
  ADD COLUMN IF NOT EXISTS booker_call_seconds integer;

COMMENT ON COLUMN public.lead_calls.conference_name IS
  'Twilio Conference FriendlyName, e.g. mrg-{lead_calls.id}';

COMMENT ON COLUMN public.lead_calls.transfer_call_sid IS
  'Twilio Call SID for the Ryan transfer leg dialed into the conference';

COMMENT ON COLUMN public.lead_calls.transfer_status IS
  'connecting | ringing | connected | null when no transfer in progress';

COMMENT ON COLUMN public.lead_calls.booker_joined_at IS
  'When the booker (operator) leg joined the conference';

COMMENT ON COLUMN public.lead_calls.booker_left_at IS
  'When the booker left the conference (Leave call)';

COMMENT ON COLUMN public.lead_calls.booker_call_seconds IS
  'Seconds the booker was personally on the call (left − joined)';

CREATE INDEX IF NOT EXISTS lead_calls_conference_name_idx
  ON public.lead_calls (conference_name);

CREATE INDEX IF NOT EXISTS lead_calls_transfer_call_sid_idx
  ON public.lead_calls (transfer_call_sid);
