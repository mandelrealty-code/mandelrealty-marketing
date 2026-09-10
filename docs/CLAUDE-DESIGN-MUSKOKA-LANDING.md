# Claude Design brief — Muskoka LP (redesign to match live hub / plan pages)

**Product:** Mandel Realty Group — Muskoka cottage & short-term rental management  
**URL:** `https://mandelrealtygroup.com/muskoka`  
**Audience:** Muskoka cottage owners (Bracebridge, Gravenhurst, Huntsville, Lake of Bays, Port Carling) who want hands-off hosting and stronger seasonal revenue  
**Deliverable:** One self-contained Design Canvas HTML (`.dc.html`). Desktop ~1280 + mobile ~390. HTML + CSS only. Plus Jakarta Sans via Google Fonts. IBM Plex Mono OK for step numbers / labels.

**Sister pages (match this chrome):** live `/`, `/full-service`, `/growth`, `/essentials`, `/furniture`.  
**Do not** redesign as glass-morphism lake brochure, dark estate site, or a different brand system. This is the same white SaaS MRG site, localized for Muskoka.

---

## Match the live hub system (required)

- White page `#ffffff`, ink `#222222`, muted `#717171` / `#5e5e5e`, borders `#ebebeb` / `#dddddd`, fills `#f7f7f7`
- Radii 18–26px where panels are needed, 999px pills, soft shadow `0 8px 24px rgba(0,0,0,0.05)` one layer max
- Section rhythm ~72–80px, content max ~1120px
- **Page Book CTAs:** gold `#c4a35a` (hover `#dcc084`), dark ink on gold
- **Free revenue audit CTA only (if used):** coral `#FF385C`
- Plan colour swatches when plans appear: Full Service `#2F6BFF` · Growth `#12B76A` · Essentials `#FF4716` · Furniture `#F5C518`
- Soft lake / pine atmosphere only through **real photos**, not a green/teal whole-page wash
- Clean SaaS (Linear / Stripe / Spellbook). Not purple. Not cream estate. Not dark whole-page. Not glass-morphism stacks.

### Hard bans
- No em dashes (use commas, periods, or hyphens)
- No emoji
- No speech bubbles, sticker badges, floating promo chips, cartoon mascots
- No inventing fees beyond the facts in the copy
- No revenue guarantees
- Logo is the full MRG wordmark image only (`/hub/mrg-logo.png`, ~48px). Do **not** put “Mandel Realty Group” or “Mandel / Realty Group” text beside the logo
- Do **not** rebuild seven identical feature cards. Prefer typographic lists with hairline rules (like live Full Service “What we handle”)
- Do **not** invent Muskoka-specific dashboard proof numbers. Toronto client proof is allowed once, with the disclaimer in the copy
- Furniture pairs only with Standard 20% / Full Service 25%, not Growth or Essentials

---

## Photography (already on site — use these paths)

| Path | Use |
|------|-----|
| `/muskoka/hero-lakeside.jpg` | Full-bleed hero |
| `/muskoka/great-room.jpg` | Gallery |
| `/muskoka/dock-sunset.jpg` | Gallery |
| `/muskoka/kitchen-dining.jpg` | Gallery |
| `/muskoka/primary-suite.jpg` | Gallery |
| `/muskoka/boathouse.jpg` | Gallery |
| `/muskoka/firepit-evening.jpg` | Gallery |
| `/muskoka/winter-cottage.jpg` | Gallery / seasonality |

Natural white-balance real-estate photos. No text stickers on images. No heavy colour grade over the whole hero.

---

## Nav

Sticky white header, hairline border.
- Left: MRG logo only → `/`
- Links: The reality · How it works · Plans · Proof · FAQ (in-page anchors)
- Right: phone `(647) 381-7325` + gold Book a call → `/book-a-call`
- Optional small text link “All plans” → `/#plans`

---

## Visual language for THIS page

Muskoka is the **place** LP inside the same system. Feel specific through photography + typographic structure, not a second brand.

**Do use:**
1. Full-bleed lakeside hero photo + white/left copy column OR stacked mobile (same pattern as plan LPs)
2. Cottage-country reality as a **numbered typographic list** (not 5 identical pain cards)
3. How it works as a **horizontal or stacked step chain** with mono `STEP 01` labels and hairlines
4. Capability strip as a simple text/list row under the chain (no icon soup)
5. **Seasonal operating map** (replaces any “cottages we run” gallery) — typographic year board, not property photos we claim to manage
6. Four plan teaser tiles with **bold colour swatches** linking to `/full-service`, `/growth`, `/essentials`, `/furniture` (Spellbook-style: colour on swatch/edge only; don’t paint whole cards)
7. Proof band ready for engineering chart mount: empty `#mrg-mu-proof-chart` white band is fine; show the Toronto numbers once in copy
8. Owner quotes as typographic blocks, not testimonial card soup
9. FAQ as native `<details>` / accordion
10. Final dark conversion band `#222222` + gold Book + phone / email / WhatsApp

**Do not use:** glass frost panels, pine-needle textures as UI chrome, cartoon docks, floating “+40%” stickers on photos, purple gradients, 3D icons.  
**Do not** show a gallery of Muskoka cottages captioned as properties MRG runs. We do not have Muskoka inventory live yet.

Keep graphics sparse. White space wins.

---

## Sections + exact copy (use this wording; fix only em dashes if any appear)

### Hero
**Eyebrow:** Muskoka cottage & short-term rental management  
**Headline:** Cottages managed like a business — without you living in the inbox.  
**Subhead:** Dynamic pricing, turnovers and 5-star guest ops for lake country — so summer weekends, shoulder Saturdays and winter stays all actually pay.  
**CTAs:** Book a free 15-minute call · Call (647) 381-7325  
**Support:** Serving Bracebridge · Gravenhurst · Huntsville · Lake of Bays · Port Carling  
**Support 2:** Toronto-based · Canada + US portfolios  
**Visual:** `/muskoka/hero-lakeside.jpg`

### 01 — Cottage country reality
**Eyebrow:** 01 — Cottage country reality  
**Headline:** The lake is the easy part.  
**Intro:** Muskoka rents at some of the highest nightly rates in Ontario — and asks the most in return. High season is eleven weeks long, the shoulders are unforgiving, and every one of them runs through your phone.

Typographic list (not cards):
1. **Midnight messages during your own week at the lake** — The hot tub, the gate code, the boat lift. Guests expect an answer in minutes, and Airbnb scores you on it.
2. **Back-to-back Saturday turnovers on lake roads** — Same-day check-out and check-in, forty minutes from town, with a cleaner who has three other cottages that morning.
3. **Soft mid-weeks while the neighbours are full** — June and September carry real demand in Muskoka — but only if the calendar and the rate move to meet it.
4. **Set-and-forget pricing through the weekends that matter** — Victoria Day, Canada Day, Civic, Thanksgiving, ski weeks — flat rates leave thousands on the table every season.
5. **A listing that still looks like 2016 pine and plaid** — Two bays over, glass-and-cedar photography is taking the summer bookings — and the summer rate.

### 02 — How MRG works
**Eyebrow:** 02 — How MRG works  
**Headline:** One chain, run properly, every week of the year.  
**Intro:** Nothing exotic. Systems produce a better stay, better stays produce reviews, reviews buy visibility, visibility fills the calendar — and a full calendar priced correctly is the money.

Steps:
1. **Systems** — Pricing rules, turnover schedule, restock lists, screening and a single calendar of record.
2. **Guest experience** — Answered in minutes, arrival that works after an eight-hour drive, a cottage that photographs like it lives.
3. **Reviews** — Review requests timed and worded, issues intercepted before they become a four-star.
4. **Visibility** — Rating and response feed placement. Your listing surfaces for "Muskoka lakefront" searches, not page four.
5. **Bookings** — Long weekends sold early at the right rate; mid-weeks and shoulders filled instead of discounted late.
6. **Money** — One monthly report: revenue, occupancy, ADR, review trend, and what we are changing next month.

Capability strip (plain text / compact list, not icon grid):
Dynamic daily pricing · Listing + photo optimization · 24/7 guest communication · Cleaning & turnover coordination · Inventory & restock · Review & reputation · Monthly performance reporting · Guest ID & screening · Furniture makeover (Standard / Full Service) · Growth Partnership for hosts with history

### 03 — Muskoka season (REWRITE THIS SECTION — do not use a “cottages we run” gallery)

**Why:** MRG does not have live Muskoka cottages on the books yet. Do **not** show property photos as inventory we manage. Do **not** use captions like “Great room · Lake of Bays · Sleeps 10” as if they were our listings.

**Replace the old “What guests book” gallery with a seasonal operating map.**

**Eyebrow:** 03 — Muskoka season  
**Headline:** Eleven weeks of peak. The rest of the year still has to work.  
**Intro:** Muskoka is not a flat calendar. The weekends that matter, the soft mid-weeks, and the winter weeks each need a different rate and a different turnover plan.

**Layout:** Typographic board / timeline with hairline rules (not photo cards). Mono labels OK. Keep the gold bar metaphors if already designed (full / half / dashed / mid-winter), but **shorten each body to one sentence**.

Rows:
- **Victoria Day → Labour Day · Peak** — Eleven weeks carry the year. Rates set early, minimum stays enforced, Saturday turnovers booked before the season starts.
- **June & September · Shoulder mid-weeks** — Real demand if you market them as their own product, not leftover discounts.
- **Civic · Canada Day · Thanksgiving · Long weekends** — Open early at holiday rates. Book turnover crews first. (Vary this row slightly: three weekend chips instead of the same title/body/bar stack if the other rows already use that pattern.)
- **December → March · Ski and ice season** — Winter stays book when heat, water lines, plowing and response times are on the operating calendar.

**Closing line (keep visible):** Lakeside photography elsewhere on this page is place atmosphere, not a portfolio we manage.

Reuse existing `/muskoka/*.jpg` only as optional quiet background / section atmosphere if needed — never as “a listing we run.”

### 03b — Coverage and fit (ADD THIS SECTION)

**Eyebrow:** Coverage and fit  
**Headline:** Built for lake country. Honest about what we need from you.  
**Intro:** We cover Bracebridge, Gravenhurst, Huntsville, Lake of Bays, Port Carling and surrounding lakes. Toronto-based operators, local cleaners and lake-road logistics.

**Fit checklist** (typographic list, not cards):
1. Livable cottage — furnishing is not a renovation
2. STR allowed — permit or licensing where the township requires it
3. Photo-ready, or open to Furniture Investment with Standard 20% / Full Service 25%
4. Willing to grant the platform access the plan needs
5. Open to a 15-minute fit call

**CTA:** Check fit for my cottage → `/book-a-call`

### 04 — What we offer
**Eyebrow:** 04 — What we offer  
**Headline:** Four ways to work with us.  
**Intro:** Pick the one that matches how much you want to keep. All fees are on gross booking revenue — nightly plus upsells, excluding cleaning and pass-throughs. HST applies to fees.

Four plan teasers (link out) with **bold colour swatches only** (Spellbook-style — do not paint whole cards):
- **Full Service / Standard** `#2F6BFF` — 20% – 25% of revenue → `/full-service`
- **Growth Partnership** `#12B76A` — Performance-tied · history required → `/growth`
- **Managed Essentials** `#FF4716` — $199 or $349 / month → `/essentials`
- **Furniture Investment** `#F5C518` — Pairs with Standard / Full Service only → `/furniture`

**Note:** Not sure which fits? The 15-minute call ends with a recommendation, not a pitch.

### 05 — Proof of systems
**Eyebrow:** 05 — Proof of systems  
**Headline:** Same unit. Same building. Different operator.  
**Intro:** A Toronto client came to us after a full year of self-managing. We kept the property and changed the operating system: pricing, photography, listing copy, response times, review flow.

Numbers (once):
- Full year 2025 · before MRG — **$26,995**
- May–Aug 2026 · with MRG — **$33,713**
- Four months beat the entire previous year — +159% against the same months a year earlier.

**Disclaimer (required, visible):** Verified Airbnb host dashboard · Toronto client. Same playbook we would bring to a Muskoka cottage. We do not publish Muskoka dashboards we have not earned yet.

Include empty mount: `<div id="mrg-mu-proof-chart"></div>` for engineering.

### 06 — Owners (CHANGE)

**Remove** Muskoka-named fake testimonials (Lake Muskoka, Lake of Bays, Gravenhurst, Huntsville cottage-owner quotes) unless they are real verified owners.

**Replace with one of:**
- Skip the section entirely, **or**
- A short “Who this is for / not for” two-column typographic block (cottage owners who want systems + local cleaners; not owners who want a franchise call centre or a guaranteed ADR).

Do not invent cottage-owner quotes.

### 07 — Boutique capacity (KEEP, place near CTA)
**Eyebrow:** 07 — Boutique capacity  
**Headline:** We partner with about twenty listings at a time.  
**Body:** Not a franchise, not a call centre. Twenty is the number where every owner still gets a named operator, a weekly eye on their calendar and a real conversation each month. A small number of Muskoka spots open ahead of next season — when they are taken, the list is closed until one frees up.  
**CTA:** Check fit for my cottage → `/book-a-call`

### 08 — Questions (FAQ)
**Eyebrow:** 08 — Questions  
**Headline:** Before you book the call.  
**Intro:** Anything not answered here, ask on the call — or text it to 647-381-7325.

FAQ items:
1. **What does it cost — percentage or fixed?** Both exist. Full Service / Standard management runs 20–25% of gross booking revenue — you pay only when the cottage earns. Managed Essentials is fixed at $199 or $349 a month and you keep cleaning and on-site work. Growth Partnership ties our fee to growth above a benchmark. HST applies to fees on every plan.
2. **Are you actually in Muskoka, or managing from Toronto?** Toronto-based operators with a Muskoka focus. Local cleaners and lake-road logistics. We do not claim a Muskoka storefront we do not have.
3. **My cottage has never been rented. Can you still take it?** Yes via Full Service / Standard or Essentials depending on scope. Growth needs live history. Furniture may pair with 20%/25% if approved.
4. **How fast can we onboard?** An existing listing can move in days. A new launch depends on photography and makeover scope; we give a dated plan on the call rather than a promise here.
5. **Do you cover Bracebridge, Gravenhurst, Huntsville, Port Carling?** Yes, and surrounding lakes including Lake of Bays.
6. **Who pays cleaning, maintenance, insurance and taxes?** Cleaning/pass-throughs and property expenses sit outside management fees as described on the plan pages. Owner remains responsible for insurance and taxes.
7. **Can I get the furniture makeover on any plan?** No. Furniture Investment pairs with Standard (~20%) or Full Service (~25%) only — not Growth or Essentials.
8. **Do you already manage cottages in Muskoka?** Not yet on the books. This page is the offer and the operating plan. Lakeside photos are place atmosphere, not our current portfolio.

Use native accordion / `<details>`.

### 09 — Final conversion
**Eyebrow:** 09 — Free 15-minute call  
**Headline:** Fifteen minutes, a real number, no pitch deck.  
**Body:** Tell us the lake, the bedrooms and roughly what it earns now. We come back with what we would change first, which plan fits, and what the season could realistically look like.  
**Contacts:** 647-381-7325 · info@mandelrealtygroup.com · Prefer WhatsApp? Text the same number for an estimate.  
**Primary CTA:** gold Book a free 15-minute call → `/book-a-call`  
Do **not** rebuild the full calendar booking widget in Design Canvas. Link to `/book-a-call`.

### Footer
Logo only (no duplicate wordmark text). Muskoka cottage & short-term rental management. Toronto-based · portfolios across Canada and the US. Contact phone + email. Links: Plans (`/#plans`), FAQ (`#faq`), Book a call, Privacy, main site `/`. No “Airbnb makeover” footer link. © 2026 Mandel Realty Group. Fees quoted exclude HST. No revenue guarantees. Bracebridge · Gravenhurst · Huntsville · Lake of Bays · Port Carling

---

## Business facts checklist
- Contact: (647) 381-7325 · info@mandelrealtygroup.com · WhatsApp `https://wa.me/16473817325`
- Full Service / Standard: 20%–25% of gross
- Growth: history required; Aligned 10%/35% · Confidence 5%/45% (link `/growth` for detail)
- Essentials: $199 / $349 + HST
- Furniture: pairs with 20%/25% only
- Boutique ~20 listings
- Platforms: Airbnb, Expedia, Booking.com
- Never invent Muskoka earnings guarantees
- Never claim live Muskoka inventory you do not have

---

## Tone
Premium, clear, Muskoka-fluent. Lead with lake logistics and seasonal weekends. Always push the 15-minute call. Never promise revenue.

Ship 2–3 light motions max. Mobile optimized. Export `.dc.html` when done.
