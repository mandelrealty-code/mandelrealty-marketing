# Guest / client / MRG knowledge buckets

Canonical property key: **Hospitable UUID** (Admin registry).

| Bucket | Who sees it | Source of truth | Apps |
|--------|-------------|-----------------|------|
| **Guest facts** | Guests | **Hospitable Knowledge Hub** | CohostAI drafts (dual-read Hub → local `kb_entries` fallback); Guidebook Concierge (`aiKnowledge` seeded from Hub on connect) |
| **Field ops** | Cleaners | Cleaner Hub | Rooms, checklists, inventory (not guest-facing) |
| **Client money** | Owners | Admin month-close | Statements / host portal — never Guidebook or Hub |
| **MRG ops** | You / VA | Admin Tasks + registry | Attention queue; deep links to Cleaner / Hospitable / Guidebook |

## Write paths (guest facts)

1. Prefer editing in **Hospitable Knowledge Hub**.
2. CohostAI: approving a saved answer also **write-through** to Hub (best effort).
3. Guidebook: on Hospitable connect, if Concierge knowledge is empty, **pull Hub** into `aiKnowledge`.

## Do not mix

- Owner revenue / commissions → Admin only  
- Inventory / checklists → Cleaner only  
- Guest Wi‑Fi / how-to / area tips → Hub (+ Guidebook / Cohost)
