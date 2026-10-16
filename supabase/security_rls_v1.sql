-- OPTIONAL BACKUP. The live database already shows RLS enabled on all 57 tables (Security Advisor), so this is hardening,
-- not a fix: see section 7 of docs/security/rls-audit.md. Do not run it unless you want the extra grant revokes.
--
-- Security hardening v1 (Admin database): turn on Row Level Security and cut off public access on every table this
-- repo created. PROPOSAL: NOT RUN. Read docs/security/rls-audit.md first, then run once in the Supabase SQL editor of the
-- COPILOT/ADMIN project (the one with pm_properties and copilot_messages), never the cleaner app's project.
--
-- Why: 38 of this repo's 57 tables never enable RLS, including pm_settings (holds the Hospitable access token and the MCP
-- token in plain text), portal_users and staff_users (password hashes and invite tokens), copilot_hospitable, and every
-- copilot_* and pm_* table. Without RLS, anyone holding the project's public anon key can read and change them through
-- Supabase's REST API. Nothing in this repo uses that key: the app only ever connects with the service-role key, which
-- bypasses RLS, so this changes nothing the app does.
--
-- What it does, for every table in the list:
--   * enables RLS with NO policies (the service role is the only way in), and
--   * revokes all access from anon and authenticated (so a later mistake can't reopen the table).
-- It adds NO policies, because the audit found nothing that reads or writes these tables as a signed-in or anonymous
-- user. If something outside this repo (the Guidebook, a no-code tool) does, it will stop working: see the audit.
--
-- Safe to re-run. Roll back one table with:  alter table public.<name> disable row level security; grant all on public.<name> to anon, authenticated;

do $$
declare
  t text;
  tables text[] := array[
    -- Copilot
    'copilot_chats', 'copilot_check_state', 'copilot_dismissals', 'copilot_hospitable', 'copilot_jobs', 'copilot_memory',
    'copilot_memory_claims', 'copilot_memory_files', 'copilot_messages', 'copilot_open_items', 'copilot_reminders',
    'copilot_runs', 'copilot_skills', 'copilot_text_log', 'copilot_text_numbers',
    -- OPS / property management
    'pm_clients', 'pm_commission_terms', 'pm_company_expenses', 'pm_company_subscriptions', 'pm_contract_templates',
    'pm_contracts', 'pm_manual_expenses', 'pm_mat_filings', 'pm_outreach_outcomes', 'pm_properties', 'pm_proposals',
    'pm_reservations', 'pm_review_reply_jobs', 'pm_reviews', 'pm_settings', 'pm_sops', 'pm_tasks', 'pm_team_members',
    'pm_time_entries',
    -- Logins and portals
    'portal_ask_messages', 'portal_users', 'staff_users',
    -- CRM and others that already enable RLS in their own migration: revoked here too (defense in depth)
    'sms_drafts', 'leads', 'lead_calls', 'lead_followups', 'lead_sms_messages', 'call_bookings', 'crm_settings',
    'knowledge_docs', 'knowledge_chunks', 'revenue_audit_reports', 'revenue_audit_unlock_codes'
  ];
begin
  foreach t in array tables loop
    -- Skip a table that doesn't exist here (a migration that was never run).
    continue when to_regclass(format('public.%I', t)) is null;
    execute format('alter table public.%I enable row level security', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table public.%I from anon', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on table public.%I from authenticated', t);
    end if;
  end loop;
end $$;

-- Optional but recommended, and a separate decision: stop NEW tables from being open by default. Supabase gives anon and
-- authenticated full access to every new table in public. After this, a table made later in the SQL editor starts closed,
-- so forgetting RLS can't leak it. It does not change any existing table. Skip it if another app that shares this project
-- creates tables with the default grants.
--
-- alter default privileges in schema public revoke all on tables from anon, authenticated;
-- alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- ---------- Check it worked (read only) ----------
-- Any row returned is a table that is still open:
--   select c.relname, c.relrowsecurity as rls_on
--   from pg_class c join pg_namespace n on n.oid = c.relnamespace
--   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity order by 1;
--   select table_name, grantee, privilege_type from information_schema.role_table_grants
--   where table_schema = 'public' and grantee in ('anon', 'authenticated') order by 1, 2;
-- (Tables from other apps sharing the project will appear too. They are not this file's business.)
