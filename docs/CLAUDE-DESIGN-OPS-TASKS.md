# Claude Design brief — OPS shell + Tasks (first OPS module)

**Product:** Mandel Realty Group Admin  
**URL:** `admin.mandelrealtygroup.com`  
**Audience:** MRG operators (Shane + team) — not hosts, not guests  
**Goal:** Redesign the top product switch to **CRM | OPS**, then design **Tasks** as the first new OPS module (mobile + desktop).

**Already built — reuse, don’t reinvent:**
- Top mode switcher language (gold active pill) — currently labeled CRM | Clients → becomes **CRM | OPS**
- CRM bottom tabs: Contacts · Pipeline · Knowledge · Settings (unchanged)
- Clients / OPS content already shipping: Clients · Properties · Month close · Settings
- Tokens, Manrope, gold CTAs, dark shell, sheets, segmented controls from Clients product mode
- Property / client context exists (names, addresses, months)

**Not in this brief:**
- CRM inbox / pipeline redesign
- Books / bookkeeping screens (future OPS tab — name it in IA only)
- Owner portal / host-facing UI
- Resend / email send UI

---

## Brand tokens (exact)

| Token | Hex | Use |
|--------|-----|-----|
| Background | `#0a0a0a` / `#0c0c0c` | Page |
| Surface | `#0e0e0e` / `#141414` | Panels, list wells |
| Elevated | `#1a1a1a` / `#1c1c1c` | Inputs, sheets |
| Text | `#f5f5f5` | Primary |
| Muted | `#9a9590` | Meta |
| Quiet muted | `#6f6a65` | Timestamps, empty |
| Gold | `#c4a35a` | Active tab, primary CTA |
| Gold light | `#dcc084` | Hover |
| Positive / done | `#4ea882` | Completed |
| Warning / due soon | `#c99a4b` | Due soon |
| Danger / overdue | `#cf7f7b` | Overdue, delete |
| Hairlines | `rgba(255,255,255,0.08–0.10)` | Borders |

**Font:** Manrope 400/500/600/700  
**Avoid:** purple SaaS, cream paper, Inter, card soup, emoji, neon glow, Kanban column spam on mobile, floating badges

---

## Design principles (hard)

1. **Mobile first 390 × 844**; desktop ~1280 for boards/lists.
2. **One job per screen.** Tasks list ≠ task create ≠ Books.
3. **No card soup.** Flat rows, hairline dividers, one sheet at a time.
4. **Operator density:** scan name · property · due · owner in one row.
5. **Thumb zone:** bottom OPS tabs always reachable; primary CTA in reach.
6. **Calm motion:** tab fade, sheet rise, row complete strike/fade.

---

## Part A — App shell: CRM | OPS

### Top switcher (mobile + desktop)
Replace **CRM | Clients** with **CRM | OPS**.

- Same control as today: compact segmented control beside logo
- Active = gold fill + dark text
- Inactive = muted text
- Selecting **CRM** → existing CRM product (Contacts / Pipeline / Knowledge / Settings)
- Selecting **OPS** → OPS product shell (this brief)

Do **not** put Tasks inside CRM. CRM stays sales. OPS stays operations.

### OPS IA (sidebar desktop / bottom tabs mobile)

**OPS bottom tabs (mobile) + left nav (desktop):**

| Tab | Status | Job |
|-----|--------|-----|
| **Tasks** | **Design now (this brief)** | Team delegation queue |
| **Clients** | Built | Hosts list / client month |
| **Properties** | Built | Units, earnings, compliance |
| **Month close** | Built | Portfolio month rollup |
| **Books** | Future — show in IA as muted/coming or omit from v1 tabs | Company + client financials / HST |
| **Settings** | Built | PAT, defaults, commission |

**v1 recommendation for Claude Design:** Show **5 OPS tabs** — Tasks · Clients · Properties · Month close · Settings.  
Leave **Books** as a quiet “soon” row in Settings **or** a sixth muted tab with empty state — pick one; don’t invent a full Books UI here.

### Header (OPS)
- Logo mark + “Mandel Realty Group” (desktop) + **CRM | OPS** switcher
- No duplicate page title next to the switcher (avoid the old white “Contacts” bug)
- Optional right actions per tab (Refresh, + Task on Tasks)

### Frames required (shell)
- **S1** Mobile OPS home on Tasks tab (bottom nav visible)
- **S2** Desktop OPS with left nav + Tasks main
- **S3** Top switcher: CRM active vs OPS active (both)

---

## Part B — Tasks module (build first)

### Job
Give MRG a shared task list so cleaning follow-ups, maintenance, owner asks, permit/MAT work, and statement prep don’t live in WhatsApp threads.

### People
- Assignees: Shane, partner, cleaner leads, future teammates (free-text or simple roster for v1)
- Creators: any operator

### Task model (must support in UI)

| Field | Notes |
|-------|--------|
| Title | Required, short |
| Detail / notes | Optional |
| Status | `open` · `in_progress` · `blocked` · `done` |
| Priority | `normal` · `high` (keep simple — no 5-level P0–P4) |
| Assignee | Person name / “Unassigned” |
| Due date | Optional date |
| Property | Optional link to existing property |
| Client | Optional (auto from property when linked) |
| Month | Optional `YYYY-MM` (for statement / month-close work) |
| Type / tag | `cleaning` · `maintenance` · `owner` · `compliance` · `statement` · `other` |
| Created / updated | Quiet meta |

**Blocked** = waiting on owner, vendor, or Airbnb — show reason in detail.

### Primary screens

#### 1) Tasks list (default OPS landing)
**Filters (compact, max ~4 visible):**
- Mine / All
- Open + In progress (default) · Done · Blocked
- Optional: Due (overdue / this week)
- Optional type chip row (scroll, don’t wrap into a pill runway)

**Row anatomy (one line + one subtitle):**
- Title (primary)
- Subtitle: Property or client · due label · assignee
- Leading or trailing status mark (quiet gold / green / amber / danger — not a fat badge)
- High priority = subtle gold mark, not a sticker

**Empty state:** “No open tasks — add one for the team.”  
**Overdue:** due date in danger color; section or sort overdue first within Open.

**Primary CTA:** **+ Task** (gold)

#### 2) Create / edit task (sheet on mobile, side panel or sheet on desktop)
- Title, detail
- Status, priority, assignee, due
- Property picker (search existing OPS properties)
- Month picker (optional — same branded month control as Clients)
- Type
- Save / Delete (delete quiet, confirm)

#### 3) Task detail (tap row)
- Full fields
- Quick actions: Mark done · Mark blocked · Reassign · Change due
- Link affordance: “Open property” if linked
- If month set: quiet “For July 2026 statement” meta

### Sorting (default)
1. Overdue open tasks  
2. Due today / this week  
3. High priority  
4. Recently updated  

Done tasks: separate filter, not mixed into the main queue by default.

### Recurring (design affordance only — v1 can be manual)
Show a quiet “Repeat” control on create (Off / Weekly / Monthly) so the UI anticipates templates (turnover checklist, monthly statement prep). If too heavy, hide behind `···` and note “v2”. Prefer designing the control so we can ship Off-only first.

### Notifications
**Out of scope for UI chrome** beyond a quiet “Assigned to you” filter. No notification center in this brief.

---

## Copy tone
Operator-short. No marketing fluff.  
Examples:
- “Turnover QC — Shaw St”  
- “Waiting on owner for MAT Q2 proof”  
- “Prep Precilla July statement”  

---

## Frames checklist (deliver these)

### Shell
- [ ] S1 Mobile OPS · Tasks tab active · bottom nav  
- [ ] S2 Desktop OPS · left nav · Tasks  
- [ ] S3 CRM \| OPS switcher states  

### Tasks
- [ ] T1 Mobile task list (open queue with overdue + due soon)  
- [ ] T2 Mobile empty state  
- [ ] T3 Mobile create-task sheet  
- [ ] T4 Mobile task detail  
- [ ] T5 Desktop task list + filters  
- [ ] T6 Desktop create/edit (sheet or right panel)  

### Sample data (use these)
- Property: `Chic 2BR | Yard + Parking | Shaw St`  
- Client: `Precilla Daniel`  
- Month: `July 2026` / `August 2026`  
- Assignees: `Shane`, `Alex`, `Unassigned`  
- Example tasks: turnover QC, AC leak follow-up, MAT filing, invite Airbnb owner connect, prep owner statement  

---

## Success criteria
A teammate opens OPS → Tasks on their phone and in under 5 seconds knows: **what’s overdue, what’s mine, what to do next** — without opening WhatsApp.

---

## Handoff note for engineering (after design)
1. Rename mode `clients` → `ops` in UI only first (route/storage can alias)  
2. Add OPS tab **Tasks** ahead of Clients in nav order  
3. Implement Tasks CRUD against new `pm_tasks` table  
4. Books remains future tab  

**Design file naming suggestion:** `OPS-Tasks.dc.html` (or Claude Design export into `docs/`).
