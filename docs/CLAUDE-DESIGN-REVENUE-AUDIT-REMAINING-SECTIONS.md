# Claude Design brief — Revenue Audit remaining sections

**Product:** Mandel Realty Group — Revenue Audit (`/revenueaudit`)  
**Scope:** Redesign the remaining sections that still rely on modeled, fallback, or placeholder content.  
**Deliverable:** One cohesive Design Canvas HTML export (`.dc.html`) covering these sections as a system, not as unrelated fragments. Desktop (~1120 content width) + mobile (~390). HTML + inline styles only.

---

## Goal

We already upgraded the report so the following are now data-backed from existing AirROI calls:

- nearby comps
- booking leaks
- badge standing
- rating categories

What remains in the report is a mix of:

- modeled revenue/projection assumptions
- fallback values
- hardcoded proof-card stats
- canned execution / renovation / complaint examples

Your job is to redesign these areas in **one coordinated pass** so the page feels premium, consistent, and honest. The design must make a clear distinction between:

1. **Live data from the audit**
2. **Modeled scenarios**
3. **Illustrative / optional / advisor-led sections**

Do **not** make modeled content look like API-fetched fact.

---

## Match the live page

- Font: Plus Jakarta Sans (or closest), weights 500-800
- Colors: page `#ffffff`, text `#222222`, muted `#717171` / `#5e5e5e`, borders `#ebebeb` / `#dddddd`, coral `#ff385c`, teal `#00806f` / `#00655a`, dark panel `#222222`
- Shape language: soft 18-20px radii, light shadows, airy spacing
- Existing vibe: polished SaaS audit, not luxury-real-estate beige, not startup gradient soup
- No purple gradients, no cream/gold estate look, no emoji, no Inter/Roboto

Tone: specific, premium, analytical, calm.  
Never imply certainty where the section is only a scenario, estimate, or implementation example.

---

## What this redesign must solve

Right now these areas contain hardcoded or placeholder content:

1. `lossRows` impact figures
2. fallback `categories` values
3. `rooms` fixture / renovation cost ranges
4. `complaints` example themes
5. `exec30` / `exec60` canned milestones
6. `metrics` generic labels
7. proof-card `listings` stats
8. `moderateUplift` / `optimizedUplift`
9. phase lift numbers and derived dollar lifts
10. modeled occupancy assumptions in tier projections
11. 12-month calendar seasonality model
12. offer / pricing UI values

The redesign should reduce the feeling of "fake precision" even before engineering replaces every field.

---

## Core design principle

Use **visual honesty**:

- If something is live from AirROI, it should feel grounded and evidence-based.
- If something is a projection, it should feel like a scenario with assumptions.
- If something is an advisor example, it should feel like a guided illustration, not a measured fact.

We are not asking you to remove persuasive sections.  
We are asking you to make them feel **trustworthy** and **clearly categorized**.

---

## Sections to redesign

### 1) Revenue projection / scenario block

This area currently uses:

- modeled uplift multipliers (`1.3`, `1.85`)
- modeled occupancy changes
- derived annual / monthly / nightly outputs

Redesign this so it reads as a **scenario planner**, not a hard promise.

Design requirements:

- Show a clear "Current pace" anchor
- Show 2 improved scenarios after it
- Make the assumptions visibly secondary
- Use labels like:
  - `Current pace`
  - `Moderate improvement`
  - `Fully optimized`
- Allow short assumption text under each scenario
- Make it obvious the improved states are based on optimization, not guaranteed API facts
- Avoid overconfident chartjunk

What engineering can already supply:

- current revenue
- current ADR
- current occupancy

What is still modeled:

- improvement multipliers
- projected occupancy lift
- projected nightly / annual outputs from those assumptions

The design should make that distinction elegant and obvious.

---

### 2) 4-phase plan / expected lift block

This area currently includes:

- Phase 1 through Phase 4
- spend ranges
- expected lift numbers
- some of those lifts are hardcoded percentages or derived from modeled revenue

Redesign it so the section feels like:

- a strategic rollout
- a roadmap with effort / spend / likely upside bands
- not fake certainty

Design requirements:

- Each phase should show:
  - phase name
  - what happens in that phase
  - spend posture (`No-cost`, `Light spend`, `MRG-funded when eligible`, etc.)
  - upside framing that feels directional unless live math is available
- Good patterns:
  - "Typical upside range"
  - "Often where the first lift comes from"
  - "Usually the highest-leverage operational fixes"
- Bad patterns:
  - huge exact percentages with no assumptions
  - making every phase feel equally proven

This should still be sales-effective, but more believable.

---

### 3) "What you lose / what MRG delivers" block

This area currently uses hardcoded impact lines like:

- `Commonly a 10-40% swing`
- `Typically another 8-15% booked nights`
- `Real clients have roughly doubled monthly revenue after this alone`

Redesign the block so impact is communicated with more nuance.

Design requirements:

- Preserve the contrast between "what is costing bookings" and "what MRG changes"
- Impact can be shown as:
  - ranges
  - directionality
  - "largest upside usually comes from..."
  - confidence level or evidence style labels
- Avoid making every line look equally data-proven
- A row can carry a tag like:
  - `Live gap`
  - `Modeled upside`
  - `Client pattern`

This is important: the visual treatment should help the host understand what is measured now versus what is based on experience.

---

### 4) Renovation / furnishing scope block

This area currently contains fixture-level room rows with hardcoded cost ranges like:

- living room
- primary bedroom
- den
- kitchen
- bathrooms

Redesign it as a more premium advisor/planning section.

Design requirements:

- It should feel like a scoped plan, not a spreadsheet
- Each room can show:
  - what stays
  - what changes
  - rough spend band
  - optional ROI / guest-impact framing if visually useful
- The cost range should be clearly presented as a planning range, not a quote
- Good phrases:
  - `Typical refresh range`
  - `Illustrative scope`
  - `Final budget depends on level of finish`

This section may still use placeholder ranges for now, so design accordingly.

---

### 5) Review-risk / complaint-pattern section

We do **not** have review-text ingestion from AirROI.  
So do not design this as "these are your actual guest complaints."

Redesign it so it reads as:

- common review risks that usually suppress conversion or repeat bookings
- paired with the operational fix

Design requirements:

- Position this as a pattern library or operational risk board
- Not literal quotes from this listing unless engineering explicitly supplies them later
- Could be cards, a risk matrix, or a checklist-style diagnostic
- Must feel useful without pretending to be personalized text analysis

---

### 6) 30 / 60-day execution plan

This area is currently canned milestone text.

Redesign it as a cleaner delivery / activation roadmap:

- 30 days
- 60 days
- maybe "first wins" vs "compounding systems"

Design requirements:

- It should feel implementation-led and credible
- It should not imply every listing follows the exact same sequence
- Use flexible language:
  - `often completed first`
  - `typically live by this stage`
  - `if the property qualifies`

Avoid making this look like a fake project-management template.

---

### 7) Proof / portfolio card strip

This area currently uses hardcoded showcase cards with:

- ratings
- review counts
- badge callouts
- photos

Redesign this so it feels trustworthy even if engineering later swaps in real portfolio examples or removes specific numbers.

Design requirements:

- The card should work with:
  - exact stats
  - partial stats
  - or no stats beyond badge + photo + city / layout
- Stats should feel optional, not the whole point
- The visual priority should be:
  - listing photo
  - quality / positioning
  - a short proof cue

In other words: if the numbers change or get hidden, the design should still be strong.

---

### 8) Metrics / summary labels

This area currently has generic labels like:

- Opportunities
- Quality overall
- Accuracy
- Check-in
- Cleanliness
- Communication
- Location
- Value
- Occupancy & rates
- Conversion
- Superhost status
- Recent issues

Redesign this so the labels feel like a compact audit index or signal map.

Design requirements:

- Can be chips, rail items, compact cards, or an audit legend
- Must feel connected to the sections below
- Should work whether the items are generic labels or fully bound live signals later

---

### 9) Offer / pricing area

These values are hardcoded in the app:

- `$49.99`
- `$24.99`
- `$19.99`
- `50% off`
- `60% off`

These may be real offers, but they are still static.

Redesign so the purchase / unlock area feels premium and intentional:

- price hierarchy is clear
- urgency is tasteful
- does not feel like a cheap countdown funnel

Do not redesign the entire checkout flow.  
Just make the report-side pricing presentation stronger and less tacky.

---

## Fallback ratings note

There are still fallback category scores in code for non-live states, but the main ratings section already uses real AirROI data when available.

If you touch any fallback visual for ratings:

- it must clearly read as a placeholder / preview / unavailable state
- it must not look like real measured category output

Do not create a second fake rating-analysis design that competes with the live one.

---

## Data honesty rules

You may assume engineering can bind:

- current revenue
- current ADR
- current occupancy
- nearby comps
- booking leaks
- rating categories
- badge status

You may **not** assume engineering currently has:

- real guest complaint text
- exact renovation quotes
- a guaranteed lift per phase
- real future booking calendar pricing from AirROI
- proof-card portfolio stats tied to the subject listing

So:

- do not invent precise percentages unless they are clearly presented as modeled or example values
- do not design "AI confidence" meters or fake data provenance
- do not show charts that imply historical truth if the series is modeled

---

## States to design

Design these sections so they can gracefully handle:

1. **Live + modeled mixed reality**  
   Live current performance, modeled projections, illustrative plan details.

2. **Partial data**  
   Example: revenue + occupancy available, but not enough trust to show precise future calendar detail.

3. **Locked / teaser state where needed**  
   Especially for deeper renovation scope, execution detail, or advisor-led specifics.

4. **Mobile first readability**  
   On phone, no tiny comparison tables, no overpacked dashboards, no horizontal scroll.

---

## Suggested visual language

Helpful ideas:

- section labels like `Live audit`, `Scenario`, `Typical rollout`, `Illustrative scope`
- confidence / evidence chips
- distinction between measured values and directional upside
- dark "your current state" anchor panels beside lighter future-state cards
- elegant timeline / phased roadmap
- high-end scope cards for room refresh plan

Avoid:

- overly salesy badges everywhere
- precision theater
- giant dense tables
- making placeholder sections look more factual than the AirROI-backed ones

---

## Deliverable

Provide one coordinated `.dc.html` export for these remaining report areas.

It should include:

1. desktop + mobile layouts
2. section-level states where useful
3. clear places for engineering bindings / loops / conditionals
4. a consistent visual system for:
   - live data
   - modeled scenarios
   - illustrative examples

If you need sample labels in the mock, prefer wording like:

- `Current pace`
- `Modeled upside`
- `Typical client pattern`
- `Illustrative budget range`
- `Often addressed first`

---

## Out of scope

- redesigning the full page from scratch
- inventing new API-backed metrics
- fake review-text analysis
- fake historical charts
- guaranteed ROI claims
- new brand directions that break from the existing audit page

---

## Success test

A host should look at the redesigned report and immediately understand:

1. what the audit knows from their actual listing and comps
2. what MRG is modeling as upside
3. what parts are advisor-led planning rather than hard data

The page should feel **more premium and more honest at the same time**.
