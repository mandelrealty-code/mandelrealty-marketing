-- Onboarding v2: plan-based stage flows, handoff, docs, history, reseeding task templates.
-- Do not run until reviewed. Apply in Supabase SQL editor after onboarding_v1.sql.

-- New columns on onboarding_units
ALTER TABLE onboarding_units
  ADD COLUMN IF NOT EXISTS plan text,
  ADD COLUMN IF NOT EXISTS plan_tier text,
  ADD COLUMN IF NOT EXISTS furniture text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS furniture_budget integer,
  ADD COLUMN IF NOT EXISTS str_licence text,
  ADD COLUMN IF NOT EXISTS str_permit_status text DEFAULT 'Not required',
  ADD COLUMN IF NOT EXISTS contract_status text DEFAULT 'signed',
  ADD COLUMN IF NOT EXISTS hospitable_property_id text,
  ADD COLUMN IF NOT EXISTS airbnb_url text,
  ADD COLUMN IF NOT EXISTS deliver_to text DEFAULT 'unit',
  ADD COLUMN IF NOT EXISTS owner_phone text,
  ADD COLUMN IF NOT EXISTS owner_whatsapp text,
  ADD COLUMN IF NOT EXISTS onboarding_fee_status text DEFAULT 'charged',
  ADD COLUMN IF NOT EXISTS onboarding_fee_amount integer,
  ADD COLUMN IF NOT EXISTS existing_airbnb_url text,
  ADD COLUMN IF NOT EXISTS building_name text,
  ADD COLUMN IF NOT EXISTS unit_floor text,
  ADD COLUMN IF NOT EXISTS building_manager text,
  ADD COLUMN IF NOT EXISTS elevator_booking_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS moving_hours text,
  ADD COLUMN IF NOT EXISTS coi_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS building_notes text;

-- New columns on onboarding_tasks
ALTER TABLE onboarding_tasks
  ADD COLUMN IF NOT EXISTS done_by text,
  ADD COLUMN IF NOT EXISTS skipped boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS skipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS notes text;

-- New columns on onboarding_unit_stages
ALTER TABLE onboarding_unit_stages
  ADD COLUMN IF NOT EXISTS skipped boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS skipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS skipped_by text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by text,
  ADD COLUMN IF NOT EXISTS notes text;

-- Document storage per unit
CREATE TABLE IF NOT EXISTS onboarding_unit_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid REFERENCES onboarding_units(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  doc_type text,
  uploaded_at timestamptz DEFAULT now(),
  uploaded_by text
);

-- Handoff data (access, wifi, entry, building)
CREATE TABLE IF NOT EXISTS onboarding_unit_handoff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid REFERENCES onboarding_units(id) ON DELETE CASCADE UNIQUE,
  access_method text,
  access_location text,
  access_code text,
  building_entry_method text,
  building_code text,
  fob_count integer DEFAULT 0,
  parking_spot text,
  parking_method text,
  parking_code text,
  wifi_name text,
  wifi_password text,
  alarm_type text DEFAULT 'none',
  alarm_instructions text,
  concierge_name text,
  concierge_phone text,
  concierge_hours text,
  known_issues text,
  updated_at timestamptz DEFAULT now()
);

-- Audit history log per unit
CREATE TABLE IF NOT EXISTS onboarding_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid REFERENCES onboarding_units(id) ON DELETE CASCADE,
  actor text NOT NULL DEFAULT 'Admin',
  action text NOT NULL,
  detail text,
  ts timestamptz DEFAULT now()
);

-- Enable RLS on new tables (no policies — same as existing tables)
ALTER TABLE onboarding_unit_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_unit_handoff ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_history ENABLE ROW LEVEL SECURITY;

-- Widen stage checks for the 10-stage plan-based flow (v1 only allowed 7).
-- Also allow default_type = 'owner' for owner-facing software tasks.
ALTER TABLE onboarding_task_templates
  DROP CONSTRAINT IF EXISTS onboarding_task_templates_stage_check,
  DROP CONSTRAINT IF EXISTS onboarding_task_templates_default_type_check;
ALTER TABLE onboarding_task_templates
  ADD CONSTRAINT onboarding_task_templates_stage_check
    CHECK (stage = ANY (ARRAY[
      'Audit'::text, 'Furniture'::text, 'Client Approval'::text, 'Procurement'::text,
      'Photography'::text, 'Install'::text, 'App Setup'::text, 'Benchmark'::text,
      'Software'::text, 'Live'::text
    ])),
  ADD CONSTRAINT onboarding_task_templates_default_type_check
    CHECK (default_type = ANY (ARRAY[
      ''::text, 'onboarder'::text, 'va'::text, 'software'::text,
      'operations'::text, 'partner'::text, 'owner'::text
    ]));

ALTER TABLE onboarding_unit_stages
  DROP CONSTRAINT IF EXISTS onboarding_unit_stages_stage_check,
  DROP CONSTRAINT IF EXISTS onboarding_unit_stages_position_check;
ALTER TABLE onboarding_unit_stages
  ADD CONSTRAINT onboarding_unit_stages_stage_check
    CHECK (stage = ANY (ARRAY[
      'Audit'::text, 'Furniture'::text, 'Client Approval'::text, 'Procurement'::text,
      'Photography'::text, 'Install'::text, 'App Setup'::text, 'Benchmark'::text,
      'Software'::text, 'Live'::text
    ])),
  ADD CONSTRAINT onboarding_unit_stages_position_check
    CHECK (("position" >= 0) AND ("position" <= 9));

ALTER TABLE onboarding_tasks
  DROP CONSTRAINT IF EXISTS onboarding_tasks_stage_check;
ALTER TABLE onboarding_tasks
  ADD CONSTRAINT onboarding_tasks_stage_check
    CHECK (stage = ANY (ARRAY[
      'Audit'::text, 'Furniture'::text, 'Client Approval'::text, 'Procurement'::text,
      'Photography'::text, 'Install'::text, 'App Setup'::text, 'Benchmark'::text,
      'Software'::text, 'Live'::text
    ]));

ALTER TABLE onboarding_schedule
  DROP CONSTRAINT IF EXISTS onboarding_schedule_stage_check;
ALTER TABLE onboarding_schedule
  ADD CONSTRAINT onboarding_schedule_stage_check
    CHECK (stage = ANY (ARRAY[
      'Audit'::text, 'Furniture'::text, 'Client Approval'::text, 'Procurement'::text,
      'Photography'::text, 'Install'::text, 'App Setup'::text, 'Benchmark'::text,
      'Software'::text, 'Live'::text
    ]));

-- Reseed task templates: delete old rows, insert correct ones
TRUNCATE onboarding_task_templates;

INSERT INTO onboarding_task_templates (stage, label, default_type, sort) VALUES
-- Audit
('Audit', 'Schedule onboarder visit 1', 'partner', 10),
('Audit', 'Onboarder completes audit in cleaner app', 'onboarder', 20),
('Audit', 'Upload audit report PDF', 'va', 30),
('Audit', 'Review audit in cleaner app — approve or request changes', 'partner', 40),
-- Furniture Plan
('Furniture', 'Upload AI-generated room illustrations (from GPT skill)', 'va', 10),
('Furniture', 'Build room-by-room furniture sourcing list', 'va', 20),
('Furniture', 'Confirm all items within budget', 'va', 30),
('Furniture', 'Upload full furniture report PDF to docs', 'va', 40),
('Furniture', 'Internal review and admin approval', 'partner', 50),
-- Client Approval
('Client Approval', 'Upload furniture plan PDF', 'va', 10),
('Client Approval', 'Ryan approves each line item', 'partner', 20),
('Client Approval', 'Mark as sent to client via WhatsApp', 'partner', 30),
('Client Approval', 'Client approves budget and every line', 'partner', 40),
-- Procurement
('Procurement', 'Confirm delivery address (unit or home address)', 'partner', 10),
('Procurement', 'Place orders — Amazon, HomeSense, Dollarama and other stores', 'va', 20),
('Procurement', 'Confirm delivery dates for all orders', 'va', 30),
('Procurement', 'Receive and photograph all delivered items', 'onboarder', 40),
('Procurement', 'Confirm all items received and accounted for', 'partner', 50),
-- Photography
('Photography', 'Schedule photo shoot', 'partner', 10),
('Photography', 'Shoot on site', 'partner', 20),
('Photography', 'Edit & upload photos', 'partner', 30),
-- Install
('Install', 'Pick up items from delivery address (if not unit)', 'onboarder', 10),
('Install', 'Furniture install and staging per plan', 'onboarder', 20),
('Install', 'Photograph all installed furniture and rooms (reference photos)', 'onboarder', 30),
('Install', 'Cleaner confirmed for first turnover (manual)', 'partner', 40),
('Install', 'Final walkthrough and sign-off', 'partner', 50),
-- App Setup
('App Setup', 'Schedule onboarder visit 2', 'partner', 10),
('App Setup', 'Set up unit items and spots with reference photos', 'onboarder', 20),
('App Setup', 'Enter all inventory items with counts and thresholds', 'onboarder', 30),
('App Setup', 'Schedule recurring maintenance checks', 'onboarder', 40),
('App Setup', 'Film how-to videos for each system and room', 'onboarder', 50),
('App Setup', 'Review and publish guide clips to guidebook', 'partner', 60),
('App Setup', 'Cleaner confirmed for first turnover (manual — name and contact)', 'partner', 70),
-- Benchmark (Growth only — inserted but filtered by plan at runtime)
('Benchmark', 'Collect 12 months of revenue history from owner', 'va', 10),
('Benchmark', 'Enter monthly benchmarks for all 12 calendar months', 'va', 20),
('Benchmark', 'Admin reviews and confirms benchmarks', 'partner', 30),
-- Software Setup
('Software', 'Airbnb: photos, title, description, amenities', 'partner', 10),
('Software', 'Airbnb: house rules, check-in/out instructions', 'partner', 20),
('Software', 'Airbnb: pricing — nightly, cleaning fee, extra guest fee', 'partner', 30),
('Software', 'Airbnb: min/max stay, advance notice settings', 'partner', 40),
('Software', 'Connect to Hospitable — owner accepts connection', 'owner', 50),
('Software', 'Hospitable: messaging templates set up', 'partner', 60),
('Software', 'Hospitable: automated review templates', 'partner', 70),
('Software', 'Booking.com: listing live (set up in Hospitable)', 'partner', 80),
('Software', 'VRBO: owner creates account and authorizes', 'owner', 90),
('Software', 'PriceLabs: connected, base price, min price, orphan days set', 'partner', 100),
('Software', 'Cleaning fees set on all channels', 'partner', 110),
('Software', 'Guidebook: how-to videos published, URL set', 'partner', 120),
('Software', 'Test booking: reservation fires, messaging works, cleaning task created', 'partner', 130),
('Software', 'Save Hospitable property ID and Airbnb URL to property record', 'partner', 140),
-- Live
('Live', 'Confirm all channels live — Airbnb, Hospitable, Booking, VRBO', 'partner', 10),
('Live', 'Confirm iCal sync active — cleaning tasks generating', 'partner', 20),
('Live', 'Confirm first cleaning task created in cleaner app', 'partner', 30),
('Live', 'Notify client — property is live', 'partner', 40),
('Live', 'Record live date', 'partner', 50);
