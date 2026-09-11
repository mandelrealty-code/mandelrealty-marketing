# Hospitable property identifiers

Hospitable’s UI shows two different values:

| Hospitable UI | Example | Use in our stack? |
|---------------|---------|-------------------|
| **Copy UUID** | `7dd47689-47ea-4279-b1b7-89e0c9de3426` | **Yes — shared key for every app / API / MCP** |
| **Copy ID** (also in URL `/properties/property/2063888/…`) | `2063888` | **Only for Admin “Open” deep link** (`hospitable_dashboard_id`) |

## Why UUID for apps

- Public API v2 paths use property UUIDs.
- Hospitable MCP tools require `uuid` (e.g. `get-property`).
- Admin `hospitable_property_id`, Guidebook `hospitable_property_id`, CohostAI `properties.id`, Cleaner Hub `hospitable_property_id` all store the **UUID**.

## Why numeric id for Open

`https://my.hospitable.com/properties/property/2063888/overview` uses the dashboard numeric id. The website does not open by UUID. Store that number (or paste the full URL) under Admin → Edit links → **Hospitable dashboard ID** so Open goes to the right page.

## Rule

- Dashed UUID → apps / sync / MCP.  
- Digits only → Hospitable website Open only — never paste into Cleaner Hub / Guidebook / Cohost fields.
