# Claude Design brief — Revenue Audit **not-listed** (address / pre-Airbnb) path

**Product:** Mandel Realty Group — Revenue Audit (`/revenueaudit`)  
**Audience:** Owner who does **not** have a live Airbnb listing yet (address + beds/baths path)  
**Deliverable:** Design Canvas HTML export (`.dc.html`) for the **not-listed report system** — free preview + paid unlock. Desktop (~1120 content width) + mobile (~390). HTML + inline styles only.

---

## Goal

Design a persuasive, honest **market launch brief** — not a “your listing vs comps” audit.

The free preview must give enough real market signal that paying for the full report feels obvious.  
The paid report must feel like a serious launch dossier that drives a **book-a-call** CTA (MRG client acquisition).

**Do not** design listing-only sections for this path:
- Your rating categories / you-vs-comps scores
- Badge standing (Superhost / Guest Favorite / Top 10% on *your* listing)
- “Your” 12-month listing history
- “Your” forward calendar rates
- Listing booking leaks (photos count, Instant Book, cancellation on *your* URL)

---

## Match the live page

- Font: Plus Jakarta Sans 500–800
- Colors: page `#ffffff`, text `#222222`, muted `#717171` / `#5e5e5e`, borders `#ebebeb` / `#dddddd`, coral `#ff385c`, teal `#00806f` / `#00655a`, dark unlock `#222222`
- Soft 18–20px radii, light shadows, airy spacing
- No purple gradients, cream/gold estate look, Inter/Roboto, emoji, or fake “API cost” / vendor jargon
- Never say AirROI, API, mock pack, or engineering terms in UI copy

Tone: specific, premium, analytical, calm. Launch opportunity — not “you’re failing.”

---

## Data we can actually show (engineering-confirmed)

### Free preview — keep ≤ ~$0.20 API

One call: location estimate for the address / lat-lng + bed count.

| Signal | Use in free UI |
|--------|----------------|
| Monthly / annual revenue estimate | Hero opportunity number |
| ADR + occupancy estimate | Supporting metrics |
| Nearby comps (up to ~12 in payload; **show top 3**) | Proof the market is real |
| Comp photo, beds, monthly $, ADR/occ when present | Comp cards |
| Locked teaser for full set + demand calendar | Drive unlock |

Free must feel valuable: “this address can earn ~$X/mo; three nearby units already do.”

### Paid unlock — extra market calls (~$1.00–$1.40 typical)

All of these work **without** a subject listing ID (lat/lng + beds only):

| Block | What to design | Source (do not mention in UI) |
|-------|----------------|-------------------------------|
| Full comps set | All nearby comps + differentiators as **launch standards** | Comparables / estimate comps |
| Market snapshot | Locality name, active supply, market ADR / occ / revenue | Market lookup + summary |
| Market history | 12-month market seasonality chart (not “your listing”) | Market monthly metrics |
| Booking pace | Near-term fill / high-demand vs soft days | Market pacing |
| Comp forward rates | What top comps are pricing into the next window | Comp future rates (top 3) |
| Launch plan + CTA | Phases, furniture program, book-a-call | MRG product copy (not API) |

**Reuse** the free estimate numbers in paid — do not redesign as if we re-pulled a second “your revenue” number unless labeled the same estimate.

---

## Report narrative (required story order)

### A. Free preview (above unlock)

1. **Address opportunity** — estimated monthly/annual for this bed count at this location  
2. **Three comps** — closest / strongest nearby proof  
3. **Soft lock** — “Full comps + demand calendar + launch plan unlock below”  
4. Unlock CTA (pay / code / book call)

### B. Paid unlock (below the line)

1. **Market deep dive** — where this is, supply, ADR/occ/revenue snapshot  
2. **Full comps gallery** — every comp; frame as “what already wins here” / “what a launch must clear”  
3. **Seasonality** — market 12-month history (label clearly as **market**, not “your history”)  
4. **Demand now** — pacing + high/soft demand days  
5. **What the market is pricing** — top comps’ forward median rates  
6. **How MRG would launch this unit** — phases / furniture / execution (scenario, not fake precision)  
7. **Book the call** — primary conversion

---

## Copy rules for not-listed

Prefer:
- “What this address can earn”
- “Nearby listings already clearing…”
- “Market demand over the next window”
- “Launch standards from top comps”
- “Book a walkthrough to map your unit to this set”

Avoid:
- “Your rating”
- “You’re behind on Superhost”
- “Your listing history”
- “Booking leaks on your listing”
- Any invented % lift or renovation dollar quote presented as measured fact

---

## Placeholder field names (for canvas binding)

Free:
- `estimateMonthly`, `estimateAnnual`, `estimateAdr`, `estimateOcc`
- `comps[]` (3 cards): `title`, `monthly`, `photoUrl`, `meta`, `badge`

Paid:
- `marketName`, `marketAdr`, `marketOcc`, `marketRevenue`, `activeListings`
- `fullComps[]`: `title`, `monthly`, `photoUrl`, `diffs`
- `marketMonthly[]`: `monthLabel`, `occupancy`, `adr`, `revenue`
- `paceAvgFill`, `highDemandDays`, `lowDemandDays`
- `compForward[]`: `name`, `medianRate`
- `unlockNote` / call CTA blocks (existing patterns OK)

---

## Visual honesty

- Live market/comp numbers → grounded, evidence feel  
- Launch phases / furniture → clearly “how we’d approach this,” not measured ROI  
- Never make illustrative MRG process look more factual than the comps

---

## Out of scope for this canvas

- Live-listing rating / badge / listing-leak sections (separate path)
- Stripe checkout redesign
- Admin / CRM

---

## Success check

A not-listed owner should finish the free preview thinking:  
“I can see real money and real comps here — I want the full market picture.”  

After paid:  
“I understand demand, who wins nearby, and I should book MRG to launch against that bar.”
