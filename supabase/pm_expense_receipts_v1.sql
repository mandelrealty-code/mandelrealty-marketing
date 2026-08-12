-- Expense receipts for owner charges on monthly statements.
-- Run after pm_earnings_contracts_v1.sql

alter table public.pm_manual_expenses
  add column if not exists receipt_filename text not null default '';

alter table public.pm_manual_expenses
  add column if not exists receipt_mime text not null default '';

alter table public.pm_manual_expenses
  add column if not exists receipt_storage_path text not null default '';

comment on column public.pm_manual_expenses.receipt_storage_path is
  'Supabase storage path in pm-contracts bucket (expense-receipts/…)';
