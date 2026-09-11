# Phase 2 ops workflows

Admin OPS creates VA tasks from ops signals. Identity must be linked first
(`docs/CROSS_APP_PROPERTY_IDENTITY.md`).

## API ops (`POST /api/admin` resource `properties`)

| op | Purpose |
|----|---------|
| `workflow_negative_reviews` | Open tasks for cached reviews ≤4★ |
| `workflow_supply_reorder` | Open supplies task for an item |
| `workflow_turnover_qa` | Open cleaning QA task after turnover |
| `link_health` | Inventory of bridge ID completeness |
| `resolve_hospitable` | Map Hospitable UUID → Admin + hub + guidebook IDs |
| `link_apps` | Set hospitable / hub / guidebook IDs |

## Automatic hook

`syncHospitableReviews` also runs `ensureNegativeReviewTasks` after sync (non-blocking).

## Manual UI

Property detail → **Create ≤4★ review tasks**.

## Next integrations

1. Cleaner Hub low-stock webhook → `workflow_supply_reorder` with Admin property id from `resolve_hospitable`.
2. Cleaner Hub turnover complete → `workflow_turnover_qa`.
3. Knowledge Hub write-through from Guidebook/CohostAI (MCP).
