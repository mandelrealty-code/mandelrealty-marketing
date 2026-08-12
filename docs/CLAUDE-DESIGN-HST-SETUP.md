# Claude Design brief — Property import: HST setup (one question)

**Product:** MRG Admin → Clients mode  
**URL:** `admin.mandelrealtygroup.com`  
**Goal:** When importing/creating a Hospitable unit, ask **one clear HST question** so operators never see a confusing dual control later.

**Already designed:** Clients / Properties v2 (`docs/Clients-Properties-v2.dc.html`) — reuse shell, tokens, sheets.  
**Your job:** Design the **import / first-time property setup** step for HST only (plus light polish if the import sheet needs it).

---

## Design principles

- Same tokens as CRM/Clients: `#0a0a0a`, gold `#c4a35a`, Manrope, mobile 390 first, desktop 1280.
- **One job:** answer how HST works for this unit.
- No card soup. No jargon wall. Two choices max, then a % if needed.
- Thumb-friendly sheet on mobile.

---

## The question (exact copy — keep close)

**Title:** How do you collect HST for this unit?

**Two options (pick one):**

1. **Built into cohost payouts**  
   Helper: “HST % is taken automatically with your management fee on each stay.”

2. **Bill monthly (QuickBooks)**  
   Helper: “Invoice HST at month end as % of total nightly rate — not via cohost.”

After they pick, show **one % field** (default 3% for cohost, suggest **13%** when monthly invoice is selected — editable).

Primary CTA: **Continue** / **Import unit** (same sheet as Hospitable import).

---

## Where this lives

Fold into the existing **Import from Hospitable** flow (and manual Add property if space allows):

1. Pick client  
2. Pick Hospitable unit  
3. **HST question (this frame)** ← new  
4. Confirm → property created with `hst_mode` + `hst_bps` set  

On **property detail later**, Terms should show a **readout**, not a second competing control:

- “HST · Cohost · 3%” + quiet **Change**  
  or  
- “HST · Monthly invoice · 13%” + quiet **Change**  

Change opens a small sheet that reuses the same two-option question (not a permanent segmented control + orphan % side by side).

---

## Frames required

| # | Frame |
|---|--------|
| 1 | Import sheet — HST question (mobile), cohost selected + % |
| 2 | Import sheet — HST question (mobile), monthly invoice selected + 13% suggested |
| 3 | Property detail Terms — HST as single summary row + Change (mobile) |
| 4 | Change HST sheet (mobile) — same two options |
| 5 | Desktop variants of 1 and 3 (optional if 1–4 are clear) |

---

## What to remove from current UI (call out in design)

Current property detail has:

- Label “HST / cohost”  
- % input  
- Segmented **Cohost % | QB invoice**  

That feels like two controls for one decision. Replace with **one summary row** + sheet.

---

## Data mapping (for engineers — show labels only in UI)

| Choice | `hst_mode` | Default % |
|--------|------------|-----------|
| Built into cohost payouts | `cohost` | 3% |
| Bill monthly (QuickBooks) | `invoice` | 13% |

Earnings math (already built):

- Cohost → `% × commission base` (nightly − host fees), deducted with fee  
- Invoice → `% × total nightly`, shown as **HST to invoice**, billed outside cohost  

---

## Success test

An operator importing Khamraj’s unit can answer in **one tap + one %,** without knowing what “cohost surcharge vs QB base” means — the helpers explain it.

---

## One-line direction

**One HST question at import — two plain answers — property detail only summarizes.**
