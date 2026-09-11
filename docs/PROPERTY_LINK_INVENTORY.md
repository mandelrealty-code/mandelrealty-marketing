# MRG property link inventory

Use this checklist after applying identity migrations. Goal: every live unit has the **same Hospitable UUID** in Admin, Cleaner Hub, Guidebook, and CohostAI (or an explicit “not onboarded” note).

## How to fill

1. In Hospitable (API / MCP): list all properties → copy UUID + name.
2. In Admin OPS → each property → **App links** panel: set Hospitable ID, Cleaner Hub ID, Guidebook ID.
3. In Cleaner Hub → Edit property → set **Hospitable property ID**.
4. In Guidebook → Guests / Hospitable Connect → link listing (saves column + JSON).
5. In CohostAI → Properties sync from Hospitable (id should already match).

## Status legend

| Status | Meaning |
|--------|---------|
| Linked | Hospitable UUID present and bridge IDs set |
| Missing Cleaner | No `hub_property_id` / Cleaner row |
| Missing Guidebook | No `guidebook_property_id` |
| Missing Cohost | Not in CohostAI workspace |
| Missing Hospitable | Admin row has no `hospitable_property_id` |

## Checklist template

| Hospitable UUID | Name / address | Admin `pm_properties.id` | Cleaner `hub_property_id` | Guidebook id | Cohost synced | Status |
|-----------------|----------------|--------------------------|---------------------------|--------------|---------------|--------|
| | | | | | Y/N | |
| | | | | | Y/N | |
| | | | | | Y/N | |

## Admin API helper

After Hospitable PAT is connected:

```http
POST /api/admin
{ "resource": "properties", "op": "link_health" }
```

Returns each Admin property with link flags (`has_hospitable`, `has_hub`, `has_guidebook`) for triage.

## Success criteria

Given any Hospitable UUID you can resolve:

1. Admin `pm_properties` row  
2. Cleaner Hub property (or “not onboarded”)  
3. Guidebook property (or “not onboarded”)  
4. CohostAI property (or “not onboarded”)  
