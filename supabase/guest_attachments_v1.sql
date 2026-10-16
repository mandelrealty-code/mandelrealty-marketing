-- Guest message attachments (photos, receipts): a PRIVATE bucket of their own, apart from contracts. Run once in the
-- Supabase SQL editor of the COPILOT/ADMIN project. Safe to re-run. NOT YET RUN.
--
-- Copilot uploads here with the service-role key and gives Hospitable an expiring signed link (24 hours by default, set
-- GUEST_ATTACHMENT_TTL_HOURS to change it). A public link is never made. Allergy information can appear in a photo, and a
-- receipt can show an address or part of a card number: these files must not be reachable by anyone who guesses a URL.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guest-attachments', 'guest-attachments', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false;

-- Only if the dashboard shows pm-contracts as PUBLIC (it was created private, and every other file in it is served by an
-- expiring signed link, so making it private again breaks nothing except the old guest-message links):
-- update storage.buckets set public = false where id = 'pm-contracts';
