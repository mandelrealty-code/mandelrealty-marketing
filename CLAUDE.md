# MRG Admin — CLAUDE.md

Read this fully before writing any code. This file is the source of truth for the admin repo.

---

## What this app is

**Admin dashboard for Mandel Realty Group** at `admin.mandelrealtygroup.com`.  
Used exclusively by Ryan and Shane (the two founders/partners).  
They schedule the team, track every unit being onboarded, and manage clients — without ever going to a property themselves.

Repo: `mandelrealty-marketing` (Vercel project `prj_HRn92R5JMFJiiATjYsbSHlyRv7Ql`)  
Separate from the cleaner app (`property-cleaner-hub` / `portal.stravo.ai`). Different backend, different auth.

---

## Auth

- Partners (Ryan, Shane): shared admin password
- Staff (onboarders, Rita, etc.): email + password via staff account system
- Session cookie, 30-day expiry
- Server-side: `verifyAdminSessionToken`, `isAdminConfigured()`, staff looked up via `staffUserStore`

---

## App structure

Three top-level modes (set in `src/pages/clients/mode.ts`):
- **CRM** — leads coming in. Leave as-is for now. Eventually a signed lead flows into Onboarding.
- **OPS** (`ClientsApp.tsx`) — employees, clients, Hospitable properties, revenue. Leave as-is.
- **Copilot** — AI assistant. Leave as-is.
- **Onboarding** — NEW. Its own mode, alongside the three above. This is where all active onboarding work is tracked.

OPS tabs (from `shared/opsNav.ts` → `OPS_NAV`): SOPs, Employees, Clients, Properties, Revenue, Settings.  
`pmGet` / `pmPost` → `/api/admin/pm` (this repo's own backend, not Supabase).

---

## Bridge to the cleaner app

The two apps talk via two endpoints only:
- **Admin → Cleaner app:** server calls `ops-hub-sync` edge function at `https://hyndmdjvjlsbthlqrxge.supabase.co/functions/v1/ops-hub-sync`
- **Cleaner app → Admin:** cleaner fires `notify-ops-hub` → `POST /api/webhooks/ops-hub` on this server

The **Hospitable property ID** is the shared join key across all apps (cleaner app, guidebook, CohostAI). Once Shane adds it in Stage 6 Software Setup, all apps recognise the same unit.

The cleaner app Supabase project ID: `hyndmdjvjlsbthlqrxge`  
The cleaner app URL: `https://portal.stravo.ai`

---

## Design rules — non-negotiable

- **Light theme only.** Background `#ffffff` / `#f2f2ef`. Never dark backgrounds.
- **Font:** Inter (Google Fonts)
- **Gold accent (MRG brand):** `#c4a35a` — logo and active nav indicator only
- **Primary action:** `#18181b` (near-black buttons)
- **No kanban boards.** Use row/list layouts.
- **Mobile first.** Every screen must work on a phone. Media queries at 1240px, 900px, and 768px.
- **Visual spec:** `mrg-onboarding_1.html` in this repo. Match it exactly — colours, spacing, interactions.
- **No mock data in production.** Show real data from the database only. Sample data lives in the design file, not in code.

---

## The Onboarding tab

Ryan and Shane use this to manage every unit from signed contract to live listing in 7 days.

### Two views (toggle at top):
1. **Pipeline** — rows of properties, columns of stages, dot per stage (grey/amber/teal/red)
2. **Schedule** — week calendar, team members as rows, task chips per day

### The 7 stages (fixed, in order):

| # | Stage | Who | Done when |
|---|---|---|---|
| 1 | Audit | Onboarder | Full audit submitted + approved by Ryan/Shane |
| 2 | Furniture Plan | Rita | Mockups + line items approved by Ryan/Shane |
| 3 | Procurement | Rita + Onboarder | All items received |
| 4 | Install | Onboarder(s) | Install complete + professional photos approved |
| 5 | App Setup | Onboarder | Spots, inventory, guide clips, cleaner assigned |
| 6 | Software Setup | Shane | All platforms live (Airbnb, Hospitable, PriceLabs, Booking, VRBO) |
| 7 | Live | Ryan/Shane | Property marked live |

### Stage dot colours:
- Grey = not started
- Amber = in progress
- Amber + "submitted" badge = waiting for Ryan/Shane approval
- Red = blocked/flagged
- Teal = complete and approved

### Pipeline row shows:
- Property address + "New" badge if just signed
- Unit type, owner name
- Assignee avatar + name
- 7 stage dots
- Days in pipeline
- Flag icon (red) if any open flags — visible without clicking
- Expand arrow → task checklist + Approve / Request changes buttons

### Approval flow:
- Onboarder/Rita submits stage in cleaner app → `notify-ops-hub` → admin stage status = `submitted`
- Ryan/Shane click Approve in admin → `ops-hub-sync` action sent to cleaner app
- Or: Request changes → adds a note, reopens only flagged items in cleaner app

---

## Database tables (admin DB, written to via `/api/admin/pm`)

```
onboarding_units          — one row per property: address, unit type, owner, assignee,
                            start_date, live_date, block_reason, delivery_address,
                            airbnb_url, client_id
onboarding_unit_stages    — one row per unit per stage: status (todo/active/submitted/
                            blocked/done), notes, approved_by, approved_at
onboarding_tasks          — checklist items per stage: title, assignee, due_date, done,
                            done_at, metadata jsonb (links, photos, tracking numbers)
onboarding_schedule       — weekly schedule: who, unit, stage, day, span, time, status
onboarding_task_templates — standard tasks seeded per stage + staff_type that does each
software_setup_items      — Shane's platform checklist: platform, item_key, label, done
pm_team_members           — roster of staff names; has staff_type column:
                            onboarder | va | software | operations | partner
```

**SQL status:** `supabase/onboarding_v1.sql` has been written but NOT yet run.  
Before running, add this line: `alter table onboarding_unit_stages add column if not exists notes text;`  
Run in Supabase SQL editor. Confirm it ran before building anything that touches these tables.

### Task seeds needed (not yet seeded):
- **App Setup tasks:** "Spots complete", "Inventory counts and thresholds done", "Maintenance checks scheduled", "Guide clips filmed and published", "Cleaner company invited and assigned" — all assigned to onboarder type
- **Live tasks:** "Listing live on all channels" — assigned to Shane (software type)

---

## Staff types

`pm_team_members.staff_type` values: `onboarder | va | software | operations | partner`  
Shane has no staff login (uses partner password) — add him to roster as `partner` type.  
Matching throughout onboarding is by name string, same as existing tasks system.

---

## What data goes where

| Data | Stored in | App |
|---|---|---|
| Onboarding unit record, stage status | `onboarding_units`, `onboarding_unit_stages` | Admin DB |
| Audit job + item results, photos | `property_audits`, `audit_item_results`, `audit-media` bucket | Cleaner app Supabase |
| Maintenance issues found during audit | `maintenance_issues` (tagged pre-existing) | Cleaner app Supabase |
| Guide clips filmed | `property_guide_entries` → Hospitable → Guidebook | Cleaner app → External |
| Rooms, spots, inventory, maintenance | `property_rooms`, `property_unit_items`, `inventory_items` | Cleaner app Supabase |
| Cleaner assignment | `property_cleaning_assignments` | Cleaner app Supabase |
| Software setup checklist | `software_setup_items` | Admin DB |
| Hospitable property ID (joins all apps) | `properties.hospitable_property_id` | Cleaner app Supabase |

---

## Build rules

1. **Design before build — always.** The design file is `mrg-onboarding_1.html`. Read it. Match it.
2. **One sprint at a time.** Do not build Sprint 2 until Sprint 1 is working.
3. **Do not break existing features.** CRM, OPS, and Copilot must keep working.
4. **No mock data in components.** Only real API calls via `pmGet`/`pmPost`.
5. **Report what you built, what you skipped, and what needs a follow-up.** Always.

---

## Current sprint: Sprint 1

**Step 1 (do first):** Staff type selector in OPS Employees tab  
File: `src/pages/clients/EmployeesPanel.tsx`  
Add a dropdown next to each staff member: Onboarder / VA / Software / Operations / Partner  
Writes to `staff_type` column in `pm_team_members` via `pmPost`  
Shane (no staff login) should appear on the roster as Partner

**Step 2:** Onboarding tab  
- Add `'onboarding'` to `OpsTab` type in `src/lib/adminRoute.ts`
- Add `onboarding` entry to `OPS_NAV` in `shared/opsNav.ts` (label: "Onboarding")
- Add `/ops/onboarding` route handling in `parseAdminRoute` and `adminPath`
- Build `src/pages/clients/OnboardingPanel.tsx` matching `mrg-onboarding_1.html` exactly
- Render it in `ClientsApp.tsx` when `tab === 'onboarding'`
- Data via `pmGet('onboarding_units')`, `pmGet('onboarding_unit_stages')`, `pmGet('onboarding_schedule')`
- Backend handlers via `/api/admin/pm` following the same pattern as existing resources

---

## Future sprints (do not build yet)

- **Sprint 2:** Audit flow mobile in cleaner app (10-step AuditFlow component)
- **Sprint 3:** Furniture plan UI (Rita's mockups, line items, budget approval)
- **Sprint 4:** Procurement tracking + Install job
- **Sprint 5:** Software setup checklist + Live toggle + cleaner company assignment
- **Sprint 6:** CRM → Onboarding automatic flow when lead signs

---

## Key file locations

```
src/pages/AdminPage.tsx          — top-level mode switcher
src/pages/clients/ClientsApp.tsx — OPS shell, tab rendering
src/pages/clients/EmployeesPanel.tsx — staff list (add staff_type here)
src/pages/clients/api.ts         — pmGet/pmPost, type definitions
src/lib/adminRoute.ts            — route parsing and URL generation
shared/opsNav.ts                 — OPS_NAV tab definitions
shared/pm/cleanerHubSync.ts      — calls to ops-hub-sync
shared/adminApi/opsHubWebhook.ts — handles POST /api/webhooks/ops-hub
supabase/onboarding_v1.sql       — schema (NOT YET RUN)
mrg-onboarding_1.html            — approved design spec (read this)
```
