# Claude Design brief — Book a free call (`/book-a-call`)

**Product:** Mandel Realty Group — shared booking / estimate funnel  
**URL:** `https://mandelrealtygroup.com/book-a-call` (also `/get-estimate`)  
**Audience:** Owners coming from the hub, plan LPs, Fit Check, ads, or revenue audit who want a free 15-minute call  
**Deliverable:** One self-contained Design Canvas HTML file (`.dc.html`). Desktop ~1280 + mobile ~390. HTML + CSS only. Plus Jakarta Sans via Google Fonts. No React.

**Your job:** Redesign `/book-a-call` so it feels like the **rest of the marketing site** (white SaaS canvas, gold CTAs, hub chrome). Keep the **multi-step Instant Form–style funnel** (plan → listing → details → book). Replace the current dark “ads lander” look entirely.

**Sister pages to match:** live `/` hub, `/full-service`, `/growth`, `/essentials`, `/furniture`. Same type, radii, borders, logo treatment, gold Book pills.

---

## What is wrong with the live page today (fix these)

- Whole page is **dark mode** (`mrg-bg` / charcoal). The rest of the site is **white**.
- Feels like a separate ads tool, not Mandel Realty Group marketing.
- Plan interest was missing; engineering now collects it. The redesign must **feature the plan picker** as step 1 (with colour swatches).
- Do **not** keep the dark radial gold glow background as the page identity.

---

## Match the live hub system

- White page `#ffffff`, ink `#222222`, muted `#717171` / `#5e5e5e`, borders `#ebebeb` / `#dddddd`, fills `#f7f7f7`
- Radii **18–26px** panels, **999px** pills, soft shadow `0 8px 24px rgba(0,0,0,0.05)`
- Section rhythm calm; content max **~1120px**
- Type: **Plus Jakarta Sans** 400–800. Headings 800, tracking **-0.03em to -0.04em**. Labels uppercase ~11.5px, tracking 0.06em
- **Primary CTAs / progress accent:** gold `#c4a35a` (hover `#dcc084`, deep `#9a7a3a`)
- Clean SaaS (Linear / Stripe / Spellbook). Not purple. Not cream estate. Not dark whole-page.

### Plan accents (for picker swatches only)
Use the **same bold accents as the live plan LPs**:

| Plan | Accent | Blurb (one line) |
|------|--------|------------------|
| Full Service | `#2F6BFF` | Hands-off ops · 20% or 25% |
| Growth Partnership | `#12B76A` | Live hosts · lower fee + upside |
| Managed Essentials | `#FF4716` | Listing + pricing · fixed monthly |
| Furniture Investment | `#F5C518` | $0 upfront furnish if approved |
| Not sure yet | `#8a8a8a` | Help me pick on the call |

Solid **left colour bars** (like the Plans dropdown), not pastel washes. Selected row: light gold tint + gold ring, or soft fill of the plan accent at ~8–12%.

### Hard bans
- No em dashes (`—`). Use periods or commas.
- No emoji
- No speech bubbles, sticker badges, floating promo chips, “AI” labels
- No inventing fees, revenue guarantees, or “you’re approved”
- Logo is the full MRG wordmark image only. Do **not** put “Mandel Realty Group” text next to the logo
- No card soup: one form panel is enough. Trust content beside it can be quiet panels, not stacked marketing cards
- Do not put stats grids, FAQ, or plan comparison tables in the **first viewport**

---

## Page job (product)

This page is a **booking funnel**, not a long marketing landing page.

**Outcomes:**
1. Capture which plan they care about (or “Not sure”)
2. Qualify listing status (live vs not yet)
3. Collect enough detail for a useful call
4. Book a 15-minute call (name, phone, email, consent, time slot)

**Deep links:** Plan LPs already send `?plan=full-service|growth|essentials|furniture`. When `plan` is present, **preselect that plan** and skip ahead to the listing question (show a small “Full Service · change” chip so they can go back).

---

## Layout (required composition)

### Desktop (~1280)
Two columns inside ~1120 content:

**Left (~0.9fr) — trust / brand (not the form)**
- Quiet eyebrow: `FREE 15-MINUTE CALL` in gold or muted uppercase
- Headline (one line energy): `Book a call. We’ll show you the fit.`
- Support: Short. Toronto-based. Canada and the U.S. No pressure.
- Optional proof block: one earnings comparison graphic **or** one short testimonial (real quote only if provided; otherwise typographic placeholder labeled for swap). Keep sparse.
- Contact line: phone `(647) 381-7325` · WhatsApp · email optional

**Right (~1.1fr) — sticky form panel**
- White / `#f7f7f7` elevated panel, hairline border, soft shadow, bubbly radius
- Header strip inside panel: MRG logo + “Free 15-minute call”
- Step progress: 4 segments + labels **Plan · Listing · Details · Book**
- Active step gold; upcoming muted

### Mobile (~390)
- Short brand block first (headline + one support line)
- Form panel full width below
- Sticky bottom primary Continue / Book only if it does not fight the keyboard; prefer in-panel buttons

### Nav (site chrome)
Sticky white header, hairline bottom.
- Left: MRG logo only (`/hub/mrg-logo.png`, ~40–48px) → `/`
- Optional quiet links: Plans → `/#plans`, Revenue audit → `/revenueaudit/`
- Right: phone outline pill `(647) 381-7325` + gold “Book a call” (current page, can be muted / current state)

---

## Funnel steps (design all four states)

Show each state as a clear screen inside the form panel. Include Back where noted. One job per step.

### Step 1 — Plan
**Headline:** `What are you interested in?`  
**Support:** `Pick a plan so we prep the right conversation, or choose not sure.`  
**UI:** Vertical list of 5 selectable rows:
- Colour bar + plan name + one-line blurb (table above)
- Tap advances to Step 2
- “Not sure yet” is a first-class option, same row style, muted bar

### Step 2 — Listing
**Chip (if plan selected):** e.g. blue dot + `Full Service · change` → returns to Step 1  
**Headline:** `Do you have an Airbnb listing live right now?`  
**Two large choices:**
- `Yes — it’s live` / Has a listing  
- `No — not yet` / Starting out  

### Step 3a — Details (listing = yes)
**Headline:** `Tell us about the listing`  
**Support:** `So MRG can look it up before the call. No link needed.`  
**Fields:**
- Airbnb listing title  
- Property address (street, city)  
- Soft earnings selector / ranges (keep calm; no dark wheel chrome). Labels like `$0–$2.5k`, `$2.5k–$5k`, etc. if you design chips  
**Actions:** Back · Continue (disabled until title + address)

### Step 3b — Details (listing = no)
**Headline:** `A few quick questions`  
**Support:** `Helps MRG know if we’re the right fit before the call.`  
**Question groups (stacked, one selected per group):**
1. Where are you in the process? (property stage options)  
2. Does your building or area allow Airbnb?  
3. STR permit status  
4. Property address  
**Actions:** Back · Continue (all required)

### Step 4 — Book
**Headline:** `Lock in your call`  
**Support:** Mention selected plan when known (`We’ll focus on Full Service.`) plus listing context.  
**Fields:**
- Name, phone, email  
- Call time picker (calendar / slot list UI placeholder OK; engineering wires real slots)  
- Consent checkbox: we can contact them about the estimate / call (required)  
**Primary CTA:** gold pill `Book my free call`  
**Back** to details  

Success is out of scope for this canvas (live site goes to `/thank-you`). Optionally show a quiet “confirmation” mock as a fifth frame labeled engineering handoff.

---

## Microcopy rules
- Closer tone, short sentences, concrete.
- No em dashes. No emoji.
- Never invent fee numbers beyond the plan blurbs already listed.
- Never promise a specific revenue lift on this page.
- Phone display: `(647) 381-7325`

---

## Motions (2–3 only)
1. Fade / slight rise when step content swaps  
2. Progress bar fill to gold  
3. Soft hover on plan rows and choice tiles  

No confetti, no bounce spam, no dark-mode glow.

---

## Assets / placeholders
- Logo: `/hub/mrg-logo.png` (dark logo on white)
- Optional left-rail proof image: earnings chart or guest interior (label `proof-swap` if placeholder)
- Do not invent Airbnb dashboard screenshots that look fake-official

---

## Deliverable checklist
- [ ] White SaaS canvas matching hub / plan LPs (not dark)
- [ ] Plus Jakarta Sans, gold primary CTAs, hairline borders, bubbly radii
- [ ] Sticky white nav with logo only + phone + gold affordance
- [ ] Two-column desktop: trust left, sticky form right; stacked mobile
- [ ] Four-step progress: Plan · Listing · Details · Book
- [ ] Plan picker with bold colour bars for all five options including Not sure
- [ ] Preselected-plan chip + change path designed
- [ ] Yes / No listing branches designed
- [ ] Book step with consent + time picker placeholder
- [ ] No em dashes, no emoji, no sticker badges
- [ ] Desktop ~1280 and mobile ~390 frames

---

## Engineering handoff notes (for Claude Design, do not implement)
Live app already posts: `interestedPlan`, listing fields, call slot, consent. Visual redesign should keep the same step order so porting stays 1:1. Deep link: `/book-a-call?plan=full-service` (etc.).
