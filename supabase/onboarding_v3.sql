-- Onboarding v3: furniture line items, template text fixes, archive test units.
-- Run in Supabase SQL editor after onboarding_v2.sql.

-- Shared furniture / client-approval / procurement line items
CREATE TABLE IF NOT EXISTS onboarding_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES onboarding_units(id) ON DELETE CASCADE,
  item text NOT NULL,
  room text NOT NULL DEFAULT '',
  qty integer NOT NULL DEFAULT 1 CHECK (qty >= 1),
  price numeric NOT NULL DEFAULT 0,
  ryan_ok boolean NOT NULL DEFAULT false,
  client_status text NOT NULL DEFAULT 'pending'
    CHECK (client_status = ANY (ARRAY['pending'::text, 'approved'::text, 'declined'::text])),
  deliver_to text NOT NULL DEFAULT 'unit'
    CHECK (deliver_to = ANY (ARRAY['unit'::text, 'ryan'::text, 'shane'::text])),
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS onboarding_line_items_unit_idx ON onboarding_line_items (unit_id, sort);

ALTER TABLE onboarding_line_items ENABLE ROW LEVEL SECURITY;

-- Stage due date (set on advance; shown on the unit)
ALTER TABLE onboarding_units
  ADD COLUMN IF NOT EXISTS stage_due_on date;

-- Template fixes: Booking.com waits on owner; cleaner confirmation wording; ensure missing Software task
UPDATE onboarding_task_templates
  SET default_type = 'owner'
  WHERE stage = 'Software' AND label ILIKE 'Booking.com%';

UPDATE onboarding_task_templates
  SET label = 'Cleaner confirmed for first turnover (manual)'
  WHERE stage = 'Software' AND label ILIKE 'Cleaning company assigned%';

INSERT INTO onboarding_task_templates (stage, label, default_type, sort)
SELECT 'Software', 'Cleaner confirmed for first turnover (manual)', 'partner', 105
WHERE NOT EXISTS (
  SELECT 1 FROM onboarding_task_templates
  WHERE stage = 'Software' AND label = 'Cleaner confirmed for first turnover (manual)'
);

-- Align live Software tasks that still use the old cleaning-company wording
UPDATE onboarding_tasks
  SET label = 'Cleaner confirmed for first turnover (manual)'
  WHERE stage = 'Software' AND label ILIKE 'Cleaning company assigned%';

UPDATE onboarding_tasks
  SET assignee = 'Owner'
  WHERE stage = 'Software' AND label ILIKE 'Booking.com%';

-- Archive the three named test units (and cascade-related rows stay via FK / soft hide)
UPDATE onboarding_units
SET archived = true, updated_at = now()
WHERE archived = false
  AND address IN (
    'Test - 999 Test St',
    'Test Growth - 998 Test St',
    'Test Essentials - 997 Test St'
  );

DELETE FROM onboarding_schedule
WHERE unit_id IN (
  SELECT id FROM onboarding_units
  WHERE address IN (
    'Test - 999 Test St',
    'Test Growth - 998 Test St',
    'Test Essentials - 997 Test St'
  )
);

-- Best-effort assignee corrections for existing open tasks (uses roster first names)
UPDATE onboarding_tasks t
SET assignee = COALESCE(
  (SELECT name FROM pm_team_members WHERE name ILIKE 'Ryan%' ORDER BY name LIMIT 1),
  t.assignee
)
WHERE done = false
  AND (
    stage = 'Photography'
    OR label ILIKE 'Ryan approves%'
    OR label ILIKE 'Schedule photo%'
    OR label ILIKE 'Shoot on site%'
    OR label ILIKE 'Edit & upload photos%'
  );

UPDATE onboarding_tasks
SET assignee = 'Admin'
WHERE done = false
  AND (
    label ILIKE 'Mark as sent to client%'
    OR label ILIKE 'Client approves budget%'
    OR label ILIKE 'Client approves furniture%'
    OR label ILIKE 'FIP contract%'
    OR label ILIKE 'Contest agreement%'
  );

-- Booking.com uses the waiting-on-owner template wording in the UI via assignee Owner
UPDATE onboarding_task_templates
  SET label = 'Booking.com: listing live (set up in Hospitable)'
  WHERE stage = 'Software' AND label ILIKE 'Booking.com%';
