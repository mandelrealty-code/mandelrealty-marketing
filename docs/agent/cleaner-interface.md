# Cleaner app: what the business agent needs from it

The agent (shared/copilot/agentChat.ts) is in the Copilot repo. The cleaner app is a separate repo and a separate Supabase project
(hyndmdjvjlsbthlqrxge). Cursor builds the cleaner side. This is the interface the Copilot side needs. Nothing here is built on the
cleaner side yet; the one read that exists today is `cleaner_read` (toolServer.ts -> skillExecute.cleanerTool).

## Reads (agent calls these; read only)

| Read | Input | Returns |
|---|---|---|
| turnovers | property_id, from, to (YYYY-MM-DD) | per turnover: id, property_id, date, check_out_time, next_check_in, status (scheduled / in_progress / done / issue), cleaner first name, started_at, finished_at |
| checklist | turnover_id | items done / not done, notes the cleaner left |
| photos | turnover_id | signed URLs (short-lived), caption, taken_at |
| supplies | property_id | item, quantity on hand, par level, last restocked |
| issues | property_id, since | cleaner-reported issues: id, turnover_id, text, photo URLs, reported_at, resolved |

## Writes (the agent only PROPOSES; a partner approves in the Copilot before anything is written)

| Write | Input | Notes |
|---|---|---|
| request_turnover_note | turnover_id, text | a note the cleaner sees on the job |
| assign_cleaner | turnover_id, cleaner_id | already exists as a prepared, approval-gated action (ops.prepareCleanerAssignment) |
| restock_request | property_id, item, quantity | feeds the grocery queue; approval stays with the partner |

## How the Copilot reaches it

- One server-side endpoint on the cleaner side, bearer-token auth (`CLEANER_HUB_SYNC_KEY` already exists as the shared secret; `CLEANER_HUB_SYNC_URL` is the base).
- Read-only keys for reads; writes use a separate key and are only called after a partner presses approve.
- Cross-repo needs (cleaner side): the five reads above as one authenticated JSON API; signed photo URLs; an issues feed.
