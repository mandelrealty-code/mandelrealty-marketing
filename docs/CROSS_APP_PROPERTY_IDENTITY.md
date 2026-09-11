# Cross-app property identity

## Canonical key

**`hospitablePropertyId`** — the Hospitable property UUID.

- Same ID used by Hospitable Public API v2 and Hospitable MCP (`https://mcp.hospitable.com/mcp`).
- Do **not** rewrite local primary keys to this UUID (except CohostAI, which already uses it as `properties.id` / `hosp_id`).

## Registry

Admin OPS table `pm_properties` is the map of record:

| Column | Meaning |
|--------|---------|
| `id` | Admin local PK |
| `hospitable_property_id` | Hospitable UUID |
| `hub_property_id` | Cleaner Hub `properties.id` |
| `guidebook_property_id` | Guidebook `properties.id` |

## Per-app storage

| App | Local PK | Hospitable field |
|-----|----------|------------------|
| Admin | `pm_properties.id` (uuid) | `hospitable_property_id` |
| Cleaner Hub | `properties.id` (uuid) | `hospitable_property_id` |
| Guidebook | `properties.id` (text) | `hospitable_property_id` column + `data.hospitablePropertyId` |
| CohostAI | `properties.id` (= Hospitable UUID) | `hosp_id` / `id` |

## Resolve contract

Service-to-service calls **pass `hospitablePropertyId`**. Each app looks up its local row:

```ts
// Pseudocode
const local = await db.from('properties')
  .select('id')
  .eq('hospitable_property_id', hospitablePropertyId)
  .maybeSingle();
```

Admin resolves sibling apps via bridge columns after the inventory link pass.

## Event payload shape (Phase 2+)

```json
{
  "type": "inventory.low | turnover.completed | review.negative",
  "hospitablePropertyId": "<uuid>",
  "occurredAt": "<iso>",
  "payload": {}
}
```

## Deep links (production)

| App | Base | Property URL pattern |
|-----|------|----------------------|
| Cleaner Hub | `https://portal.stravo.ai` | `/properties/{hub_property_id}` |
| Guidebook | Guidebook deploy host | `/editor/{guidebook_property_id}` |
| CohostAI | `https://chat.stravo.ai` | Messages tab (property = Hospitable id) |
| Hospitable | dashboard | property settings by UUID |

## Migrations to apply

1. Cleaner Hub: `supabase/migrations/20260911120000_hospitable_property_id.sql`
2. Guidebook: `supabase/migration_hospitable_property_id.sql`
3. Admin: columns already exist (`pm_hospitable_v1.sql` / `pm_clients_v1.sql`)
