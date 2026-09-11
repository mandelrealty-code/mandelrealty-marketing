# Connect all MRG properties — what you do vs what we built

## How connection works now (no hand-invented UUIDs)

1. **Hospitable** is the catalog of real units.
2. Each app **imports or links** a unit from Hospitable (picker). That writes the shared UUID.
3. Units can exist on Cleaner **without** Guidebook (or the reverse). Admin App links leave optional IDs blank = “not onboarded”.
4. After each app is linked, paste the **local** Cleaner / Guidebook ids into Admin **App links** so the registry can deep-link. (Cross-DB auto-discovery comes later.)

---

## A. One-time setup (you + Cursor)

### A1. Run SQL in Cleaner Hub Supabase

SQL Editor → run **both** (if not already):

1. `hospitable_property_id` column (from earlier)
2. `owner_integrations` table — file:  
   `property-cleaner-hub/supabase/migrations/20260911130000_owner_integrations_hospitable.sql`

### A2. Deploy Cleaner edge function

From `property-cleaner-hub`:

```bash
npx supabase functions deploy hospitable-proxy --project-ref hyndmdjvjlsbthlqrxge
```

(Use your real project ref if different.)  
If the CLI isn’t logged in, say so and we’ll connect Supabase CLI / Cursor.

### A3. Run Guidebook SQL (if not done)

`Guidebook/supabase/migration_hospitable_property_id.sql`

### A4. Connect Hospitable MCP in Cursor (for agent ops)

1. Cursor → Settings → MCP  
2. Add server URL: `https://mcp.hospitable.com/mcp`  
3. Auth with OAuth (Hospitable login)  
4. Tell me when it’s connected so I can use Knowledge Hub / property tools in chat  

See `docs/HOSPITABLE_MCP_OPS_MAP.md` for what MCP can do for your spreadsheet.

### A5. Env (marketing Admin Open links)

Already documented; local `.env.local` should include:

```bash
VITE_CLEANER_HUB_URL=https://portal.stravo.ai
VITE_GUIDEBOOK_URL=https://guidebook.stravo.ai
VITE_COHOST_URL=https://chat.stravo.ai
```

Restart `npm run dev` after changing. Mirror the same on Vercel for Admin production.

### A6. Hospitable PAT in each product

| App | Where |
|-----|--------|
| Admin OPS | Settings → Connect Hospitable (already) |
| Cleaner Hub | Properties list or Settings → Hospitable card → paste PAT |
| Guidebook | Per-property Hospitable Connect / Guests tab (existing) |
| CohostAI | Setup → PAT (existing) |

Same Hospitable account PAT is fine.

---

## B. Per-unit connect order (repeat for every live property)

### B1. Admin OPS (registry)

1. Properties → **Import** from Hospitable (or open existing).  
2. Confirm Hospitable is linked.  
3. Later: App links → fill Cleaner / Guidebook ids after B2/B3.

### B2. Cleaner Hub

**New unit:** Properties → Hospitable card → Connect PAT → select unit → **Import as new Cleaner property**.  
**Existing unit (already in Cleaner, no Guidebook needed):** open property → Settings → Hospitable → select matching unit → **Link this property**.

Copy URL id `/properties/{id}` → Admin App links → Cleaner Hub ID.

### B3. Guidebook (only if you want a guest guidebook)

Setup / Hospitable Connect → pick the same listing → save.  
Copy `/editor/{id}` → Admin App links → Guidebook ID.  
Skip units that don’t need a guidebook.

### B4. CohostAI

Properties sync from Hospitable (ids already = Hospitable UUID). Confirm the unit appears.

### B5. Admin App links

Open property → App links → Hospitable picker (should match) + paste Cleaner / Guidebook ids if onboarded → Save.

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
