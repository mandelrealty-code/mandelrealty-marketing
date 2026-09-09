# Claude Design brief — Revenue Audit rating categories

**Product:** Mandel Realty Group — Revenue Audit (`/revenueaudit`)  
**Scope:** One free-report section only — **Your rating categories** (you vs nearby comps)  
**Deliverable:** Design Canvas HTML slice (`.dc.html`). Desktop (~1120) + mobile (~390). HTML + inline styles only.

---

## Job

After the host runs the audit, show their **Airbnb category scores** against the **nearby comps median** — same data we already pull from AirROI (`rating_cleanliness`, `rating_communication`, `rating_accuracy`, `rating_checkin`, `rating_value`, `rating_location`, plus overall). No new API calls.

Tone: analyst readout. Specific. Never invent scores. Never guarantee revenue from a rating gap.

---

## Match the live page

- Font: Plus Jakarta Sans 500–800  
- Colors: `#ffffff`, `#222222`, muted `#717171` / `#5e5e5e`, borders `#ebebeb`, coral `#ff385c`, teal `#00806f` / `#00655a`, missing pink `#fdeef1` / `#b8072f`  
- Soft 18–20px radii, light shadow, airy spacing  
- Match “Your badge standing” / “What is quietly costing you bookings” language  
- No cream/gold estate look, purple, Inter/Roboto, emoji

---

## Data shape

| Field | Example |
|--------|---------|
| `c.name` | `"Cleanliness"` |
| `c.score` | `"4.60"` (their listing) |
| `c.market` | `"4.90"` (comps median) |
| `c.delta` | `"-0.30"` or `"On par"` |
| `c.below` | boolean — true if they trail market |
| `c.barFill` | e.g. `"60%"` visual fill for their score |
| `c.marketMark` | e.g. `"90%"` position for market marker |
| `overallScore` | `"4.72"` |
| `overallMarket` | `"4.91"` |
| `reviewCount` | `"18 reviews"` |
| `ratingsLive` | boolean |

**Primary mock (mixed):**

- Overall **4.72** vs comps **4.91** · 18 reviews  
- Cleanliness 4.60 vs 4.90 (below)  
- Value 4.50 vs 4.85 (below)  
- Communication 4.90 vs 4.92 (on par / slight below)  
- Accuracy 4.85 vs 4.90  
- Check-in 4.90 vs 4.91  
- Location 4.95 vs 4.88 (ahead)

Include a short support line: scores from their Airbnb URL; market bar = median of nearby comps with the same bed count.

---

## Design requirements

- One H2 + one support sentence  
- Overall score must be the hero signal; categories ranked with weakest first or clear “below market” emphasis  
- Mobile (~390): single column, readable, no horizontal scroll, bars usable on phone  
- 1–2 subtle motions max  
- Do **not** design guest-complaint quotes (AirROI has no review text)  
- Do **not** invent % revenue lifts from rating gaps  

Filename suggestion: `RatingCategoriesSection.dc.html`

---

## Success test

Cover the numbers and a host should still feel “this is my listing vs my market.” It should clearly belong on the MRG Revenue Audit page beside badge standing and booking leaks.
