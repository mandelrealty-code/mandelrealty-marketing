-- Hospitable MCP fallback bearer token for Copilot.
-- This is not the Public API personal access token.
-- Safe to run after pm_hospitable_v1.sql.

alter table public.pm_settings
  add column if not exists hospitable_mcp_token text not null default '';

comment on column public.pm_settings.hospitable_mcp_token is
  'Hospitable MCP fallback bearer token (Settings → Integrations → MCP). Server-only. Not the Public API PAT.';
