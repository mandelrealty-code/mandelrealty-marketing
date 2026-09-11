# Claude Design — OPS Tasks for teammates (SIMPLE)

**Product:** MRG Admin OPS · Tasks  
**URL:** `admin.mandelrealtygroup.com/ops`  
**Audience:** Internal teammates / VA (not owners, not guests)  
**Timebox:** One design pass. Extreme simplicity.

## Shell lock — do not redesign OPS chrome
Admin OPS already has:
- Top **CRM | OPS** switcher
- Desktop **left tabs:** Tasks · SOPs · Employees · Clients · Properties · Revenue · Settings
- Mobile **bottom nav** with the same destinations

**Design Tasks content only.** Keep those tabs/nav exactly as live. Do not omit them, replace them, or invent a Tasks-only app chrome.

## Scope lock — only design what ships
Design a **busy, fully loaded** Tasks screen using **real data density**, but **only UI that is already built or on the build plan** for Admin Tasks.

### In scope (design this)
| Surface | Status |
|---------|--------|
| Task list (Overdue / This week / Later) | Live |
| Filters: Mine · Open · Done · Blocked | Live / shipping |
| Attention chips (counts only): overdue · supply · QA · link | Live |
| Row: title + property · due · who (+ optional gold high-priority dot) | Live |
| Detail: Done · Blocked · Assign + quiet Due / Property | Live |
| Add sheet: Title · Place · Who · Due · Type · Save | Live |
| Desktop denser list + detail panel/sheet | Live |
| Tasks created from **Cleaner** (low stock, turnover QC) | Live |
| Tasks created from **≤4★ review sync** | Live / shipping |
| Manual VA tasks (owner call, statement prep, misc) | Live |

### Out of scope (do NOT invent UI for these)
- Morning AI digest inbox, chat, or “AI said…” panels (Phase 3 later — **not this canvas**)
- Source badges, app logos, “from Cleaner / Hospitable” chips on rows
- In-app Hospitable messaging / Cohost inbox
- Guidebook editor, Cleaner Hub screens, CRM, Books, Settings
- Kanban, maps, calendars, empty-state essays, onboarding tours
- Any control that isn’t Done / Blocked / Assign / Due / Property / + Add / filters

**Rule:** If it isn’t in the in-scope table, don’t draw it. Filling the list with realistic live-property tasks is good; inventing new chrome is not.

## One sentence job
Open phone → see what to do → tap Done. No reading essays.

## Hard rules
1. **Almost no body copy.** No how-to paragraphs, no SOP text on screen.
2. **One primary action per screen.** List = do tasks. Detail = Done.
3. **Max 3 words on buttons:** Done · Blocked · Assign.
4. **Row = title + place + due (+ who).** Nothing else on mobile.
5. Dark OPS shell: Manrope, gold `#c4a35a`, bg `#0a0a0a`.
6. No cards, no emoji, no purple, no Kanban on mobile.
7. **Dense live list** (~8–12 rows) — fully functional portfolio, not a sparse demo.

## Tokens
Page `#0a0a0a` · surface `#141414` · text `#f5f5f5` · muted `#9a9590` · quiet `#6f6a65` · gold `#c4a35a` · overdue `#cf7f7b` · done `#4ea882`

## Screens (only these)

### T1 — List (mobile 390) — FULLY LOADED, SHIPPABLE
- Header: **Tasks** + gold **+**
- Pills: `Mine` · `Open` · `Done` (Blocked optional as 4th pill — we have it)
- Attention **one line only:** `3 overdue · 2 supply · 1 QA` — zero sentences
- Sections: Overdue / This week / Later
- Row: checkbox · title · `Shaw St · Today · Shane`
- High = tiny gold dot only

### T2 — Detail — real auto task we already create
Use a **supply** or **≤4★ review** task:
- Title · one meta line · ≤2 lines notes
- Fat **Done** · **Blocked** · **Assign**
- Quiet **Due** · **Property**
- No app switchers, no logos, no long notes

### T3 — Add (sheet) — current fields only
Title* · Place · Who · Due · Type (Clean · Fix · Supply · Other) · Save

### T4 — Desktop (~1280)
Same shippable chrome, busy list. No extra panels.

## Sample rows (only task types we actually open)
Properties: Shaw St · Charlotte 606 · King West · Lake Rosseau · Bala Cottage · Distillery Loft

**Auto / sync (already wired or shipping):**
- Review 3★ reply — King West · 2d late · Unassigned *(high)*
- Reorder TP — Charlotte 606 · Today · Alex *(Cleaner low stock)*
- Turnover QC — Shaw St · Today · Shane *(Cleaner cleaning complete)*
- Restock paper towels — Bala Cottage · Tomorrow · Alex *(Cleaner low stock)*

**Manual VA (always available):**
- Owner call — Lake Rosseau · Tomorrow · Shane
- Fix lock delay note — Distillery Loft · Thu · Unassigned
- Statement prep — King West · Later · Shane

Do **not** invent rows that imply unbuilt pipelines (e.g. “Guidebook sync failed”, “AI digest ready”, “Cohost needs you”).

## Success test
Zero-training teammate clears an overdue task in **under 10 seconds**. Screen looks like a real multi-property ops queue — and every control shown can ship with current/planned Tasks work.

## Do not design
Anything in the out-of-scope list above.
