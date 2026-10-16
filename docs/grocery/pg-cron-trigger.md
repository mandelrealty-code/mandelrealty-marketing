# Grocery trigger: Supabase pg_cron, every 5 minutes, Toronto time (design, not installed)

## What it does

Every 5 minutes a Supabase `pg_cron` job makes one HTTP call to Copilot. Copilot then looks at every
open grocery order and does only three things: **reads** (Hospitable, the cleaner app), **drafts** (guest
messages into the partner approval queue), and **alerts** (tasks and Overview cards). It never sends a guest
message, places an order or asks for money. That stays a partner pressing a button.

## Why it is not on Vercel's cron

Copilot's checks run at 5 AM and 1 PM Toronto from `vercel.json`. That is too coarse for the 24 hour and 72 hour
rules, the delivery window alert, and "reminder after 2 days". The cleaner app already uses `pg_cron` every
5 minutes (`poll-turnover-clocks`), so this follows the same pattern. It doesn't depend on the Vercel plan.

## Toronto time and daylight saving

The job fires every 5 minutes in UTC and the time logic lives in code, not in the cron schedule:

- `groceryRules.ts` computes every due time with `fromToronto` (DST-aware): the offer at 9:00 AM Toronto,
  the reminder at the same Toronto time 2 days later, the 72 h lock, the 24 to 48 h order window.
- The tick asks "is anything due right now?" each time, so nothing needs the cron to know about DST.
  The harness proves 9:00 AM Toronto on both sides of the November change.

## The job (run in the ADMIN Supabase project, once approved)

```sql
-- Extensions (Database, Extensions, or via SQL).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- The shared secret lives in Vault, never in this SQL.
-- select vault.create_secret('<same value as the app's CRON_SECRET>', 'grocery_cron_secret');

select cron.schedule(
  'grocery-tick',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://admin.mandelrealtygroup.com/api/cron/follow-ups?job=grocery',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'grocery_cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);

-- To stop it:  select cron.unschedule('grocery-tick');
```

## The handler (Phase 2, no new serverless function)

The marketing project is capped at 12 serverless functions. The tick is a new `job=grocery` branch inside the
existing `api/cron/follow-ups.ts`, which already authenticates with `CRON_SECRET` and runs up to 60 seconds.

Each tick, in order, and each step independent so one failure doesn't stop the rest:

1. Read open orders. Expire any whose list locked with no reply (`isExpired`).
2. Queue due drafts into `grocery_messages`: offers (`offerDue`), the 2 day reminder (`reminderDue`, only if no
   reply), estimates, missing-item notices. Each is checked by `validateGroceryMessage`; a draft with a problem is
   queued with the problem shown and cannot be approved.
3. Read new guest replies for orders awaiting one (Hospitable, rate-limited: threads are cached and re-read only
   when `last_message_at` moves). Store what the guest wrote against the order.
4. Pull cleaner confirmations and received ticks from the cleaner app.
5. Run `groceryAlerts` and raise each alert once (`grocery_alerts.key`), as a task plus an Overview card.

## Safety

- **Idempotent.** Every step keys on stable ids (`grocery_alerts.key`, one live order per reservation part,
  one queued draft per order and kind). Running twice changes nothing.
- **No overlap.** Phase 2 adds a lease column so a slow tick isn't doubled by the next one.
- **Fails closed.** If the tick or Hospitable fails, nothing is sent: drafts wait and alerts are raised late.
- **Visible.** Overview's connection health shows "last grocery check" and warns if no tick has run in 30 minutes.
  `cron.job_run_details` in Supabase shows every run.
- **Secret handling.** The bearer secret is in Vault and the handler rejects anything without it. Admin APIs stay
  locked to the admin host.
