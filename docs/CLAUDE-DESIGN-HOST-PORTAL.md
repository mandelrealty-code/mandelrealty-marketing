# Claude Design brief — Host Portal (MRG): Login + Dashboard only

**Product:** Mandel Realty Group — **client-facing host portal** (separate from admin CRM / Clients mode)  
**Audience:** Managed hosts / property owners logging in to see their unit(s) and ask MRG questions  
**Your job:** Design **exactly 2 screens** (plus mobile variants of each). Do **not** design Settings, multi-property switcher deep flows, or PDF reports.

1. **Login / welcome** (before auth)
2. **Host dashboard** (after auth) with **Ask MRG** chat

---

## Brand (exact — match admin)

| Token | Hex |
|--------|-----|
| Background | `#0a0a0a` / `#0c0c0c` |
| Surface | `#141414` / `#1c1c1c` |
| Text | `#f5f5f5` |
| Muted | `#9a9590` / `#6f6a65` |
| Gold | `#c4a35a` |
| Gold light | `#dcc084` |
| Positive | `#4ea882` |
| Danger (rare) | `#cf7f7b` |
| Hairlines | `rgba(255,255,255,0.08–0.10)` |

- Font: **Manrope** 400/500/600/700
- Logo: MRG mark / wordmark (white or gold)
- Avoid: purple SaaS, cream paper, Inter, card soup, emoji, neon glow, floating badge clutter, generic “AI chatbot widget” blobs

**Tone:** Warm private portal for owners — premium STR management, not a consumer Airbnb clone and not an ops admin console.

---

## Mock photography (required — generate in the mockup)

Create **high-quality mock listing photos** for the unit — not gray placeholders, watermarks, or abstract gradients.

**Subject:** Modern residential STRs that look excellent:

- Contemporary condo living rooms with city light
- Bright apartment kitchens / open-plan suites
- Stylish townhouse or house exteriors (evening or soft daylight)
- Bedroom / balcony moments that sell the stay

**Look:** Editorial real-estate photography — sharp, warm-neutral, staged but inviting, wide angle, natural light or soft dusk. Must read richly on dark `#0a0a0a` UI.

**Placement:**

- **Login:** full-bleed / dominant hero of this unit
- **Dashboard:** same unit (banner / strong header) for continuity

**Sample:** “Maple Suite · Toronto” — modern condo interior primary; optional second angle (balcony / exterior) if useful.

**Avoid:** clipart, plastic AI interiors, purple lighting, clutter, text overlays on photos, floating badges on the hero.

---

## Hard design rules

- **Brand first on login.** Unit photo is a full-bleed or dominant visual plane. Brand + welcome must read as one composition.
- **One job per screen.** Login = get in. Dashboard = understand my unit + ask questions.
- **No card soup.** Prefer editorial layout, hairlines, one elevated chat surface.
- **No hero overlays** on the login photo (no floating chips/badges on the image).
- Desktop **~1280** and mobile **390** for both screens.

---

## Screen 1 — Login / welcome

**Job:** Make the host feel “this is *my* property” before they type a password.

**Must include:**

- Dominant **mock photo of their unit** (hero — edge-to-edge; not a tiny inset card)
- Quiet MRG mark
- **Welcome back, {First name}** (sample: “Welcome back, Khamraj”)
- One short supporting line (e.g. “Your Mandel Realty owner portal”)
- **Email / username** + **Password**
- Primary gold CTA: **Sign in**
- Secondary: Forgot password · Need help?
- Optional quiet property name (e.g. “Maple Suite · Toronto”)

**Do not include:** marketing nav, feature grids, testimonials, stats on login.

**Frames:** Desktop login · Mobile login

---

## Screen 2 — Host dashboard + Ask MRG

**Job:** At a glance: how the unit is doing this month — plus a persistent place to ask anything about *their* property.

### Layout (desktop)

- **Left / main (~60–65%):** unit photo identity + metrics hosts need
- **Right / Ask MRG (~35–40%):** always-visible chat column (not a tiny floating bubble)
- Mobile: stack main content; **Ask MRG** as full-height chat or sheet

### Main dashboard must show

- Same unit mock photo (strong header/banner)
- Property title + city · host name · “Managed by Mandel Realty”
- Month (e.g. July 2026)
- **Net to host** (hero) · MoM % · bookings/nights · occupancy % · **projected revenue for 2026** · next payout date
- Upcoming stays (2–3)
- Quiet “July statement ready” teaser
- Optional thin 6-month net sparkline

No admin HST toggles / internal waterfall on this screen.

### Ask MRG

- Title **Ask MRG**
- Empty-state helper: answers use MRG knowledge for **this** unit
- Suggestion chips:
  - “How many bookings do I have this month?”
  - “What’s my projected revenue for 2026?”
  - “When is my next payout?”
  - “How did July compare to last year?”
- Sample 2–3 turn thread with real-looking CAD / nights
- Composer + send (gold)
- Footer: “Based on your Mandel Realty data for Maple Suite”
- Calm advisor panel — not Intercom spam; soft green `#4ea882` live dot OK

---

## Sample data

Host **Khamraj** · **Maple Suite · Toronto** · July net **$3,553** · MoM **+12.4%** · **6 bookings** · **18 nights** · **78% occ** · 2026 projected **~$42,000** · Next payout Aug 5 EFT

---

## Frames required

| # | Frame |
|---|--------|
| 1 | Login desktop (with generated unit hero photo) |
| 2 | Login mobile |
| 3 | Dashboard + Ask MRG desktop (empty + chips) |
| 4 | Dashboard + Ask MRG desktop (sample chat filled) |
| 5 | Dashboard mobile |
| 6 | Ask MRG mobile (full height / sheet) |

---

## Success test

Login feels personal (*my* unit photo, welcome back, my name). Dashboard answers “how am I doing?” in seconds. Ask MRG is the obvious place for booking/revenue questions. Photos look like a real premium listing.

---

## One-line direction

**Dark-gold host portal: cinematic generated condo/apartment/house photography on login, then a calm ownership dashboard with Ask MRG as a first-class advisor for this property’s data.**
