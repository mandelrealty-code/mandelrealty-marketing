# Supabase security audit (Admin/Copilot project): what is open, what would break

> **Update (live result):** the Security Advisor shows all 57 tables as "RLS Enabled, No Policy" with 0 errors, so the
> tables were never open to the anon key. The migration files simply didn't say so. They do now: every table's migration
> declares RLS, and `npm run rls-harness` fails if a new table is added without it. No token rotation is needed.
> Sections 2 and 3 below describe the risk had the tables been open; section 1 (no anon-key use in this repo) and
> section 4 (the storage bucket) still stand. The grant revokes in `security_rls_v1.sql` are optional hardening, not a fix.

Status: read-only audit and PROPOSALS. Nothing in this document has been run. The migration is
`supabase/security_rls_v1.sql`.

## 1. Where the code uses the anon key

**Nowhere, for the Admin/Copilot project.**

- The only Supabase client in this repo is `getSupabaseAdmin()` in `shared/supabase.ts`. It reads
  `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` and returns nothing if either is missing. There is no fallback to an
  anon key. It runs only on the server (Vercel functions) and in one maintenance script
  (`scripts/pause-ai-sms.mjs`, also service role).
- No file under `src/` imports `@supabase/supabase-js` or calls Supabase's REST or storage URLs. There are no
  `VITE_SUPABASE_*` variables, so the browser bundle has no Supabase key at all.
- Every `CLEANER_HUB_ANON_KEY` reference (`ops.ts`, `purchase.ts`, `cleanerRead.ts`, `upsell.ts`, `cleanerHubSync.ts`) is
  for a DIFFERENT project, the cleaner app (`hyndmdjvjlsbthlqrxge`), and is used only to call its `ops-hub-sync` edge
  function. It never reads an Admin table.

So no table in this project is read or written by the anon key from this repo. RLS with no policies matches how the
code already works.

## 2. What is open (according to the migration files)

57 tables are created by `supabase/*.sql`. **38 have no RLS statement in any migration** (and no migration creates a
policy or a grant). Whether they are open in the live project depends on that project's settings; the Security Advisor in
Supabase shows it ("RLS disabled in public").

Highest risk, if unrestricted and the anon key is known to anyone:

| Table | What is in it |
|---|---|
| `pm_settings` | `hospitable_pat` and `hospitable_mcp_token`, **in plain text**: full access to your Hospitable account, including sending guest messages |
| `portal_users` | host-portal logins: `password_hash`, `invite_token` |
| `staff_users` | employee logins: `password_hash`, `invite_token` |
| `copilot_hospitable` | the Hospitable token, encrypted (`cipher`) |
| `copilot_chats`, `copilot_messages` | every Copilot chat and every guest draft |
| `copilot_text_numbers`, `copilot_text_log` | partner phone numbers and texts |
| `pm_clients`, `pm_properties`, `pm_reservations`, `pm_contracts`, `pm_manual_expenses`, `pm_proposals`, ... | owners, properties, bookings, contracts, money |
| `sms_drafts` | texts to leads |

The anon key is "public" by design: it is meant to sit in a browser. It is not in this repo's frontend, which lowers the
risk, but anyone who has ever seen it (another app, a screenshot, a no-code tool, a former contractor) could use it.

## 3. What would break if RLS is enabled and anon access revoked

**In this repo: nothing.** The server uses the service-role key, which bypasses RLS. The frontend never touches Supabase.
`supabase/security_rls_v1.sql` adds no policies because no policy is needed.

**Outside this repo, unknown, and the one thing to check before running it.** Anything else that connects straight to
this project's database with the anon key would stop working. Candidates named in the docs: the Guidebook, CohostAI
(`chat.stravo.ai`), and any no-code tool (Zapier, Make, Lovable apps, Google Sheets add-ons). To check:

1. Supabase, **Settings, API**: confirm which project's anon key those apps embed (compare the project id).
2. Supabase, **Logs, API Gateway** (or "API" logs): look for requests to `/rest/v1/...` made with the anon role over the
   last 30 days. Requests from `admin.mandelrealtygroup.com` are the server (service role); anything else is a client.
3. If an app does need a table, we add a narrow policy for exactly that table and nothing else.

If nothing external shows up, run the migration. It is reversible per table (see the file header).

## 4. The `pm-contracts` storage bucket

Facts:

- Created **private** (`public = false`, 10 MB limit, PDFs and images only) by `supabase/pm_earnings_contracts_v1.sql`.
- It holds: signed contracts and templates, proposals (`proposals/`), expense receipts (`expense-receipts/`), property
  covers, SOP images and videos, and guest-message attachments (`guest-messages/`).
- Every file served from it uses an expiring signed link (10 minutes to 1 year, depending on the file)... **except one
  call**: `shared/copilot/guestMessaging.ts:1585` builds the guest attachment link with `getPublicUrl`.

That is a contradiction, and one of two things is true:

- **The bucket is still private.** Then a public link returns an error, and photos attached to guest messages from Copilot
  have never loaded for the guest. This is what the Phase 0 image test will show.
- **Someone switched the bucket to public in the dashboard.** Then every file in it, contracts and receipts included, is
  reachable by anyone who has or guesses the link.

**Please check:** Supabase, Storage, `pm-contracts`: is it marked Public?

Proposal (after you confirm which):

1. **Keep `pm-contracts` private** and force it: `update storage.buckets set public = false where id = 'pm-contracts';`
2. **A separate private bucket for guest attachments**, so a guest photo or receipt never shares a bucket with contracts:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guest-attachments', 'guest-attachments', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
```

3. **Code change** (not made): `guestMessaging.ts` uploads to `guest-attachments` and sends a **signed link that expires**
   (`createSignedUrl`, for example 1 hour) instead of `getPublicUrl`. The right expiry depends on the image test: if
   Hospitable copies the image to Airbnb when the message is sent, a short expiry is enough; if Airbnb loads it later
   from the link, a longer one (or Airbnb-side hosting) is needed. Files older than 30 days get deleted.
4. Receipts that show an address or the last 4 digits of a card stay in `pm-contracts` (private, signed links of
   minutes), never in `guest-attachments`.

## 5. Secrets stored in plain text

`pm_settings.hospitable_pat` and `pm_settings.hospitable_mcp_token` hold the tokens unencrypted. (`copilot_hospitable`
encrypts its copy; these two do not.) After RLS is on they are only readable by the service role, which is the same
exposure as an environment variable. Two follow-ups, separate from this migration:

- If the anon key was ever exposed while these tables were open, **rotate both tokens** in Hospitable and every invite
  token, and force a password change for portal and staff users.
- Later, move both tokens to an encrypted column like `copilot_hospitable.cipher`, or to environment variables.

## 6. Order of operations

1. You check the Security Advisor and the bucket's Public flag, and the API logs for outside users of the anon key.
2. If clean: run `security_rls_v1.sql` (Admin project only).
3. If the tables were open: rotate the tokens (section 5).
4. Create the `guest-attachments` bucket and change the guest-message upload, after the image test.
5. Phase 2 of the groceries work resumes.

## 7. Do the grant revokes add real protection, now that RLS is on? (verdict)

RLS on with no policies already refuses every row to `anon` and `authenticated`. The revokes in `security_rls_v1.sql`
add three smaller things:

1. **They survive a later mistake.** If someone turns RLS off on a table, or adds a permissive policy for one feature,
   a revoked table stays closed.
2. **They hide the table.** Without a grant, Supabase's public REST schema doesn't list the table or its columns to
   someone holding the anon key.
3. **They match `grocery_v2.sql`**, which already does this for the grocery tables.

Cost: low. Risk: only an outside app connecting directly with the anon key (none known). **My recommendation: don't run
it now.** The live database is already protected and the files now describe it. If you do one thing, run only the
optional `alter default privileges` statement at the end of that file, so a table made in the SQL editor later starts
closed even if someone forgets RLS.

## 8. What changed in the repo after this audit

- Every migration file that creates a table now ends with its `alter table ... enable row level security;` line
  (appended only; no existing line was changed), and `supabase/security_rls_v1.sql` is kept as an optional backup.
- `npm run rls-harness` checks that every `create table` has an RLS line, that no migration creates a policy, and that none
  grants access to `anon` or `authenticated`.
- Guest message attachments now go to a private `guest-attachments` bucket and are sent as expiring signed links
  (`supabase/guest_attachments_v1.sql` creates the bucket; not yet run). The old public-link code is gone.
- The three grocery trigger functions pin `search_path`, which clears Supabase's "Function Search Path Mutable" warning.
