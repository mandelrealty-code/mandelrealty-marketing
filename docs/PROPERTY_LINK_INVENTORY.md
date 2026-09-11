# MRG property link inventory

**Preferred path:** import/link from Hospitable in each app (picker), then register local IDs in Admin App links. Blank Cleaner/Guidebook = not onboarded for that app.

## Status legend

| Status | Meaning |
|--------|---------|
| Linked | Hospitable UUID + optional bridges set |
| Missing Cleaner | No Cleaner Hub row / `hub_property_id` |
| Missing Guidebook | No Guidebook (OK if intentional) |
| Missing Cohost | Not synced in CohostAI |
| Missing Hospitable | Admin has no `hospitable_property_id` |

## Checklist

| Hospitable UUID | Name | Admin | Cleaner hub id | Guidebook id | Cohost | Notes |
|-----------------|------|-------|----------------|--------------|--------|-------|
| | | | | | Y/N | |

## Admin helper

```http
POST /api/admin  { "resource": "properties", "op": "link_health" }
```

Full steps: [CONNECT_PROPERTIES_RUNBOOK.md](./CONNECT_PROPERTIES_RUNBOOK.md)
