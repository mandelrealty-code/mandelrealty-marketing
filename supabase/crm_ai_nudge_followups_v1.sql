-- Allow AI silence-nudge rows on lead_followups (3h / 24h / 72h).
-- Safe to re-run. Existing hot_sms / nurture_sms rows stay valid.

do $$
declare
  r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'lead_followups'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%hot_sms%'
      and pg_get_constraintdef(con.oid) ilike '%nurture_sms%'
      and pg_get_constraintdef(con.oid) not ilike '%ai_nudge%'
  loop
    execute format('alter table public.lead_followups drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.lead_followups
  drop constraint if exists lead_followups_sequence_check;

alter table public.lead_followups
  add constraint lead_followups_sequence_check
  check (sequence in ('hot_sms', 'nurture_sms', 'ai_nudge'));
