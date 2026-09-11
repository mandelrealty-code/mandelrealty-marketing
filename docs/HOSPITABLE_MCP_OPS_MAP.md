# Hospitable MCP → MRG ops plan

MCP URL: `https://mcp.hospitable.com/mcp` (OAuth in Cursor / Claude / ChatGPT).

**Not connected in this Cursor session yet** — you need to add it under Cursor Settings → MCP (see runbook).

Apps still use the **REST API + PAT** for reliable automation. MCP is for agent/ops assistance and Knowledge Hub edits beside the apps.

## Map to your spreadsheet (Ongoing)

| Ops task | MCP tools | App that owns the work |
|----------|-----------|------------------------|
| **Guest messaging** | `get-property-knowledge-hub`, `create/update-knowledge-hub-item`, `get-reservation-messages`, `send-reservation-message`, `get-messaging-rules` | CohostAI + Hospitable KB as source of truth; Guidebook consumes facts |
| **Client listing/unit changes** | `get-property`, `update-property-calendar`, `tag-property` | Process via VA + Admin tasks; MCP for quick lookups |
| **Scheduling & pricing** | `get-property-calendar`, `update-property-calendar` | Hospitable (Rita/cohost access); MCP assists |
| **Supply reordering** | (no Amazon) — use Cleaner inventory + Admin `workflow_supply_reorder` | Cleaner Hub + VA Amazon lists (SOP) |
| **Maintenance / turnover checks** | `get-tasks`, `create-task`, `update-task` | Cleaner Hub turnovers; Admin QA tasks; optional Hospitable tasks via MCP |
| **Replying to reviews** | `get-property-reviews`, `respond-to-review` | Admin review sync + ≤4★ tasks; MCP can draft/post 5★ replies |
| **Negative review disputes** | `get-property-reviews` + Admin tasks | Already: sync → `ensureNegativeReviewTasks` |
| **Preventative maintenance** | `create-task` / Cleaner preventative templates | Cleaner Hub |
| **Quarterly / owner reports** | `get-owner-statements`, `get-payouts`, `get-transactions` (Mogul for statements) | Admin Month close (already Hospitable API) |
| **Claim handling** | Enrichment + tasks | Manual / future |
| **Airbnb listing optimization** | `get-property`, `get-property-images`, `get-property-reviews` | Research via MCP; edits still in channel/Hospitable UI |

## Highest-value MCP uses for V1

1. **Knowledge Hub as source of truth** — read/write facts once; Guidebook + CohostAI dual-read later.
2. **Inbox assist** — draft replies with Hub context; send only when you intend (tools send for real).
3. **Review replies** — `respond-to-review` for 5★; ≤4★ stay in Admin tasks.
4. **Ops questions** — “what’s checking in tomorrow?”, calendars, alerts (`get-alerts`).
5. **Hospitable Tasks** — optional mirror of VA work (`create-task`) once Cleaner/Admin are linked.

## Safety

- Messaging and review responses are **live**.
- Start read-only (`get-properties`, `get-reservations`, `get-property-knowledge-hub`).
- Primary account or full-access secondary user required.
- Not on Essentials plan.
