-- Staff portals v1 — clock sessions, call logs, VA timers, checklist answers.
-- WRITE ONLY — do not run from the agent. Run in Supabase SQL editor when ready.
-- CRITICAL: Never store checklist/photos/notes/history on staff_users.
-- Assignees remain display_name strings. Deactivation sets a flag only.
--
-- staff_type for the coordinator portal: prefer 'booker'.
-- 'operations' is kept for backward compatibility and still routes to CoordinatorPortal.

-- Clock-in sessions (keyed by staff_display_name, not staff_user_id)
CREATE TABLE IF NOT EXISTS staff_clock_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_display_name text NOT NULL,
  unit_id uuid,
  lead_id uuid,
  job_type text,
  clocked_in_at timestamptz NOT NULL,
  clocked_out_at timestamptz,
  total_seconds integer,
  lat numeric,
  lng numeric,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_clock_sessions_name_idx
  ON staff_clock_sessions (staff_display_name, clocked_in_at DESC);

-- Coordinator call logs (stored on lead)
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS coordinator_call_log jsonb DEFAULT '[]'::jsonb;
-- Array of { outcome, status, notes, logged_at, logged_by } objects

-- VA task timer (stored on pm_tasks)
ALTER TABLE pm_tasks
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS duration_seconds integer;

-- Optional lat/lng on onboarding units for GPS clock-in (200m)
ALTER TABLE onboarding_units
  ADD COLUMN IF NOT EXISTS lat numeric,
  ADD COLUMN IF NOT EXISTS lng numeric;

-- Onboarding item answers (keyed by unit_id + item_id — never staff_user_id)
CREATE TABLE IF NOT EXISTS onboarding_item_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL,
  item_id text NOT NULL,
  answer text NOT NULL,
  -- 'yes' | 'no' | 'na' | count value
  photo_url text,
  answered_by text, -- display_name only
  answered_at timestamptz DEFAULT now(),
  UNIQUE (unit_id, item_id)
);

CREATE INDEX IF NOT EXISTS onboarding_item_answers_unit_idx
  ON onboarding_item_answers (unit_id);

-- Deactivated staff: flag only, no data deletion
ALTER TABLE staff_users
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;
-- When set, staff cannot log in
-- All their data stays intact
-- Admin sees "Unassigned" badge on units where assignee = their display_name
