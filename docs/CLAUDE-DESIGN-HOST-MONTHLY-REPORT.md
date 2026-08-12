# Claude Design brief — Host Monthly Ownership Report (MRG)

**Product:** Mandel Realty Group — host-facing monthly statement  
**Audience:** Property owners / managed hosts (not internal admin)  
**Delivery:** Designed as a **beautiful printable / PDF / email-forwardable report** (desktop letter ~816×1056 or A4-ish vertical, plus a **phone preview 390** of the same content scrolled). This is what hosts receive at month end — not an admin CRUD screen.

**Brand (exact):**

| Token | Hex | Use |
|--------|-----|-----|
| Background | `#0a0a0a` / `#0c0c0c` | Page |
| Surface | `#141414` / `#1c1c1c` | Panels |
| Text | `#f5f5f5` | Primary |
| Muted | `#9a9590` / `#6f6a65` | Meta, labels |
| Gold | `#c4a35a` | Accent, CTAs |
| Gold light | `#dcc084` | Hover |
| Up / positive | `#4ea882` | MoM/YoY gains |
| Down / deduction | `#cf7f7b` or quiet muted | Losses, deductions (not loud red everywhere) |
| Hairlines | `rgba(255,255,255,0.08–0.10)` | Borders |

- Font: **Manrope** 400/500/600/700
- Logo: **MRG** wordmark / mark in gold or white — brand-first on cover, quieter on inner pages
- Avoid: purple SaaS, cream paper, Inter, card soup, emoji, neon glow, newspaper layouts, dense spreadsheet look

**Tone:** Modern luxury property management. Calm, trustworthy, scannable in 60 seconds. One clear hierarchy: **what you earned → what changed → what happened on the property → documents**.

---

## Job of this artifact

A complete **end-of-month host packet** for one client (can cover multiple units). Hosts should leave with: payout confidence, performance context, and proof of ops work (supplies, maintenance, cleaning) with attachments.

Use **realistic sample data** (e.g. client “Khamraj”, July 2026, 1–2 Ontario short-term units, CAD, 15% management, HST either cohost 3% or monthly invoice 13% — show one example clearly labeled).

---

## Required frames

1. **Cover / hero** — month + client + portfolio snapshot
2. **Earnings summary** — the money page hosts care about most
3. **Stay-by-stay breakdown** (one unit)
4. **Ops & spend** — supplies / maintenance / cleaning with invoice attachments
5. **Multi-unit portfolio** (if 2+ properties) — rollup + per-unit tiles
6. **Phone scroll** of frames 1–4 (same content, mobile composition)
7. Optional: **light email wrapper** (“Your July report from MRG” + Open PDF CTA) — keep minimal

---

## Content that MUST appear (literally everything useful)

### A. Header / identity

- MRG brand + “Owner statement”
- Client name, report month (e.g. July 2026), prepared date
- Properties covered (names + city)
- Currency (CAD)
- Confidential / for owner eyes only (quiet)

### B. Hero money (above the fold on earnings page)

- **Gross booking revenue** (guest-facing or commission base — label clearly)
- **Net to host** (big number — the hero)
- **MoM % change** vs prior month (net + revenue) with ↑/↓ and absolute $
- **YoY % change** vs same month last year
- Mini sparkline or quiet bar for last 6–12 months net (decorative but real-looking)
- Occupancy: nights booked / available, occupancy %, ADR (avg nightly), RevPAR if space allows
- Reservation count + turnover/cleaning count

### C. Payout math (transparent, one composition — not a spreadsheet)

Show the waterfall clearly:

1. Commission base (nightly − platform host fees)
2. − MRG management fee (rate % shown)
3. − HST (mode labeled: *built into cohost* **or** *billed separately via QuickBooks*)
4. ± Cleaning (who keeps it: MRG vs host)
5. − Owner expenses / supplies charged to host
6. **= Net to host**

If HST is invoice mode: show **HST to invoice** as a separate callout (“billed outside this payout”) so hosts aren’t confused.

### D. Month-over-month & year-over-year panel

- Table or dual columns: This month | Last month | Same month LY
- Metrics: Gross, Net, Nights, Occupancy, ADR, MRG fees, Expenses
- % deltas with color only when meaningful

### E. Stay ledger

Each stay row:

- Date range · guest first name / booking channel
- Nights · base · MRG fee · HST · cleaning · **net**

Footer totals matching the summary (math must look consistent).

### F. Supplies & reimbursables

- List: date, vendor, category (toiletries, linens, consumables…), amount, who paid
- **Invoice attached** affordance: thumbnail / “PDF” chip / paperclip + filename
- Subtotal charged to owner this month
- Empty state if none

### G. Maintenance reports

- Work orders completed this month: date, unit, issue, resolution summary, cost if owner-paid, status Done
- Photos placeholder strip (before/after) — optional but design it
- Open / deferred items for next month (short)

### H. Cleaning reports

- Turnover list: checkout date → clean completed, cleaner/vendor, pass/fail or notes, fee
- Quality note if any (damage, missing items)
- Link/chip: cleaning checklist / photo report attached

### I. Documents vault (month attachments)

Unified strip or list of everything attached this month:

- Supply invoices
- Maintenance invoices / photos
- Cleaning photo reports
- Any contracts renewed

Each with type icon, title, date, “Included in PDF pack”.

### J. Portfolio rollup (multi-unit)

- Per-property: net, MoM %, occupancy, nights
- Combined net + combined MoM/YoY
- Which unit drove the change (one quiet insight line)

### K. Closing / next steps

- Payout method + expected deposit date (e.g. EFT · on or after Aug 5)
- HST invoice note if applicable (“QuickBooks invoice #… for $X”)
- Questions CTA: reply to this email / contact MRG
- Thank-you line — premium, short, no fluff
- Footer: Mandel Realty Group · statement ID · page X of Y

---

## Design principles (hard)

- **One composition per page** — not a dashboard of widgets
- Brand is visible on the cover; inside pages: content first, gold as accent only
- Prefer editorial layout: strong typography, generous spacing, hairline rules — **not** Bootstrap cards
- Charts: one elegant sparkline / thin bars max — no chart junk
- Attachments feel premium (subtle file chips), not Google Drive clutter
- Print-safe: works as a dark digital PDF (preferred — modern, on-brand)
- No fake AI badges, no purple, no emoji

---

## Sample narrative to design against

July 2026 · Client Khamraj · 2 units · Net to host **$7,842** · MoM **+12.4%** · YoY **+8.1%** · 23 nights · 78% occ · Supplies $186 (2 invoices) · 1 maintenance (AC filter) · 6 turnovers cleaned · HST monthly invoice $585 outside payout.

---

## Success test

A host opens page 1 and instantly knows **what they made** and **whether the month was up or down**. By the end of the pack they can see **every stay, every dollar deducted, every invoice, every clean and repair** — and trust MRG without opening Hospitable or emailing for receipts.

---

## One-line direction

**A dark-gold, modern MRG owner statement that feels like a private wealth report for a short-term rental — complete monthly money + ops proof in one pack.**
