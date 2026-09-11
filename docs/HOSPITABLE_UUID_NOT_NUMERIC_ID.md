# Hospitable property identifiers

Hospitable’s UI shows two different values:

| Hospitable UI | Example | Use in our stack? |
|---------------|---------|-------------------|
| **Copy UUID** | `7dd47609-47ea-4279-b1b7-89e0c9de3426` | **Yes — always** |
| **Copy ID** (also in URL `/properties/property/2063888/…`) | `2063888` | **No** |

## Why UUID

- Public API v2 paths use property UUIDs.
- Hospitable MCP tools require `uuid` (e.g. `get-property`).
- Admin `hospitable_property_id`, Guidebook `hospitable_property_id`, CohostAI `properties.id`, Cleaner Hub `hospitable_property_id` all store the **UUID**.

## Rule

If it has dashes and looks like `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`, it’s correct.  
If it’s only digits (URL segment), discard it.
