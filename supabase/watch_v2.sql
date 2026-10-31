-- Watch loop v2: surfaced items live only in the Overview Decisions queue (no chats), so each one keeps its own payload.
-- Run once in the Copilot Supabase project (NOT the cleaner app's project). Safe to run again. After watch_v1.sql.
-- Nothing here sends mail or messages.

alter table copilot_watch_items add column if not exists payload text not null default '';
