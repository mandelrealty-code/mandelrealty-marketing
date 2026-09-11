# Connect all MRG properties — what you do vs what we built

## How connection works now

1. **Hospitable** is the catalog of real units (API uses **UUID**; the website URL uses a separate **numeric** id).
2. **Admin OPS** imports a unit → stores the Hospitable UUID.
3. Click **Create / open in Cleaner Hub** on the property — Admin creates or finds the Cleaner property, saves the Cleaner id, and opens it. Adjust rooms / checklists / inventory there.
4. Guidebook stays optional: connect in Guidebook when needed, then paste `/editor/…` id (or leave blank).
5. For Hospitable **Open** in Admin: paste the numeric dashboard id (or full property URL) under Edit links once — e.g. `2063888` from  
   `https://my.hospitable.com/properties/property/2063888/overview`

---

## A. One-time setup (you + Cursor)

### A1. Run SQL in Cleaner Hub Supabase

SQL Editor → run **both** (if not already):

1. `hospitable_property_id` column (from earlier)
2. `owner_integrations` table — file:  
   `property-cleaner-hub/supabase/migrations/20260911130000_owner_integrations_hospitable.sql`

### A1b. Admin OPS SQL (Hospitable Open link)

In Admin Supabase SQL Editor run:

`mandelrealty-marketing/supabase/pm_hospitable_dashboard_id_v1.sql`

### A2. Deploy Cleaner edge functions

From `property-cleaner-hub`:

```bash
npx supabase functions deploy hospitable-proxy --project-ref hyndmdjvjlsbthlqrxge
npx supabase functions deploy ops-hub-sync --project-ref hyndmdjvjlsbthlqrxge
npx supabase secrets set OPS_HUB_SYNC_KEY=<same as Admin CLEANER_HUB_SYNC_KEY> --project-ref hyndmdjvjlsbthlqrxge
```

(Optional) `OPS_HUB_OWNER_USER_ID` = your Cleaner login user uuid. If unset, new properties inherit `owner_id` from an existing Cleaner property.

### A3. Run Guidebook SQL (if not done)

`Guidebook/supabase/migration_hospitable_property_id.sql`

### A4. Connect Hospitable MCP in Cursor (for agent ops)

1. Cursor → Settings → MCP  
2. Add server URL: `https://mcp.hospitable.com/mcp`  
3. Auth with OAuth (Hospitable login)  
4. Tell me when it’s connected so I can use Knowledge Hub / property tools in chat  

See `docs/HOSPITABLE_MCP_OPS_MAP.md` for what MCP can do for your spreadsheet.

### A5. Env (Admin)

```bash
VITE_CLEANER_HUB_URL=https://portal.stravo.ai
VITE_GUIDEBOOK_URL=https://guidebook.stravo.ai
VITE_COHOST_URL=https://chat.stravo.ai
CLEANER_HUB_SYNC_KEY=<shared secret>
CLEANER_HUB_SYNC_URL=https://hyndmdjvjlsbthlqrxge.supabase.co/functions/v1/ops-hub-sync
```

Restart `npm run dev` after changing. Mirror on Vercel for Admin production (same `CLEANER_HUB_SYNC_KEY` authorizes Cleaner → Admin `/api/webhooks/ops-hub`).

Cleaner Hub edge secrets (for notify):

```bash
OPS_HUB_SYNC_KEY=<same shared secret>
OPS_HUB_NOTIFY_URL=https://admin.mandelrealtygroup.com/api/webhooks/ops-hub
```

Also deploy: `npx supabase functions deploy notify-ops-hub --project-ref hyndmdjvjlsbthlqrxge`

### A6. Hospitable PAT in each product

| App | Where |
|-----|--------|
| Admin OPS | Settings → Connect Hospitable (already) |
| Cleaner Hub | Properties list or Settings → Hospitable card → paste PAT |
| Guidebook | Per-property Hospitable Connect / Guests tab (existing) |
| CohostAI | Setup → PAT (existing) |

Same Hospitable account PAT is fine.

---

## B. Per-unit connect order

### B1. Admin OPS

1. Properties → **Import** from Hospitable (or open existing).  
2. Confirm Hospitable UUID is linked.  
3. **Edit links** → paste Hospitable dashboard numeric id (or property URL) so **Open** hits the right page.  
4. Click **Create / open in Cleaner Hub** — no manual Cleaner UUID paste for new units.

### B2. Cleaner Hub

Land on the property from Admin. Set rooms, checklists, inventory.  
(If the unit already existed only in Cleaner: still use Create/open — it matches on Hospitable UUID and links Admin.)

### B3. Guidebook (only if you want a guest guidebook)

Setup / Hospitable Connect → pick the same listing → save.  
Copy `/editor/{id}` → Admin App links → Guidebook ID.  
Skip units that don’t need a guidebook.

### B4. CohostAI

Properties sync from Hospitable (ids already = Hospitable UUID). Confirm the unit appears.

---

## C. What to test and tell me

1. Cleaner: Connect PAT → list shows Hospitable units → import/link works.  
2. Admin: Import + App links Hospitable dropdown works.  
3. Guidebook: Connect still saves; UUID column filled.  
4. Cohost: sync shows same set of UUIDs.  
5. Then we’ll redesign **Cleaner Hub** first (simpler + functional), then Guidebook, then CohostAI.

---

## What I cannot do without you

- Paste / authorize your Hospitable PAT in each live app (secrets).  
- Click OAuth for Cursor MCP.  
- Deploy edge functions if Supabase CLI isn’t authenticated on this machine.  
- Confirm which units skip Guidebook.
