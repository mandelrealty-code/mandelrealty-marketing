# OPS Functionality Audit

**Read-only inventory from the code as of the audit date.**  
Source of truth: `src/pages/clients/*`, `shared/opsNav.ts`, `src/lib/adminRoute.ts`, `src/pages/clients/mode.ts`, `shared/adminApi/pm.ts`, and components they import.  
No production data was read. No SQL or write endpoints were called.

**Audience:** redesign of OPS so nothing is dropped — every feature, button, state, and outward-facing action.

---

## How to read this doc

- Tabs follow `OPS_NAV` order: SOPs → Employees → Clients → Properties → Revenue → Settings.
- Control tables use: **Label | Where | Action | Endpoint/op | External effect | Confirm | Gating | Cite**.
- All mutating OPS calls go through `pmGet` / `pmPost` → `GET|POST /api/admin/pm?resource=…` with session cookie (`src/pages/clients/api.ts:162–201`), unless noted (e.g. `GET /api/admin/leads`, public `/api/sop`).
- **Partner-only:** staff who sign in with an OPS staff account never see OPS — `AdminPage` routes them to `EmployeeTasksApp` only (`src/pages/AdminPage.tsx:1664–1677`). `/api/admin/pm` requires partner admin session (`shared/adminApi/pm.ts:306–311`). Every OPS control below is partner-gated unless stated otherwise.

---

# Shared OPS chrome

## Routes / modes

| Piece | Behavior | Cite |
|---|---|---|
| Product modes | `crm` \| `onboarding` \| `ops` \| `copilot` | `mode.ts:1` |
| Mode persistence | `localStorage` key `mrg_admin_mode`; legacy `"clients"` → ops | `mode.ts:3–16` |
| Default OPS tab | `opsTab: "sops"` → URL `/ops` | `adminRoute.ts:77`, `178` |
| OPS_NAV | sops, employees, clients, properties, month (Revenue), settings | `shared/opsNav.ts:2–8` |
| Old `/ops/tasks…` | Opens Copilot Tasks (`sessionStorage cp-open=tasks`) | `opsNav.ts:12–14`, `adminRoute.ts:134–137` |
| Old `/ops/reviews…` | Opens Copilot Reviews | `opsNav.ts:17–19`, `adminRoute.ts:139–142` |
| Fallback in ClientsApp | `MovedToCopilot` → `window.location.replace("/copilot")` | `ClientsApp.tsx:56–61`, `2314–2319` |

## Layout

1. **Header** (`ClientsApp.tsx:1183–1194`): MRG mark, “Mandel Realty Group” (hidden `< sm`), `ModeSwitcher` (CRM / Onboarding / OPS / Team).
2. **Desktop left nav** (`lg+`, `1207–1223`): six `OPS_NAV` buttons; gold active.
3. **Mobile bottom nav** (`1226–1242`): same six; labels **Month** (Revenue) and **Team** (Employees).
4. **Main scroll pane** with optional `loadError` banner (`2353–2355`).
5. **No global search** in OPS chrome.
6. **Toast:** global toast UI only when `tab === "tasks" \|\| "reviews"` (`2361–2367`) — effectively dead for current OPS tabs. SopsPanel has its own toast; property detail has its own; Employees/`ClientMonth`/`MonthClose` call `onToast`/`setToast` that often **do not render**.

## Chrome controls

| Label | Where | Action | Endpoint/op | External effect | Confirm | Gating | Cite |
|---|---|---|---|---|---|---|---|
| CRM | ModeSwitcher | `onModeChange("crm")` | — | Leaves OPS | No | Partner | `ui.tsx:61–70` |
| Onboarding | ModeSwitcher | `onModeChange("onboarding")` | — | Leaves OPS | No | Partner | `ui.tsx:72–81` |
| OPS | ModeSwitcher | `onModeChange("ops")` | — | Stays | No | Partner | `ui.tsx:83–92` |
| Team | ModeSwitcher | `onModeChange("copilot")` | — | Opens Copilot | No | Partner | `ui.tsx:94–104` |
| SOPs | Nav | `goTab("sops")` → `/ops` | — | Clears owner statement | No | — | `1207–1221`, `1199–1201` |
| Employees | Nav | `goTab("employees")` | — | — | No | Mobile label “Team” | `opsNav.ts:4`, `1239` |
| Clients | Nav | `goTab("clients")` | — | — | No | Stays active during client month / statement | `1204–1205` |
| Properties | Nav | `goTab("properties")` | — | — | No | — | — |
| Revenue | Nav | `goTab("month")` | — | — | No | Mobile “Month” | `1239` |
| Settings | Nav | `goTab("settings")` | — | — | No | — | — |

**Chrome control count: 10** (4 mode + 6 tabs).

## Boot data (all tabs)

On mount, `loadLists` (`ClientsApp.tsx:226–243`):

- `GET clients`
- `GET properties`
- `GET settings` → default commission/HST bps, Hospitable connected flags

## Shared UI primitives (`ui.tsx`)

| Primitive | Role |
|---|---|
| `Sheet` | Mobile bottom sheet / desktop modal; Escape + Cancel dismiss | `ui.tsx:158–227` |
| `MonthPicker` | Prev / label / next + year grid | `ui.tsx:282–409` |
| `SegmentedControl` | Two-option toggles | `ui.tsx:413–458` |
| `GoldButton` / `TextInput` / `TextArea` / `FieldLabel` / `StatusDot` / `MrgMark` | Form chrome | — |

Desktop breakpoint for OPS shell: **`min-width: 1024px`** (`useIsDesktop`, `ClientsApp.tsx:72–82`) — not the 1240/900/768 onboarding breakpoints.

Visual: OPS is **dark** (`#0a0a0a` / `#0e0e0e`). CLAUDE.md light theme applies to Onboarding, not this legacy OPS chrome.

---

# 1. SOPs

## 1. Routes

| Pattern | Behavior | Cite |
|---|---|---|
| `/ops` | Default landing = SOPs | `adminPath` maps `opsTab==="sops"` → `/ops` (`adminRoute.ts:178`) |
| `/ops/sops` | Parsed as sops, then canonicalized to `/ops` | `147–149`, `178` |
| Public share | `{origin}/sop/{slug}` via `/api/sop` | `SopsPanel.tsx:120–122` |
| `AdminRoute.sopSlug` | Declared but **never set** by parser/path | `adminRoute.ts:35` |

Render: `tab === "sops"` → `SopsPanel` + global `VideoSopStudioModal` (`ClientsApp.tsx:2304–2312`, `3325–3381`).

## 2. Layout

Header (stats + Record / Import / New) → filter chips + search → desktop table header → row list → slide-over editor → ImageRedactorModal → Video Studio modal.

## 3. Data shown

| Field | Source | Format |
|---|---|---|
| SOP list | `GET sops` | title, Draft badge, category, updated date, role chip, minutes, step count |
| Stats | client count of published / drafts | — |
| Not shown in UI | `summary` (search only), `author`, `video_url`, `transcript`, `created_at` | — |

## 4. Controls

### List / header (`SopsPanel.tsx`)

| Label | Where | Action | Endpoint/op | External effect | Confirm | Gating | Cite |
|---|---|---|---|---|---|---|---|
| Record | Header | Open Video Studio (new) | — | Screen/mic later | No | `onOpenVideoStudio` | `:385–394` |
| Import backup | Header | Parse JSON → editor | — | Local file | Alert on bad JSON | — | `:395–407` |
| + New SOP | Header | Seed defaults → editor | — | localStorage draft | No | — | `:408–414` |
| Category chips | Filters | Filter list | — | — | No | All, Outreach & Leads, Guest Comms, Team & Cleaners, Turnover, Software | `:430–452` |
| Search SOPs… | Filters | Filter title/category/role/summary | — | — | No | — | `:457–463` |
| + Create SOP | Empty | Same as New | — | — | No | Empty/filter-empty | `:494–500` |
| Edit Guide | Row | Editor or Video Studio | — | — | No | Video SOP → studio | `:548–554` |
| Copy Link / ✓ Copied | Row | Clipboard `{origin}/sop/{slug}` | — | Clipboard; public URL | No | — | `:555–565` |
| ✕ Delete | Row | Delete SOP | `POST sops` `{op:"delete",id,slug}` | DB | `window.confirm` | — | `:566–573`, `:268–283` |

### Editor

| Label | Where | Action | Endpoint/op | External effect | Confirm | Gating | Cite |
|---|---|---|---|---|---|---|---|
| Backdrop / ✕ | Overlay | Close | — | Draft may remain | Confirm if dirty/`!saving` | — | `:593–642` |
| Video Studio | Top | Hand off SOP | — | — | No | — | `:613–625` |
| Download backup | Top | Download JSON | — | Local file | No | — | `:627–633` |
| Title / Category / Role / Est. mins | Meta | Local edit | Saved on Publish | — | No | Options below | `:654–715` |
| + Add Step / Delete Step | Steps | Mutate steps | — | — | No | — | `:725–903` |
| Edit in Redactor | Step | Open ImageRedactorModal | Upload on Publish | — | No | — | `:803–809` |
| Script / Pro tip / Warning | Step | Local | — | — | No | Optional | `:829–864` |
| Delete Guide | Footer | Delete | `POST sops` delete | DB | Confirm | — | `:911–917` |
| Discard Changes | Footer | Close | — | — | No | — | `:919–925` |
| Publish SOP | Footer | Compress images → upload → save | `sops` `upload_image` then `save` | Storage + DB; public if published | No | `disabled={saving}` | `:926–933` |

**Decorative:** step drag glyph `⣿` — no reorder handler (`:762`).  
**Misleading:** “Paste Screenshot (⌘V)” on step card — paste only works inside ImageRedactorModal.

### Image redactor (opened from SOP editor)

Tools: Spotlight / Blur / Blackout / Click Pin (keys S/B/K/P); Replace Image; Undo; Clear all; Cancel; Apply to Step; Browse/drop/paste; pin caption; layer hide/delete; Esc/Delete/⌘Z. Cite: `ImageRedactorModal.tsx` (~680–1126). No API until parent Publish.

### Video Studio (`VideoSopStudioModal` + `ClientsApp` save bridge)

Setup (Snapshots/Video, title, role, category) → record HUD → review → Publish via `onSaveSop` → `POST sops` `{op:"save",…}` (`ClientsApp.tsx:3333–3379`). May `upload_video`. Delete Guide → `sops` delete with confirm. Includes transcript edit, trim, nested redactor.

## 5. States

Loading / load error banner / empty CTA / saving (“Uploading screenshots…”) / toast for copy+delete / draft autosave `localStorage` key `mrg_sop_editor_draft` / Publish disabled while saving. New SOPs default `is_published: true` — no draft toggle in editor.

## 6. Forms

| Field | Type | Options | Required | Default |
|---|---|---|---|---|
| Title | text | — | Not enforced | “Untitled SOP” |
| Category | select | outreach, guest_ops, team_comms, turnover, software, **other** | — | outreach |
| Target Role | select | va, cleaner, manager, all | — | va |
| Est. minutes | number | — | — | 15 |
| Video Studio category also includes | — | **maintenance** | — | — |

Filter chips omit `other` and `maintenance`.

## 7. Mobile

Header stacks; chips scroll-x; table header `hidden md:`; editor full-width; OPS bottom nav “SOPs”.

## 8. Cross-links

Copy Link → public `/sop/{slug}`; Video Studio ↔ list via `sopsRefreshTrigger`. No CRM/Onboarding deep links from this tab.

**SOPs control count: ~104** (panel ~31 + redactor ~25 + video studio ~48).

---

# 2. Employees

## 1. Routes

| Pattern | Behavior | Cite |
|---|---|---|
| `/ops/employees` | List | `adminRoute.ts:147–148` |
| `/ops/employees/:id` | Detail (`employeeId`) | `:144–145`, `:177` |

Mobile nav label: **Team**. Desktop: **Employees**.

## 2. Layout

List (Invite + rows) → **Team types** roster → Detail (back, portal/resend/delete, tasks, hours) → Invite sheet.

## 3. Data shown

| Data | Source | Format |
|---|---|---|
| Staff users | `GET staff_users` | name, email, `/team/{slug}`, last sign-in (America/New_York), week hours |
| Week hours | `GET time_entries` | Sum by staff_user_id; “week of {since}” |
| Detail hours | `GET time_entries?staff_user_id&since=` (90 days) | Date · range · hrs |
| Assigned tasks | `GET board` filtered by display name | Title, status, due — from Copilot board |
| Team types | `GET team_members` | name, staff_type, login badge |

## 4. Controls

| Label | Where | Action | Endpoint/op | External effect | Confirm | Gating | Cite |
|---|---|---|---|---|---|---|---|
| Invite | List header | Open invite sheet | — | — | No | — | `EmployeesPanel.tsx:552–558` |
| Employee row | List | Navigate detail | — | — | No | — | `:572–597` |
| Type select | Team types | Set staff type | `POST team_members` `{op:"set_type",name,staff_type}` | DB | No | Disabled while saving that name | `:676–686` |
| Send login | Team types | Prefill invite | — | Opens sheet | No | No login **and** type ≠ partner | `:687–689` |
| Remove | Team types | Deactivate login **or** delete roster | `staff_users` `deactivate` **or** `team_members` `delete` | DB | `window.confirm` | — | `:646–661`, `:690` |
| Add (partner name) | Team types form | `set_type(name,"partner")` | `team_members` `set_type` | Creates roster row | No | Nonempty name | `:695–713` |
| Display name / Email | Invite sheet | Local | — | — | No | Required to send | `:350–371` |
| Send invite | Invite sheet | Create + email | `POST staff_invite` `{op:"send",email,display_name}` | **EMAIL**; temp password → clipboard | No | `busy` / fields | `:373–384`, `:232–277` |
| Cancel / backdrop | Invite | Close | — | — | No | — | `:338–391` |
| ← Employees | Detail | Clear selection | — | — | No | — | `:401–407` |
| Open portal | Detail | `<a target=_blank>` | — | Opens `https://mandelrealtygroup.com/team/{slug}` | No | — | `:426–433` |
| Resend invite | Detail | Invite again | `staff_invite` `send` | **EMAIL** + clipboard | No | `busy` | `:434–441` |
| Delete | Detail | Hard delete | `POST staff_users` `{op:"delete",id}` | DB; hours removed per confirm copy | `window.confirm` | `busy` | `:442–449`, `:318–334` |
| Refresh | Detail tasks | Reload board + hours | `GET board`, `GET time_entries` | — | No | — | `:465–475` |

## 5. States

Load errors → parent `loadError`. Empty employees → SQL hint. Empty tasks → points to Copilot. Empty hours → “No hours logged yet.” **No list loading spinner.** Invite success via `onToast` (often invisible — see chrome toast bug).

## 6. Forms

**Invite:** Display name (text), Email (email) — both required.

**Staff type options (exact):** `""` Not set · `onboarder` Onboarder · `va` VA · `software` Software · `operations` Operations · `partner` Partner (`:609–616`).

## 7. Mobile

Invite = bottom sheet (`sm:items-center`); max-w 760; bottom nav “Team”.

## 8. Cross-links

Open portal → staff portal; empty tasks / subtitle → Copilot Tasks board; `staff_type` feeds Onboarding assignment (server-side).

**OUTWARD:** employee invite/resend **email**. No SMS.

**Employees control count: ~16.**

---

# 3. Clients

## 1. Routes

| Path | Flags | Renders | Cite |
|---|---|---|---|
| `/ops/clients` | — | List | `adminRoute.ts:147–148` |
| `/ops/clients/new` | `createClient` | Add sheet | `:120–121`, `:169` |
| `/ops/clients/:id` | `clientId` | `ClientMonthPanel` | `:123–129` |
| `/ops/clients/:id/edit` | `clientId` + `clientEdit` | Edit sheet | `:123–129`, `:171–172` |

**Quirk:** List row opens **edit**, not month. Month only via “Month earnings → Open” or direct `/ops/clients/:id`.

Owner statement = in-memory overlay (no URL). HST worklist = `/ops/month/hst/:clientId` (Revenue tab).

## 2. Layout

List → create/edit `Sheet` (portal + checklist + contracts) → client month → owner statement overlay.

## 3. Data shown

| Surface | Source | Fields |
|---|---|---|
| List | `GET clients` | name, email, units, Active/Paused |
| Edit | Form + portal + checklist + contracts | Contact; portal status; open/done steps |
| Create | Optional CRM leads | `GET /api/admin/leads`; prefill `sessionStorage.mrg_prefill_client_lead` |
| Month | `GET month_close?month&client_id` | Net, fees, HST invoice, host charges; per-unit rows |
| Checklist | `GET client_checklist` | Derived steps/notes (read-only) |
| Portal | `GET portal_user` | User, owner URL, awaiting contract |

## 4. Controls

### List

| Label | Where | Action | Endpoint/op | External effect | Confirm | Gating | Cite |
|---|---|---|---|---|---|---|---|
| Add client | Header / empty | `/ops/clients/new` | — | — | No | — | `ClientsApp.tsx:1251–1264` |
| Row body | List | Open edit | — | — | No | — | `:1273–1286` |
| Preview | List | Host portal preview | `GET portal_preview` → `/owner/{slug}?preview=` | **HOST PORTAL** | No | Pop-ups | `:1287–1297`, `api.ts:174–180` |
| Active / Paused | List | Display only | — | — | No | — | `:1298–1307` |

### Create / edit sheet

| Label | Where | Action | Endpoint/op | External effect | Confirm | Gating | Cite |
|---|---|---|---|---|---|---|---|
| Cancel / Escape / backdrop | Sheet | Back to list | — | — | No | — | `2370–2373`, `ui.tsx:169–214` |
| Clear | CRM lead box | Clear lead/form | — | — | No | Create + has content | `:2392–2399` |
| Choose a lead… / Search / lead rows | Create | Prefill form | `GET /api/admin/leads` | — | No | Create | `:2404–2493` |
| Name / Email / Phone | Form | Local | — | — | No | — | `:2503–2526` |
| Active / Paused | Segmented | Local status | — | — | No | — | `:2528–2537` |
| Save & send contract | Create footer | Create + open invite draft | `POST clients` `create`; session draft | Preps **EMAIL** (not sent yet) | No | Name required | `:2583–2589` |
| Save client only | Create | Create | `POST clients` `create` | DB | No | Name | `:2590–2597` |
| Month earnings → Open | Edit | `/ops/clients/:id` | — | — | No | Edit | `:2547–2556` |
| Properties → View | Edit | Filter + `/ops/properties` | — | — | No | Edit | `:2557–2573` |
| Save | Edit | Update | `POST clients` `update` | DB | No | Name | `:2600–2602` |
| Delete client | Edit | Delete | `POST clients` `delete` | Cascades portal/properties/contracts | **`window.confirm`** | Edit | `:2604–2612`, `:510–531` |

### PortalInviteControls — **OUTWARD EMAIL**

| Label | Where | Action | Endpoint/op | External effect | Confirm | Gating | Cite |
|---|---|---|---|---|---|---|---|
| Owner URL | Status | Open public portal | — | **HOST PORTAL** | No | Has URL | `PortalInviteControls.tsx:419–428` |
| Replace contract | Status | Replace flow | — | Email on send | No | `awaiting_contract` | `:431–439` |
| Send portal invite / Resend invite | Status | Toggle form | — | — | No | — | `:441–475` |
| Edit boxes only | Status | Reopen placer | `GET contract_url` | — | No | Awaiting | `:456–463` |
| Preview as host | Status | Portal preview | `GET portal_preview` | **HOST PORTAL** | No | — | `:478–485` |
| Existing host / New — sign contract | Form | Set kind | — | — | No | — | `:501–524` |
| Name / Email / Phone | Form | Local (+ draft) | — | — | No | — | `:534–545` |
| Signed contract PDF | Existing | File | — | — | No | existing | `:550–561` |
| Send portal access | Existing | Send | `POST portal_invite` `{op:"send", existing_host:true}` | **EMAIL (Resend)** | No | Email | `:563–569` |
| Agreement template | New/replace | Select | `GET contract_templates` | — | No | — | `:574–588` |
| Or upload PDF… | New/replace | One-off | — | — | No | — | `:590–609` |
| Also save to Contract templates | Flag | Server may create template | On send | Storage | No | One-off | `:600–608` |
| Next: place fields & sign | New/replace | Open placer | `GET contract_template_url` or blob | — | No | Email + PDF/template | `:611–617` |
| Cancel | Form | Close | — | — | No | — | `:620–631` |
| Back | Place overlay | Back | — | — | No | — | `:660–676` |
| Send invite / Replace & resend | Place | Send | `POST portal_invite` `send` (+ fields/PDF/replace_id) | **EMAIL**; stamps MRG sigs; awaiting in portal | No | Host + MRG sigs (`sendBlocked`) | `:677–690` |

Email kinds (server): `new` | `existing` | `revised` via Resend. **No SMS.**

### SignFieldPlacer

Move / Host fills later / MRG fills now / Signature / Name / Date / Text / Checkbox; click place; drag/resize/Delete; double-click MRG sig → SignaturePad; keys Escape/V/Delete/Arrows. Cite: `SignFieldPlacer.tsx:221–583`.

### ClientChecklist

Display-only ○/✓ steps + notes. `GET client_checklist`. **0 interactive controls.** `ClientChecklist.tsx:16–65`.

### ContractsPanel (on client edit)

| Label | Action | Endpoint/op | External | Confirm | Cite |
|---|---|---|---|---|---|
| Upload / Cancel | Toggle form | — | — | No | `ContractsPanel.tsx:108–114` |
| Title / Signed on / Choose file | Upload signed PDF | `POST contracts` `create` `status:signed` | Storage (not emailed) | No | `:119–144` |
| Open | Signed URL | `GET contract_url` | New tab | No | `:167–173` |
| Delete | Remove | `POST contracts` `delete` | Storage | **None** | `:174–181` |

### ClientMonthPanel (`/ops/clients/:id`)

| Label | Action | Endpoint/op | External | Confirm | Gating | Cite |
|---|---|---|---|---|---|---|
| ‹ {client} | Back to list | — | — | No | — | `ClientMonthPanel.tsx:198–204` |
| MonthPicker | Reload | `GET month_close` | — | No | — | `:216` |
| Client details | → edit | — | — | No | **Desktop only** | `:223–229` |
| Preview statement | Open OwnerStatementPanel | — | — | No | `!loading` | `:230–238` |
| HST worklist / HST | → `/ops/month/hst/:id` | — | — | No | Invoice units | `:239–247` |
| Copy | Clipboard HST text | — | Clipboard | No | **Mobile only** + hasInvoice | `:310–329` |
| Unit row | → property | — | — | No | — | `:358–417` |

### OwnerStatementPanel (overlay)

| Label | Action | Endpoint/op | External | Confirm | Cite |
|---|---|---|---|---|---|
| ‹ Back | Return property or client month | — | — | No | `OwnerStatementPanel.tsx:659–665` |
| MonthPicker | Reload | `GET owner_statement` | — | No | `:676` |
| Download PDF | Print window → Save as PDF | — | **Local PDF only — no email/SMS/publish** | Pop-up | `:642–654`, `:677–685` |

## 5. States

`busy` disables saves/sends; portal status labels (Not invited / Invited / Opened / Signed / Portal live); invite draft in `sessionStorage`; place-step `sendBlocked` until signatures; **toasts after portal send often invisible** (global toast gated to dead tabs).

## 6. Forms

| Form | Fields | Validation |
|---|---|---|
| Client create/edit | name, email, phone, status active\|paused | Name required (UI) |
| Portal existing | name, email, phone, optional signed PDF | Email |
| Portal new/replace | contact, template or PDF, sign fields | Email; host + MRG signatures |
| Contracts upload | title, signed_on, file | File required |

## 7. Mobile

Bottom sheet create/edit; Sign placer full-screen; month: no “Client details”; mobile Copy HST; Add client text-only (desktop gold pill).

## 8. Cross-links

CRM convert → `/ops/clients/new` + prefill (`AdminPage.tsx:934–958`); edit → month / filtered properties; month → property / HST / statement; Preview → `/owner/…`.

**OUTWARD:** Resend/portal invite **email**; host portal open/preview. No Stripe, Hospitable, cleaner sync, SMS from this tab.

**Clients control count: ~77.**

---

# 4. Properties

## 1. Routes

| Path | Behavior | Cite |
|---|---|---|
| `/ops/properties` | List | `adminRoute.ts:147–148` |
| `/ops/properties/:id` | Detail | `:117–118`, `:168` |

No nested earnings/statement URL — statement is overlay.

## 2. Layout

List (Add/Import, client chips, Active/Paused, rows) → Detail (hero, app links, billing/STR/MAT/contracts left, Earnings right) → sheets: Add, Import, Edit, Rate, Billing/HST, Link Hospitable, App links, PAT.

## 3. Data shown

List: name, address, client, deal label, Linked/Active, cover.  
Detail: terms history, STR compliance, MAT quarters, app IDs, earnings month (stays, expenses, sync status). Sources: `GET properties`, `GET properties?id=`, `GET hospitable`, `GET/POST earnings`.

## 4. Controls (summary table)

| Label | Where | Action | Endpoint/op | External effect | Confirm | Gating | Cite |
|---|---|---|---|---|---|---|---|
| Add | List | Create sheet | — | — | No | — | `ClientsApp.tsx:1322–1327` |
| Import | List | Hospitable import | `GET hospitable`; may open PAT | **Hospitable list** | No | PAT + ≥1 client | `:1329–1334` |
| Client chips / All·Active·Paused | Filters | Filter | — | — | No | — | `:1340–1390` |
| Row tap | List | Detail | `GET properties?id=` | — | No | — | `:1415–1418` |
| ‹ Properties | Detail | Clear id | — | — | No | — | `:1486–1493` |
| Edit | Detail | Edit sheet | — | — | No | — | `:1515–1520` |
| Link Hospitable | Meta | Link sheet | — | — | No | — | `:1534–1540` |
| Copy UUID | Meta | Clipboard | — | Clipboard | No | Linked | `:1543–1557` |
| Upload / Replace / Remove photo | Cover | Cover CRUD | `properties` `upload_cover` / `remove_cover` | Storage | No | `busy` | `:1571–1587` |
| Edit links | App links | App-links sheet | `GET hospitable?include=all` | Hospitable optional | No | — | `:1599–1604` |
| Copy / Open (app rows) | App links | Clipboard / external URL | — | Hospitable / Cleaner / Guidebook / Cohost | No | — | `:1709–1735` |
| Create / open in Cleaner Hub | App links | Push hub | `POST properties` `push_to_cleaner` | **Cleaner Hub sync + window.open** | No | Needs Hospitable UUID | `:1745–1753` |
| Create ≤4★ review tasks | App links | Seed tasks | `workflow_negative_reviews` | Internal tasks only | No | — | `:1755–1761` |
| Change (commission) | Billing locked | Rate sheet | — | — | No | — | `BillingTermsForm.tsx:147–153` |
| Fee base / Cleaning / HST mode / HST % | Billing | Local → Save | Via property `update` | Affects earnings math | No | HST 0–20% | `:1784–1813` |
| Save billing terms | Billing | Persist | `POST properties` `update` | — | No | — | `:1791–1811` |
| Add/Edit permit · Enable MAT | STR/MAT | Edit sheet | — | — | No | — | `:1854–1961` |
| Mark filed / Undo filed | MAT | Toggle | `mark_mat_filing` | DB | No | — | `:2005–2083` |
| Contracts Upload/Open/Delete | ContractsPanel | Same as Clients | `contracts` / `contract_url` | Storage | Delete: none | — | `ContractsPanel.tsx` |
| Refresh | Earnings | Sync month | `POST earnings` `sync` | **Hospitable pull** | No | Linked | `EarningsPanel.tsx:292–299` |
| Statement | Earnings | Owner statement overlay | Later `GET owner_statement` | PDF only | No | — | `:305–312` |
| MonthPicker | Earnings | Change month | `GET earnings` | — | No | — | `:318–360` |
| Add expense / Save / Delete / Receipt | Expenses | CRUD charges | `add_expense` / `delete_expense` / `expense_receipt` | **Owner charge** on statement | Delete: inline Keep/Delete | Amount+label | `:533–766` |
| Save property | Add sheet | Create | `create` | Optional Hospitable ID | No | Name+client | `:2674–2680` |
| Confirm change | Rate sheet | Version rate | `change_rate` | Future commission | No | — | `:2725–2727` |
| Save | Link sheet | Link UUID | `link_hospitable` | Enables booking sync | No | Nonempty ID | `:2747–2754` |
| Save links | App links sheet | Persist IDs | `link_apps` | Cross-app keys | No | — | `:2854–2861` |
| Save / Deactivate | Edit | Update / pause | `update` `active:false` | Hidden from month close | In-sheet confirm | — | `:2943–3175` |
| Continue / Import unit | Import | Create from Hospitable | `import_hospitable` | **Hospitable import** + cleaner sync path | No | Selection+client | `:3288–3318` |

### BillingTermsForm fields

| Field | Type | Options | Default |
|---|---|---|---|
| Commission % | number | — | 20 (or settings default) |
| Fee base | Segmented | Nightly · Nightly − fee (`nightly` / `nightly_minus_host_fee`) | Depends on HST mode |
| Cleaning | Segmented | MRG · Host (`mrg` / `host`) | mrg |
| HST mode | Segmented | Cohost · Invoice (`cohost` / `invoice`) | cohost |
| HST % | number | — | 3 cohost / 13 invoice |

Smart defaults flip base + HST % when mode changes (`BillingTermsForm.tsx:91–108`).

## 5. States

Empty list CTA Import; detail loading blank; paused opacity; earnings unlinked message; MAT schema SQL hint; `busy` gating; property toast on detail (`1480–1485`).

## 6. Forms

Add/Import/Edit property fields as above + STR (permit #, applied, issued, municipality, day cap) + MAT required checkbox. Expense: amount, date, category chips, description, note, receipt.

## 7. Mobile

Contracts stack under Earnings; cover stacks; sheets via `Sheet`.

## 8. Cross-links

External: Hospitable, Cleaner Hub, Guidebook, Cohost. Internal: statement overlay; client edit → filtered properties; Revenue unit → property.

**OUTWARD:** Hospitable sync/import/link; Cleaner Hub push; owner expense charges; statement PDF. **No email/SMS** on this tab.

**Properties control count: ~110.**

---

# 5. Revenue (`opsTab: "month"`)

## 1. Routes

| Path | Behavior | Cite |
|---|---|---|
| `/ops/month` | `MonthClosePanel` portfolio | `adminRoute.ts:147–148` |
| `/ops/month/hst/:clientId` | HST worklist; expands that client | `:131–132`, `MonthClosePanel.tsx:330–403` |

Nav label **Revenue**; mobile **Month**. No deep link for company P&L sheets.

## 2. Layout

Portfolio (month picker, company strip, sync filters, unit rows) → HST worklist → Company P&L / subscriptions / add-cost sheets.

## 3. Data shown

`GET month_close?month=` — per-unit sync/net/MRG fee/HST invoice/host charges/deal; company net/fees/costs/HST to remit.

## 4. Controls

| Label | Where | Action | Endpoint/op | External effect | Confirm | Gating | Cite |
|---|---|---|---|---|---|---|---|
| MonthPicker | Header | Reload | `GET month_close` | — | No | loading/syncing | `MonthClosePanel.tsx` headers |
| Export / Export CSV | Header | Download CSV | Client blob | Local file | No | Has portfolio | `:899–906` |
| Sync all | Header/sticky | Sync linked units | `POST earnings` `sync` ×N | **Hospitable pull** | No | — | `:1056–1109` |
| Sync needing attention / Retry N | Banners | Sync stale/failures | same | **Hospitable** | No | Stale/fail counts | `:920–969` |
| Filter All/Stale/Unlinked/Ready | Chips | Filter rows | — | — | No | — | `:1029–1198` |
| HST / HST worklist | Header | `view="hst"` | — | — | No | — | `:1064–1100` |
| Net earnings / Company costs / Breakdown | CompanyStrip | Open P&L | — | — | No | — | `CompanyPnl.tsx:185–247` |
| Meta ads $0 / Add subscriptions | Strip | Add cost / open subs | — | — | No | Missing lines | `:265–288` |
| Unit row / Sync / Retry | List | Open property / syncOne | `earnings` `sync` | **Hospitable** | No | Linked + stale | `:1274–1368` |
| ‹ Month | HST | Back portfolio | — | — | No | — | `:601–606` |
| Copy month/client/unit/total summaries | HST | Clipboard QuickBooks text | — | Clipboard (no QB API) | No | Invoice groups | `:631–879` |
| Expand client / Open | HST | Toggle / property | — | — | No | — | `:704–805` |
| Close / Manage subscriptions / Add cost | P&L | Sheets | — | — | No | — | `CompanyPnl.tsx` |
| Override for {month} / Remove | Cost lines | Add override / delete | `company_expenses` create/delete | Company P&L only | Remove: **none** | — | `:382–432` |
| + Add / toggle / Save / Delete | Subscriptions | Upsert/delete | `company_subscriptions` upsert/delete | Recurring P&L | Delete: **none** | Name+amount | `:677–824` |
| Add to {month} | Add cost | Create | `company_expenses` `create` | Company only | No | Valid amount | `:573–637` |

## 5. States

Loading; empty fleet; zero stays; sync progress; failure banner; HST empty → cohost-only message; `hstClientId` filters groups.

## 6. Forms

Add company cost: amount, label, category, date, note.  
Subscription: name, amount, cadence, category, active, start month.

## 7. Mobile

Compact header; HST copy UX differs; P&L = bottom sheet vs desktop drawer; safe-area padding.

## 8. Cross-links

→ Property detail; ← HST from ClientMonthPanel; Settings “Company costs” shares subscription sheets.

**OUTWARD:** Hospitable fleet/unit sync; CSV export; clipboard HST for QuickBooks. **No email/SMS/statement publish.** Owner charges displayed here, edited on Property earnings.

**Revenue control count: ~57** (MonthClose ~18 + CompanyPnl ~39; subscription sheets overlap Settings).

---

# 6. Settings

## 1. Routes

`/ops/settings` only (`ClientsApp.tsx:2331`, `2150–2243`). PAT + subscription sheets are local state.

## 2. Layout

Narrow column: Default commission → Default HST → Hospitable status → Connect/Update/Disconnect → Company costs Manage → `ContractTemplatesPanel`.

## 3. Data shown

Defaults from boot `GET settings`; Hospitable Agent connected / API key only / Not connected; template list; subscriptions in sheets.

## 4. Controls

| Label | Where | Action | Endpoint/op | External effect | Confirm | Gating | Cite |
|---|---|---|---|---|---|---|---|
| Default commission | Row | onBlur save | `POST settings` `update` `default_commission_percent` | New properties only | No | `busy` | `ClientsApp.tsx:2160–2168` |
| Default HST | Row | onBlur save | `update` `default_hst_percent` | New properties only | No | `busy` | `:2177–2185` |
| Connect / Update keys | Hospitable | Open PAT sheet | — | — | No | — | `:2202–2211` |
| Disconnect | Hospitable | Clear tokens | `clear_hospitable_pat` + `clear_hospitable_mcp` | Disconnects API/MCP (server env key may remain) | **None** | Connected | `:2213–2220` |
| PAT / MCP inputs | PAT sheet | Local | — | — | No | — | `:2872–2894` |
| Save & connect | PAT sheet | Verify + store | `save_hospitable_pat` / `save_hospitable_mcp` | **Verifies against Hospitable** | No | One nonempty | `:2896–2903` |
| Manage | Company costs | Subscriptions sheet | `GET company_subscriptions` | — | No | — | `:2231–2240` |
| Subscription CRUD | Sheets | Same as Revenue | `company_subscriptions` | Recurring costs | Delete: none | — | `CompanyPnl.tsx` |
| Upload PDF | Templates | Toggle / create | `POST contract_templates` `create` | Storage | No | PDF | `ContractTemplatesPanel.tsx:112–137` |
| View | Template | Open PDF | `GET contract_template_url` | Signed URL | No | — | `:159–164` |
| Archive | Template | Archive | `archive` | — | No | — | `:166–172` |
| Delete | Template | Delete | `delete` | Storage | **`window.confirm`** | — | `:174–180` |

## 5. States

Busy disables defaults; toast after connect (property/settings surfaces); empty templates copy; Disconnect may say “server key still active”.

## 6. Forms

PAT + MCP token fields; template label + PDF; subscription sheets (shared).

## 7. Mobile

Same column; bottom nav “Settings”.

## 8. Cross-links

Hospitable required before Properties Import; company costs ↔ Revenue P&L; templates used by Clients portal invite.

**OUTWARD:** Hospitable connect/disconnect. No email/SMS/statements from Settings.

**Settings control count: ~33.**

---

# API map (OPS-used resources)

All under `/api/admin/pm` unless noted. Handler: `shared/adminApi/pm.ts`. Auth: partner admin session.

| Resource | GET | POST ops (used by OPS UI) |
|---|---|---|
| `clients` | list | create, update, delete |
| `properties` | list / by id | create, import_hospitable, update, mark_mat_filing, change_rate, link_hospitable, link_apps, push_to_cleaner, workflow_negative_reviews, upload_cover, remove_cover |
| `settings` | defaults + hospitable flags | update, save/clear_hospitable_pat, save/clear_hospitable_mcp |
| `hospitable` | available properties | — |
| `month_close` | portfolio / by client | — |
| `owner_statement` | statement | — |
| `earnings` | month data | sync, add_expense, delete_expense |
| `expense_receipt` | URL | — |
| `property_cover` | (cover access) | — |
| `client_checklist` | steps | — |
| `contracts` | list | create, delete |
| `contract_url` | signed URL | — |
| `contract_templates` | list | create, archive, delete |
| `contract_template_url` | URL | — |
| `portal_preview` | slug + token | — |
| `portal_user` | status | — |
| `portal_invite` | — | send |
| `board` | Copilot tasks | — |
| `team_members` | roster | set_type, delete |
| `staff_users` | list | deactivate, delete |
| `staff_invite` | — | send |
| `time_entries` | hours | — |
| `sops` | list | upload_image, upload_video, save, delete |
| `company_subscriptions` | list | upsert, delete |
| `company_expenses` | — | create, delete |

**Other OPS-related endpoints**

| Endpoint | Use |
|---|---|
| `GET /api/admin/leads` | Create-client CRM lead picker |
| `GET /api/sop?slug=` | Public SOP hub (not admin) |
| `/owner/{slug}?preview=` | Host portal preview |
| `/team/{slug}` | Staff portal |
| `/copilot` | Redirect from old Tasks/Reviews |

**Server ops exist but no OPS UI button found for:** `properties` `link_health`, `resolve_hospitable`, `workflow_supply_reorder`, `workflow_turnover_qa`; `earnings` `sync_reviews`; `tasks` CRUD (moved to Copilot); `review_replies`; `onboarding` / `places` (Onboarding mode).

---

# Cross-links: OPS ↔ CRM / Onboarding / Copilot

| From | To | Mechanism | Cite |
|---|---|---|---|
| ModeSwitcher | CRM / Onboarding / Copilot (Team) | `onModeChange` | `ui.tsx:52–106` |
| `/ops/tasks…` | Copilot Tasks | `openCopilotTasks` + redirect | `opsNav.ts`, `adminRoute.ts:134–137` |
| `/ops/reviews…` | Copilot Reviews | same | `adminRoute.ts:139–142` |
| CRM lead convert | `/ops/clients/new` | `mrg_prefill_client_lead` | `AdminPage.tsx:934–958` |
| Employees empty tasks | Copilot board (copy only) | — | `EmployeesPanel` |
| Employees `staff_type` | Onboarding assignees | Server name match | `team_members` |
| Property Cleaner Hub | `portal.stravo.ai` / hub | `push_to_cleaner` | `properties` op |

Onboarding is a **separate mode**, not an OPS tab. No OPS nav entry for Onboarding beyond ModeSwitcher.

---

# Hidden / conditional features

| Condition | What appears |
|---|---|
| Partner vs staff | Staff never see OPS UI |
| Hospitable not connected | Import opens PAT sheet; earnings show “Link Hospitable…” |
| Property paused (`active:false`) | Badge/opacity; excluded from month close |
| Property unlinked | “Not linked” filter/badge; sync disabled |
| Invoice HST units | HST worklist / ClientMonth HST buttons |
| `awaiting_contract` | Replace contract / Edit boxes only |
| MAT required | MAT quarters + Mark filed |
| Cover present | Remove photo |
| Stale/fail sync counts | Sync banners + Retry |
| Missing Meta ads / software lines | Strip CTAs to add |
| Video SOP (`video_url`) | Edit Guide → Video Studio not step editor |
| `onOpenVideoStudio` missing | Record button gated |
| Desktop only | ClientMonth “Client details”; desktop nav; desktop Sheet layout |
| Mobile only | ClientMonth Copy HST; HST Copy total; bottom nav label remaps |

No feature-flag framework found in OPS clients code. Plan gating: none beyond partner session.

---

# Dead / broken / quirks

| Item | Notes |
|---|---|
| **`HstSetupForm` UI unused** | Only `hstSummaryLabel` / `HstMode` imported by `BillingTermsForm`. Form component never mounted. |
| **Global toast dead for live tabs** | `toast && (tab === "tasks" \|\| "reviews")` — Employees, MonthClose, ClientMonth, Portal toasts often invisible. SopsPanel & property detail have local toasts. |
| **`AdminRoute.sopSlug` unused** | Never parsed or path-built. |
| **SOP step drag handle** | Visual only; no reorder. |
| **SOP ⌘V hint** | Paste only in ImageRedactorModal. |
| **Earnings center month button** | Empty `onClick` (dead). |
| **List → edit not month** | Easy to miss `/ops/clients/:id` month surface. |
| **Nav “Clients” active during property statement** | `tabActive` treats ownerStatement as clients (`ClientsApp.tsx:1204–1205`). |
| **No TODO/FIXME** in `src/pages/clients/*` | Grep clean. |
| **Missing endpoint calls from UI** | None found for sampled OPS `pmGet`/`pmPost` resources. |
| **Destructive without confirm** | Disconnect Hospitable; subscription Delete; company cost Remove; contracts Delete (client/property); SOP editor has confirm for delete. |

---

# Outward-facing actions (must keep behind same button + confirm)

| Action | Tab | Label(s) | Endpoint | External | Confirm today |
|---|---|---|---|---|---|
| Portal invite / resend / replace / existing access | Clients | Send invite, Resend, Replace & resend, Send portal access | `portal_invite` `send` | **EMAIL (Resend)** | None (signature gate only) |
| Host portal preview / open | Clients | Preview, Preview as host, owner URL | `portal_preview` / URL | Host portal | None |
| Employee invite / resend | Employees | Send invite, Resend invite | `staff_invite` `send` | **EMAIL** + clipboard password | None |
| Staff portal open | Employees | Open portal | — | External `/team/{slug}` | None |
| Hospitable connect | Settings / Import | Save & connect | `save_hospitable_*` | Hospitable verify | None |
| Hospitable disconnect | Settings | Disconnect | `clear_hospitable_*` | Disconnect API | **None** |
| Hospitable import / link / sync | Properties / Revenue | Import, Link, Refresh, Sync all, Sync/Retry rows | `import_hospitable`, `link_*`, `earnings` `sync` | Hospitable API | None |
| Cleaner Hub create/open | Properties | Create / open in Cleaner Hub | `push_to_cleaner` | Cleaner app | None |
| Owner expense add/delete | Properties | Save expense / Delete | `earnings` add/delete_expense | Affects host net/statement | Delete: inline Keep/Delete |
| Owner statement PDF | Clients / Properties | Download PDF | Client print | Local PDF only | Pop-up |
| Month CSV export | Revenue | Export CSV | Client blob | Local file | None |
| SOP publish (public URL) | SOPs | Publish SOP | `sops` save/upload | Public `/sop/{slug}` | None |
| SOP delete | SOPs | Delete | `sops` delete | DB | **`window.confirm`** |
| Client delete | Clients | Delete client | `clients` delete | Cascades data | **`window.confirm`** |
| Staff delete / deactivate | Employees | Delete / Remove | `staff_users` delete/deactivate | DB | **`window.confirm`** |
| Template delete | Settings | Delete | `contract_templates` delete | Storage | **`window.confirm`** |

**Not present in OPS UI:** SMS send, Stripe charge/payout, publish owner statement to host email, QuickBooks API (clipboard only).

---

# Control counts (summary)

| Area | Approx. interactive controls |
|---|---:|
| Shared OPS chrome | **10** |
| SOPs (+ ImageRedactor + Video Studio) | **104** |
| Employees | **16** |
| Clients (+ portal, placer, contracts, month, statement) | **77** |
| Properties (+ billing, earnings, contracts, sheets) | **110** |
| Revenue (+ MonthClose + CompanyPnl) | **57** |
| Settings (+ templates + PAT + subs sheets) | **33** |
| **Sum of area totals** | **407** |
| **Unique (subs sheets not double-counted)** | **~389** |

Counting rules: mobile/desktop duplicates of the same control counted once; distinct mobile-only controls counted; `MonthPicker` counted as one widget; row templates counted once; ClientChecklist = 0.

---

# Could not fully determine from code alone

1. Exact Resend email subject/body copy for each portal invite kind (lives in `ownerEmails` / send helpers — not fully expanded in this audit).
2. Exact staff invite email template text.
3. Whether `push_to_cleaner` always opens a new tab vs sync-only when hub id already set (depends on response fields at runtime).
4. Full Video Studio transcript/trim control inventory at every nested state (counted ~48; some conditional HUD buttons may vary by browser PiP support).
5. Whether server env `HOSPITABLE_*` key alone makes Import work after UI Disconnect (UI warns it may).
6. Runtime behaviour when `pm_team_members` / staff SQL not migrated (empty-state copy only).
7. Whether Copilot `board` task statuses beyond the mapped set display correctly (Employees maps a subset).

---

# Files inventoried

```
shared/opsNav.ts
src/lib/adminRoute.ts
src/pages/clients/mode.ts
src/pages/clients/ClientsApp.tsx
src/pages/clients/api.ts
src/pages/clients/ui.tsx
src/pages/clients/format.ts
src/pages/clients/SopsPanel.tsx
src/pages/clients/EmployeesPanel.tsx
src/pages/clients/BillingTermsForm.tsx
src/pages/clients/HstSetupForm.tsx
src/pages/clients/ClientChecklist.tsx
src/pages/clients/ClientMonthPanel.tsx
src/pages/clients/CompanyPnl.tsx
src/pages/clients/ContractTemplatesPanel.tsx
src/pages/clients/ContractsPanel.tsx
src/pages/clients/EarningsPanel.tsx
src/pages/clients/MonthClosePanel.tsx
src/pages/clients/OwnerStatementPanel.tsx
src/pages/clients/PortalInviteControls.tsx
src/pages/clients/SignFieldPlacer.tsx
src/components/sop/ImageRedactorModal.tsx
src/components/sop/VideoSopStudioModal.tsx
src/pages/AdminPage.tsx (partner/staff gate + CRM→OPS prefill)
shared/adminApi/pm.ts
```

---

*End of audit.*
