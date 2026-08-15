# Claude Design brief — Company earnings on Month close

**Product:** Mandel Realty Group Admin → **OPS → Month close**  
**URL:** `admin.mandelrealtygroup.com`  
**Audience:** MRG operators (Shane + team) — **company P&L**, not host-facing  
**Job:** Extend the existing Month close earnings dashboard so operators can see **how much MRG actually made this month** (fees minus HST, minus company costs), with Meta ads + software + other overhead automated.

**Not in scope:** Host portal, owner statements, CRM, Tasks redesign, QuickBooks two-way sync, bank feeds.

---

## Already shipping — extend this, do not redesign the product

Reuse tokens, month picker, 2×2 metric tiles, unit list, HST worklist, Sync all, Export. Frames already exist in `docs/MRG-Month-Close.dc.html` (F1 portfolio).

**Current F1 header tiles (keep the host-ops job):**

| Tile | What it is today | Keep? |
|------|------------------|--------|
| **Net to hosts** | What to EFT hosts | Yes — host payout job |
| **MRG fees** | Management + **cohost HST mixed in** | Replace / split — this overstates earnings |
| **HST to invoice** | QuickBooks invoice-mode HST | Yes — remittance job |
| **Expenses** | Property costs **charged to hosts** | Relabel (e.g. **Host charges**) so it is not confused with company overhead |

**Your job:** Add a **company earnings layer** on this same screen (and a drill-in), without turning Month close into a BI dashboard or a second product called Books.

---

## Brand tokens (exact)

| Token | Hex | Use |
|--------|-----|-----|
| Background | `#0a0a0a` / `#0c0c0c` | Page |
| Surface | `#141414` / `#1c1c1c` | Panels, tiles |
| Text | `#f5f5f5` | Primary |
| Muted | `#9a9590` / `#6f6a65` | Labels, meta |
| Gold | `#c4a35a` | Accent, CTAs |
| Gold light | `#dcc084` | Hover / HST highlight |
| Positive | `#4ea882` | Net profit |
| Warning | `#c99a4b` | Stale / missing spend |
| Danger | `#cf7f7b` | Loss / overdue |
| Hairlines | `rgba(255,255,255,0.08–0.10)` | Borders |

**Font:** Manrope 400/500/600/700  
**Avoid:** purple SaaS, cream paper, Inter, card soup, emoji, neon glow, dense spreadsheet chrome, pie charts, floating badges.

---

## Design principles (hard)

1. **Mobile first 390 × 844**; desktop ~1280. Match existing Month close chrome (safe area, bottom OPS tabs).
2. **One screen, two jobs — visually stacked, not mixed.** Top = **company net**. Below = existing **host close** (pay hosts / bill HST).
3. **No card soup.** Same 2×2 / row tiles as F1. Flat lists for expense lines.
4. **Operator density.** Scan dollars in one glance. Tap a tile → breakdown sheet, not a new app.
5. **Copy-friendly amounts** (tap-to-copy OK).
6. **Calm motion** — sheet rise, list fade. No dashboard widgets.

Sample month: **July 2026**. Currency: **CAD**.

---

## Accounting rules (lock these — do not invent other math)

HST is **collected and remitted**. It is **not** MRG profit.

**Revenue (MRG made, pre-overhead) — Airbnb payout only:**
- **Management fees** = sum of `mrg_commission_cents` (the cut taken from Airbnb host payout). This is the only company revenue line.
- **Do not** include cohost HST or invoice HST in this number.
- **Cleaning is never company revenue.** Not in Net earnings, not in Management fees, not as “Cleaning in.” Cleaning is pass-through to pay cleaners / stays on the host statement only. Do not design a cleaning-income tile.

**Tax (shown, not profit):**
- **HST collected (cohost)** — withheld inside payout, remit to CRA.
- **HST to invoice** — already on screen; QuickBooks / remit.

**Company overhead (new — not host charges):**
- Meta ads (entered as a monthly cost, same as software — **no OAuth “Connect Meta”**)
- Software / subscriptions (auto from a recurring catalog)
- Other one-offs (insurance, contractors, etc.)

**Net earnings (hero):**
`Management fees − company overhead`

If negative, show as a loss (danger color), not $0.

**Do not** subtract host-charged expenses (`pm_manual_expenses`) from company net. Those reduce the host’s payout, not MRG’s profit.

**Hard no:** cleaning fees, cleaning kept-by-MRG, turnover counts as income. Those exist on property earnings / host statements only.

---

## Feature 1 — Company strip on Month close (must)

Add above the existing 2×2 host tiles (mobile + desktop).

**Must show:**
- **Net earnings** — hero, larger / gold or positive green. Hint: “Fees − ads − software − overhead”
- **Management fees** — HST excluded
- **Company costs** — ads + software + other for this month
- Quiet meta: “HST not included · $X to remit” (cohost + invoice combined, or split if it stays scannable)

**Keep** the existing host 2×2 below, with **Expenses** relabeled **Host charges**.

**Tap Net earnings or Company costs** → Feature 2 sheet.

**Empty / edge:**
- Month with $0 fees (still show $0, not blank)
- No ads line yet → costs still work; empty ads is $0, not a Connect CTA
- Recurring software not set up → “Add subscriptions”

**Frames:** F1c mobile Month close with company strip · F1d desktop same

---

## Feature 2 — Month P&L breakdown (sheet)

One sheet / subview for the selected month. Not a new OPS tab.

**Waterfall (top to bottom):**
1. Management fees (from Airbnb, ex HST)  
2. − Meta ads  
3. − Software  
4. − Other overhead  
5. **= Net earnings**  
6. Separate quiet block: HST cohost · HST to invoice (not in the net). **No cleaning line.**

**Line list under the waterfall:** each company cost with category, vendor/label, amount, source badge:
- `Auto · Meta`
- `Auto · recurring`
- `Manual`

Actions: **Add cost** · **Manage subscriptions** (Feature 3). **No Connect Meta button.**

**Frames:** F2 mobile sheet · F2b desktop sheet/panel

---

## Feature 3 — Recurring company costs (subscriptions)

Catalog of monthly (or yearly÷12) company costs that **auto-apply every month**. This is how software stays automated without QuickBooks.

Examples (sample copy, not a required vendor list): Hospitable, Twilio, Anthropic, Cursor, domain/email, insurance.

**Must support:**
- Name, amount, category (`software` | `ads` | `insurance` | `contractor` | `other`)
- Cadence: monthly | yearly (show monthly equivalent)
- Active / paused
- Optional start month
- One-off add for this month only

**Where it lives:** sheet from Month close, **or** a quiet row in OPS Settings (“Company costs”). Prefer sheet-from-Month-close so operators don’t hunt.

**Frames:** F3 list + add/edit sheet, mobile + desktop

---

## Feature 4 — Meta ads spend (no Meta login)

We **cannot** ship a **Connect Meta** / OAuth button. That needs a live, App-Reviewed Meta app we do not have. Do **not** design Connect, Login with Facebook, or Ads Manager campaign lists.

Treat Meta ads as a **normal company cost**:
- Recurring catalog line (e.g. “Meta ads” monthly) **or**
- One-off / month override when actual spend differs

Badge: `Manual` or `Auto · recurring` — never `Auto · Meta`.

Optional quiet hint (not a button): “Paste July spend from Ads Manager.”

Later automation (out of this brief): same Make.com pattern as lead import — webhook posts monthly spend. No in-app Meta connect.

**Frames:** ads is just another row in F2/F3/F5. Do **not** add a Connect Meta artboard.

---

## Feature 5 — One-off company expense

Fast add: amount, label, category, date (defaults to selected month), optional note. No receipt required in v1.

This is **company** spend, not a host charge. Do not reuse the property expense receipt sheet.

**Frames:** F5 compact add sheet

---

## IA (pick one and stick to it)

**Recommended:** stay on **Month close**. Company strip + sheets. Do **not** add a Books tab in this brief.

Optional quiet entry in Settings: **Company costs** (same catalog as F3).

---

## Copy (operator-short)

- Net earnings  
- Management fees (ex HST)  
- Company costs  
- Host charges *(was Expenses)*  
- HST to remit  
- Auto · recurring / Manual  

No marketing fluff. No “insights.”

---

## Success

An operator opens **July**, sees **Net earnings $X** in one glance, taps through to ads + software + other, knows HST is aside to remit, and still has the original host-payout tiles underneath to EFT hosts and bill QuickBooks.

---

## Deliver

Mobile + desktop frames for F1c/F1d, F2, F3, F5. Annotate tile math in a caption. Land as `docs/MRG-Company-Earnings.dc.html` in the same canvas style as `docs/MRG-Month-Close.dc.html`.
