-- Booking window config on crm_calendar_tokens (id=1).
-- Run in Supabase SQL Editor. Safe defaults: 9–17, 30 min buffer, 60 min slots.

ALTER TABLE public.crm_calendar_tokens
  ADD COLUMN IF NOT EXISTS booking_hours_start int,
  ADD COLUMN IF NOT EXISTS booking_hours_end int,
  ADD COLUMN IF NOT EXISTS buffer_minutes int,
  ADD COLUMN IF NOT EXISTS slot_duration_minutes int;

UPDATE public.crm_calendar_tokens
SET
  booking_hours_start = COALESCE(NULLIF(booking_hours_start, 0), 9),
  booking_hours_end = COALESCE(NULLIF(booking_hours_end, 0), 17),
  buffer_minutes = COALESCE(buffer_minutes, 30),
  slot_duration_minutes = COALESCE(NULLIF(slot_duration_minutes, 0), 60)
WHERE id = 1;

-- Check current values:
-- SELECT booking_hours_start, booking_hours_end, buffer_minutes, slot_duration_minutes
-- FROM crm_calendar_tokens WHERE id = 1;
