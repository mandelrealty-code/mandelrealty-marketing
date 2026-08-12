# Claude Design brief — Clients tab: Month-close ops (6 features)

**Product:** MRG Admin → **Clients** mode (operator tool)  
**URL:** `admin.mandelrealtygroup.com`  
**Audience:** MRG operators closing the month — pay hosts, bill HST in QuickBooks, keep data fresh  
**Not in scope:** Host portal, owner PDF statement (already designed — back burner). Do not redesign login or CRM.

**Already designed & shipping — reuse, don’t reinvent:**
- Shell, tabs, lists, sheets: `Clients Properties v2` / Clients product mode
- Tokens, Manrope, gold CTAs, bottom tabs (Clients · Properties · Settings)
- Per-property earnings waterfall + HST cohost vs invoice readout
- Property import HST question + Change HST sheet

**Your job:** Design the **six month-ops features** below so we can implement them **one feature at a time**. Each feature should have clear mobile + desktop frames. Prefer extending the existing Clients shell (new tab **or** section under Properties / client detail) over inventing a second product.

---

## Brand tokens (exact)

| Token | Hex |
|--------|-----|
| Background | `#0a0a0a` / `#0c0c0c` |
| Surface | `#141414` / `#1c1c1c` |
| Text | `#f5f5f5` |
| Muted | `#9a9590` / `#6f6a65` |
| Gold | `#c4a35a` |
| Gold light | `#dcc084` |
| Positive / fresh | `#4ea882` |
| Warning / stale | `#c99a4b` or soft amber |
| Danger | `#cf7f7b` |
| Hairlines | `rgba(255,255,255,0.08–0.10)` |

**Font:** Manrope 400/500/600/700  
**Avoid:** purple SaaS, cream paper, Inter, card soup, emoji, neon glow, dense spreadsheet chrome, floating badges

---

## Design principles (hard)

1. **Mobile first 390 × 844**; desktop ~1280 for list/ops boards.
2. **One job per screen / section.** Month Close ≠ Settings.
3. **No card soup.** Flat lists, hairline rows, one elevated sheet at a time.
4. **Operator density:** rows must scan fast (name · $ · status) — iMessage-list energy, not a BI dashboard.
5. **Month picker** matches existing Clients branded month control (not a stock OS picker).
6. **Copy-friendly:** HST and payout amounts should feel easy to copy (tap-to-copy affordance OK).
7. Calm motion only — sheet rise, list fade.

**Suggested IA (pick one clear approach and stick to it):**
- Add a fourth bottom/desktop nav item: **Month** (or **Close**), **or**
- Put a **Month close** entry at top of Properties / Settings  

Label it clearly for operators. Sample month: **July 2026**. Currency: **CAD**.

---

## Feature 1 — Month ops / portfolio rollup

**Job:** One screen to see every unit for a chosen month and close payouts with confidence.

**Must show (portfolio header):**
- Month picker
- Totals: **Net to hosts** · **MRG fees** · **HST to invoice** · **Expenses**
- Unit count · linked vs unlinked · last fleet sync hint
- Primary actions: **Sync all** (ties to Feature 3) · optional **Export** (quiet)

**Must show (per-unit rows):**
- Property name · client name
- Net to host · MRG fee · HST to invoice (or “—” / “cohost” if not invoice mode)
- Expense total
- Sync age / stale flag (ties to Feature 3)
- Tap → existing property earnings detail

**Empty / edge:** no properties; month with zero stays; unlinked units called out quietly.

**Frames:** F1 mobile portfolio · F1b desktop portfolio

---

## Feature 2 — QB HST invoice worklist

**Job:** Build the QuickBooks invoice without opening each property.

**Filter:** Only units with `hst_mode = invoice` for the selected month.

**Must show:**
- Month picker
- Client grouping (e.g. Khamraj → his units) **or** flat list sorted by client
- Per unit: property name · total nightly · HST rate % · **HST $ to invoice**
- Per client subtotal HST
- Grand total HST for the month
- Affordance: **Copy amount** / **Copy client summary** (design the chip/button — don’t wire)
- Quiet helper: “Bill outside cohost · QuickBooks”

**Do not** show full stay ledgers here — link/tap through to property if needed.

**Frames:** F2 mobile HST worklist · F2b desktop · F2c one client expanded (optional)

---

## Feature 3 — Fleet sync + stale flags

**Job:** Know what’s fresh before paying anyone.

**Must design:**
- **Sync all** control (gold, with busy state “Syncing…”)
- Row-level sync status:
  - Fresh (e.g. “Updated 9:12 AM”) — quiet muted / green dot
  - Stale (e.g. “2 days ago”) — amber
  - Empty / $0 financials — warning “Needs sync”
  - Not linked — “Not linked”
- Optional filter chips: All · Stale · Unlinked · Ready
- Success toast pattern: “12 units synced”
- Error row/state if one unit fails (don’t block the whole list visually forever)

Integrate status into Feature 1 rows — don’t invent a totally separate product page unless necessary. A dedicated **Sync** sheet or top-of-Month banner is OK.

**Frames:** F3 portfolio with mixed sync states · F3b syncing · F3c sync result toast/banner

---

## Feature 4 — Client-scoped month view

**Job:** Prep one host’s payout from the client, not the property list.

**Entry:** Client detail / sheet → **July earnings** or **Month for this client**

**Must show:**
- Client name · month picker
- Rollup: Net · MRG fees · HST to invoice (if any) · Expenses
- List of that client’s units with same row language as Feature 1
- CTA: open unit earnings · jump to HST worklist filtered to this client (if invoice)

**Frames:** F4 client month mobile · F4b desktop (client context + unit list)

---

## Feature 5 — Richer expenses (on property earnings)

**Job:** Capture owner charges with enough detail for month-end (without building the full host PDF vault).

**Extend existing** property earnings expense UI (v2 already has simple expense rows).

**Must design:**
- Add expense sheet fields:
  - Amount
  - Date
  - **Category** picker (Supplies · Maintenance · Cleaning · Other — editable list OK)
  - **Note** (optional)
  - **Receipt** optional attach (PDF/image) — show chip/thumbnail when present
- Expense list row: category · label/note · date · amount · paperclip if receipt
- Delete remains available
- Empty state: “No expenses this month”

**Frames:** F5 earnings with rich expense rows · F5b add expense sheet (mobile) · F5c receipt attached state

---

## Feature 6 — Property hygiene

**Job:** Keep the book of record clean without leaving Clients.

**Must design:**

**A. Properties list**
- Filter / scope by client (select or chip: All clients · Khamraj · …)
- Clear linked / rate / active state on rows

**B. Edit property sheet**
- Name, address, assign client
- Active / paused (or deactivate)
- Hospitable link status + Link / Change (existing pattern)
- Save / Cancel

**C. Deactivate confirm**
- Quiet confirm: “Hide from active lists? Earnings history kept.”

**Do not** redesign import or HST setup — those already exist.

**Frames:** F6 filtered properties list · F6b edit property sheet · F6c deactivate confirm

---

## Sample data (use consistently across frames)

- Month: **July 2026**
- Clients: **Khamraj** (invoice HST 13%), **Danielle** (cohost HST 3%)
- Units: Maple Suite, Harbour Loft (Khamraj); King West (Danielle)
- Example totals: Net hosts **$11,420** · MRG **$2,180** · HST to invoice **$1,170** · Expenses **$186**
- Sync mix: 2 fresh, 1 stale, 1 unlinked

---

## Frames checklist (ship all)

| ID | Feature | Frame |
|----|---------|--------|
| F1 | 1 Portfolio | Month ops mobile |
| F1b | 1 Portfolio | Month ops desktop |
| F2 | 2 HST QB | Invoice worklist mobile |
| F2b | 2 HST QB | Invoice worklist desktop |
| F3 | 3 Sync | Mixed stale/fresh states on portfolio |
| F3b | 3 Sync | Sync all in progress + result |
| F4 | 4 Client month | Client-scoped rollup mobile |
| F4b | 4 Client month | Desktop |
| F5 | 5 Expenses | Earnings + rich expense list |
| F5b | 5 Expenses | Add expense sheet |
| F6 | 6 Hygiene | Properties filtered by client |
| F6b | 6 Hygiene | Edit property sheet |
| F6c | 6 Hygiene | Deactivate confirm |

Optional: F2c client-grouped HST expansion; F5c receipt chip detail.

---

## Implementation note (for engineers — reflect in UI labels only)

We will build **feature-by-feature** in this order after design:

1. Portfolio rollup → 2. HST worklist → 3. Sync all/stale → 4. Client month → 5. Richer expenses → 6. Hygiene  

Design so each feature can ship alone without waiting on the rest (e.g. HST worklist usable even if Sync all isn’t done yet).

---

## Success test

An operator can open **July**, see every unit’s net, sync what’s stale, copy Khamraj’s HST total into QuickBooks, open one client’s month, add a supply expense with receipt, and edit/deactivate a property — all inside Clients, without spreadsheets.

---

## One-line direction

**Extend MRG Clients into a dark-gold month-close cockpit: portfolio payouts, QuickBooks HST queue, fleet sync health, client rollups, real expenses, and clean property records — feature-sized frames we can build one at a time.**
