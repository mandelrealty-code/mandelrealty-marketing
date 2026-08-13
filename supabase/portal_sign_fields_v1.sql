-- Signature field boxes on PDFs (DocuSign-style). Run after portal_owner_v1.sql.

alter table public.pm_contracts
  add column if not exists sign_fields jsonb not null default '[]'::jsonb;

alter table public.pm_contract_templates
  add column if not exists sign_fields jsonb not null default '[]'::jsonb;

comment on column public.pm_contracts.sign_fields is
  'Boxes on the PDF: [{id,type,page,x,y,w,h}] fractions of page, origin top-left. type=signature|name|date';
