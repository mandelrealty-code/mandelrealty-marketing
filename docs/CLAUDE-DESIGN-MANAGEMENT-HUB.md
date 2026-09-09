# Claude Design brief — MRG management hub (homepage) v2

**Product:** Mandel Realty Group — main marketing homepage  
**URL:** `https://mandelrealtygroup.com/` (new site; current homepage moves to `/makeover`)  
**Audience:** Property owners who want someone else to run their short-term rental (live listing or launching)  
**Deliverable:** One self-contained Design Canvas HTML file (`.dc.html`). Desktop ~1280 + mobile ~390. HTML + CSS only. Logo + fonts inlined or Google Fonts linked. No React.

**Your job:** Redesign the homepage as a **clean, bold SaaS marketing site** (Linear / Stripe clarity + MRG gold energy). Merge the **proven copy and sections from the live first homepage** with the **new 4-plan product architecture**. White canvas, bubbly radii, Plus Jakarta Sans. Not calm pastel navy. Not a luxury-estate brochure. Not purple gradients.

---

## What was wrong with v1 (fix these)

- Colours too calm / navy-washed. **Main page accent is gold**, not navy.
- Missing large pieces from the live site: platform logos, “What we handle,” Guest Favourite proof cards, “Virtual ≠ Distant,” fit yes/no lists, FAQ, WhatsApp + Call CTAs.
- Plan colours must read **bold** on tiles and in the Plans dropdown (solid accents, not 5% pastel washes).

---

## Visual system

### Type (same as Revenue Audit)
- **Plus Jakarta Sans** 400–800  
- Fallback: Helvetica Neue / Helvetica / Arial  
- Headings: **800**, tracking **-0.03em to -0.04em**  
- Body: **500–600**  
- Labels: **800**, uppercase, **~11.5px**, tracking **0.06em**  
- Never Inter / Roboto / system-ui as primary

### Base chrome (Revenue Audit)
- Page `#ffffff` · ink `#222222` · muted `#717171` / `#5e5e5e`  
- Borders `#ebebeb` / `#dddddd` · fills `#f7f7f7`  
- Radii **18–26px** panels · **999px** pills  
- Shadow: `0 8px 24px rgba(0,0,0,0.05)` one layer  
- Section rhythm **72–80px** · content max **~1120px**

### Hub accent = GOLD (primary)
| Token | Hex | Use |
|-------|-----|-----|
| Gold | `#c4a35a` | Primary CTAs, key underlines, “Book a call” pills, highlight numbers, section accents |
| Gold hot | `#dcc084` | Hover |
| Gold deep | `#9a7a3a` | Pressed / emphasis text on white |
| Ink dark CTA alt | `#222222` | Secondary solid buttons if needed |

### Plan colours (BOLD, for Plans dropdown + plan tiles only)
Use **solid left bars, bold swatches, and strong tint fills (12–20%)**, not whisper pastels.

| Plan | Accent (bold) |
|------|----------------|
| Full Service | `#1A365D` navy (kept as plan ID; do **not** make the whole page navy) |
| Growth | `#0D9488` hot teal |
| Essentials | `#0F172A` near-black slate |
| Furniture | `#D97706` hot amber |
| Revenue audit only | `#FF385C` coral (+ hover `#e00b41`; fills `#fff0f3` / `#ffd3dd`) |

### Bubbly SaaS — allowed vs banned
**Do:** soft rounded panels, pill CTAs, hairline borders, bold gold CTAs, bold coloured plan tiles, simple geometric icons.

**Hard bans:**
- Speech / chat **bubbles with marketing copy**
- Floating sticker badges or “AI” chips on the hero
- **Em dashes** (`—`) in any UI copy (rewrite with periods or commas)
- **Emoji** in the UI (replace with simple icons or nothing)
- Purple gradients, cream+terracotta estate look, neon glow stacks
- Card soup (cards only for interactive tiles, FAQ, forms)
- Stats / plan grid / FAQ inside the **first viewport**

---

## Navigation + platform logos (required)

### Nav
White bar, hairline bottom border.

- Left: MRG logo + wordmark  
- Links: How it works · What we handle · Plans (dropdown) · Proof · FAQ  
- **Plans dropdown:** each row = **bold colour swatch** + plan name + one-line fee tease → `/full-service`, `/growth`, `/essentials`, `/furniture`  
- Right: `(647) 381-7325` outline pill + **gold** Book a call pill → `/book-a-call`

### Platform logo strip (required)
**Immediately below the nav** (or integrated as a slim bar under the header), a quiet trust strip:

**Airbnb · Expedia · Booking.com**

- Use **official Airbnb and Booking.com marks** (factual “where we list,” not endorsement). Add a one-line legal note in tiny muted type under or beside the strip:  
  `Airbnb and Booking.com marks are their official logos, used to show where we list. Not an endorsement.`
- **Expedia:** official logo mark if available; otherwise clean wordmark placeholder labeled for swap.
- Optional fourth: VRBO (MRG also lists there). If space is tight, prioritize the three the client asked for: Airbnb, Expedia, Booking.com.
- Grayscale or low-contrast on white is fine; keep logos legible. No fake “as seen in” newspaper collage.

---

## Brand + hero

- **Brand first:** Mandel Realty Group is a hero-level signal.  
- **Eyebrow OK:** `SHORT-TERM RENTAL MANAGEMENT` (uppercase label style).  
- **Headline energy (from live site, tightened):**  
  **More Money. More Freedom. Zero Stress.**  
- **Support:** We run your short-term rental on Airbnb, Expedia, and Booking.com with proven systems that drive better reviews, more visibility, and more revenue. Serving hosts across Toronto and Muskoka.  
- **CTA group:**  
  1. Gold primary: Book a free 15-minute call → `/book-a-call`  
  2. Outline or WhatsApp: Chat on WhatsApp (use real WhatsApp link to `(647) 381-7325` / MRG WhatsApp if known)  
  3. Coral secondary text/button: Free revenue audit → `/revenueaudit/`  
- Microcopy: Quick chat to see if you are a fit. No obligation, no pressure.  
- **Visual:** full-bleed or edge-to-edge STR photography. No overlays, badges, or bubbles on the media.  
- Hero budget: brand + eyebrow + headline + one support + CTA group + one dominant visual. Platform logos live in the strip under nav, **not** as clutter inside the hero text block.

---

## Page sections (order — merge live site + new plans)

White page; alternate `#f7f7f7` bands where helpful. One job per section.

### 1) Social proof nudge (optional thin band)
Short line: Top-performing hosts use structured systems to protect reviews and maximize revenue. Self-managed listings fall further behind every season.  
Then the **big proof numbers** (can sit here or in section 5; do not duplicate twice):

- `$26,995` All of 2025 → `$33,713` May–Aug 2026 alone · `+159%`  
- Caption: Real client result. Individual results vary by property, market, and season. (Toronto client; same playbook.)

Prefer **one** strong proof placement (either early band **or** with Guest Favourite cards), not two competing proof walls.

### 2) How it works
Label: HOW IT WORKS  
Headline: A simple chain that turns your property into a real business.  
Chain (icons, no emoji): Proven Systems → Better Guest Experience → Better Reviews → Higher Visibility → More Bookings → More Money  
CTA: Message us to see what we would improve first (WhatsApp or book call).

### 3) What we handle (from live site — was missing in v1)
Label: WHAT WE HANDLE  
Headline: Everything that steals your time and energy. Handled.  
Grid of services (icon + title + one sentence each):

1. Dynamic Pricing  
2. Guest Communication  
3. Cleaning Coordination  
4. Maintenance Management  
5. Supplies & Restocking  
6. Listing Optimization & SEO  
7. Multi-Channel Distribution (Airbnb, Expedia, Booking.com, calendar sync)

Footer chip of section: Monthly performance reports included.

### 4) Four plans (NEW — SaaS product pillars)
Label: PLANS  
Headline: Four ways to work with MRG.  
2×2 grid (stack mobile). Each tile: **bold plan colour** bar/wash + name + who it’s for + fee tease + “Explore” link.

- **Full Service** `#1A365D` → `/full-service` · Standard 20% or Full Service 25%  
- **Growth Partnership** `#0D9488` → `/growth` · 10%/35% or 5%/45% (live listing + history)  
- **Managed Essentials** `#0F172A` → `/essentials` · $199 or $349 / mo  
- **Furniture Investment** `#D97706` → `/furniture` · $0 upfront furnish (with 20%/25% only)

Tease only. No full contracts.

### 5) Revenue audit band
Coral `#FF385C` button / soft pink wash. Free market or listing audit → `/revenueaudit/`. Short copy only.

### 6) Proof: listings at a higher standard
Label: PROOF  
Headline: Listings operating at a higher standard.  
Support: Guest Favourite status is engineered through systems and continuous optimization.  

Three listing cards (placeholders OK until real photos):

1. Chic & Spacious 2BR · King St W, Toronto · 5.0 · 23 reviews · Guest Favourite  
2. Modern 1+Den Condo · King St W, Toronto · 4.93 · 54 reviews · Guest Favourite  
3. Lakeside Retreat, 3BR · Muskoka, ON · 5.0 · 14 reviews · Guest Favourite  

Note: Placeholder photos. Swap real listing images before launch. Street numbers omitted for host privacy.  
If revenue numbers were not shown earlier, include the $26,995 → $33,713 / +159% block here once.

### 7) Objection: Virtual ≠ Distant (from live site)
Label: OBJECTION HANDLED  
Headline: Virtual is not distant.  
Support: How can you manage my property from far away? Here is why virtual works better than guesswork local management.

Four points:
1. Structured Systems, Not Guesswork (SOPs, checklists, photo/video verification)  
2. Local Boots on the Ground (vetted cleaners/providers in Toronto and Muskoka)  
3. Photo Verification (every turnover documented)  
4. 24/7 Monitoring (messages, pricing, calendar sync)

### 8) Who this works best for
Two columns:

**Perfect for hosts who:**
- Want the property run like a real business  
- Want higher long-term revenue, not short-term guesswork  
- Want systems protecting reviews and bookings  

**Not ideal for hosts who:**
- Want to keep handling guest messaging themselves  
- Prefer manual pricing over market-driven optimization  
- Expect strong results without maintaining property standards  

CTA: Book a free fit call (gold).

### 9) FAQ
Accordion (interactive cards OK):

1. What areas do you serve? → Toronto and Muskoka region; virtual-first systems that work across Ontario.  
2. Do you only manage Airbnb, or other platforms too? → Airbnb, Expedia, Booking.com (and VRBO where relevant), calendar-synced.  
3. How does virtual management actually work? → Systems + local partners + photo verification (point to objection section).  
4. Do I need to approve things or will you just take action? → Clear authority levels set on onboarding; emergencies protected.  
5. How do you optimize my pricing? → Dynamic pricing against live market data.  
6. What’s the next step? → Free 15-minute call or free revenue audit.  
7. What do plans cost? → Tease 20%/25%, Growth tiers, Essentials $199/$349; details on plan pages / call. Do not invent other fees.

### 10) Final conversion
Dark `#222222` panel (gold CTAs on dark):  
Ready for more money and more freedom?  
Quick conversation. No pressure. We will say straight if we believe we can outperform your current setup.  

Buttons: Chat on WhatsApp · Call Now · Book a call (gold) · Free revenue audit (coral text)

### 11) Footer
Mandel Realty Group · Virtual short-term rental management · Toronto & Muskoka  
Explore: Locations (/muskoka), Privacy, Makeover (`/makeover`)  
Services: Airbnb / Expedia / Booking.com management, STR investment acquisition, Free revenue audit, Get started  
Phone (647) 381-7325 · About  
© 2026 Mandel Realty Group. All rights reserved.

Ship **2–3 motions** only (fade-up, dropdown, hover).

---

## Business facts (fees — do not invent)

**Contact:** (647) 381-7325 · info@mandelrealtygroup.com  

**Full Service** (`/full-service`): Standard **20%** or Full Service **25%** of gross (nightly + upsells; excludes cleaning/pass-throughs; HST extra). Furniture can pair.  

**Growth** (`/growth`): Live listing + history. Aligned **10%/35%** · Confidence **5%/45%**. No furniture.  

**Essentials** (`/essentials`): **$199** Message & Book · **$349** Message & Optimize + HST. Owner keeps cleaning/ops. Klarna 12-mo ~5% off optional (no refunds).  

**Furniture** (`/furniture`): $0 upfront if approved; pairs only with 20%/25%; 24-month free transfer; livable + permit where required. Never say “you’re approved.”  

Onboarding fee: typical, customizable on the call. Never invent a dollar amount. Never guarantee revenue.

---

## Copy constraints
- No em dashes. No emoji. No AI bubbles. No revenue guarantees.  
- Closer tone, short sentences, concrete fees.  
- Platform logos = factual listing channels, not endorsements (include the legal note).

---

## Deliverable checklist
- [ ] White SaaS canvas, Plus Jakarta Sans, **gold primary CTAs**
- [ ] Platform logo strip: Airbnb, Expedia, Booking.com (+ legal note)
- [ ] Plans dropdown with **bold** coloured swatches
- [ ] Hero: More Money. More Freedom. Zero Stress. + WhatsApp / Call / Audit
- [ ] How it works chain
- [ ] What we handle (7 services)
- [ ] Four bold plan tiles with real fee teasers
- [ ] Coral revenue audit band
- [ ] Guest Favourite proof cards + revenue proof numbers once
- [ ] Virtual ≠ Distant objection block
- [ ] Perfect for / Not ideal columns
- [ ] FAQ accordion
- [ ] Final dark conversion + footer
- [ ] Desktop + mobile; no banned marks

Export `.dc.html` for engineering to implement at `mandelrealtygroup.com/`.
