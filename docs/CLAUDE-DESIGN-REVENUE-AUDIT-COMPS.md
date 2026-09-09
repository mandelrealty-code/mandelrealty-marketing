# Claude Design brief — Revenue Audit comps + badge standing

**Product:** Mandel Realty Group — Revenue Audit (`/revenueaudit`)  
**Scope:** Two connected free-report blocks — **not** the full page  
1. **How you stack up** (comps CMA with real listing photos)  
2. **Your badge standing** (Superhost / Guest Favorite / Top 10% — *their* status next to impact)  
**Audience:** Airbnb hosts who just ran the free audit; they need to trust these are **real nearby listings** and see clearly **what they have vs what they’re missing**  
**Your job:** Redesign these blocks for desktop (~1120 content width) + mobile (~390). Match the existing audit page language. Export a Design Canvas HTML slice we can drop in.

---

## Match the live page (do not invent a new brand system)

The rest of `/revenueaudit` is already built. Stay inside it:

- **Font:** Plus Jakarta Sans (or closest), weights 500–800  
- **Colors:** white page `#ffffff`, text `#222222`, muted `#717171` / `#5e5e5e`, borders `#ebebeb` / `#dddddd`, accent **Airbnb coral** `#ff385c`, positive teal `#00806f`, dark “your property” panel `#222222`  
- **Shape language:** soft 18–20px radii, light shadows, airy spacing — bubbly SaaS, not cards-on-cards soup  
- **No** cream/gold estate look, no purple gradients, no Inter/Roboto, no emoji

Tone: confident co-host / analyst. Specific. Never “we guarantee X%.”

---

## Section jobs

### A) How you stack up
Prove: **your listing vs what similar nearby Airbnbs are actually earning**, with **real listing cover photos** from market data so it feels like a CMA, not a mock.

### B) Your badge standing (REQUIRED — do not drop this)
The live Claude redesign only shows **generic impact of not having badges** (+29% revenue, 52% CTR, etc.). That is incomplete.

**Must also show, for THIS host’s listing, side-by-side with impact:**

| Badge / signal | Their status (required) | Impact (keep) |
|----------------|-------------------------|---------------|
| **Superhost** | Have it **or** don’t | e.g. +29% more annual revenue vs comparable non-Superhosts; 5–15% booking drop the month after losing it |
| **Guest Favorite** | Have it **or** don’t | e.g. 52% higher CTR; 23% vs 9% booking conversion |
| **Top 10% of listings in the area** | Have it **or** don’t (Airbnb sometimes surfaces this on the listing) | Short plain-language visibility / demand impact if missing |

Rules for status:
- Pull from live listing data after “Run my audit” (AirROI: `superhost`, `guest_favorite`; top-10% when present on the listing payload or labeled in mock as `topTenPercent`).
- States to design per badge: **You have this** · **You don’t have this** · and a clear **partial** pattern when they have some badges but not all (e.g. Superhost ✓, Guest Favorite ✕, Top 10% ✕).
- Status and impact sit **next to each other** (same row / same card) — not “impact only” with status buried or omitted.
- If they **have** a badge: celebrate briefly + still show why it matters (protect / keep compounding). Do not only lecture people who lack it.
- If they **don’t**: say so plainly + show the impact of missing it (what the current page already does well).
- Criteria lists (10+ reservations, 4.8 rating, etc.) can stay as secondary detail under each badge — status + impact are the hero.

Headline / support copy to keep (wording can tighten, meaning must stay):

**Comps**
- **H2:** How you stack up  
- **Support:** Same idea as a realtor’s CMA, built for Airbnb: your property placed next to what similar listings nearby are actually earning — not asking, earning.  
- **Footnote:** Free preview shows the three closest comps and what they earn. The full set — and the specific reason each one out-earns you — is in the paid audit below.

**Badges**
- **H2:** Superhost & Guest Favorite, by the numbers *(or tighter: “Your badge standing”)*  
- **Support:** Both are rule-based, both are measurable, and both change how often your listing gets seen at all.  
- Include **Top 10% in the area** as a third standing row even if the old H2 only named two badges.

---

## States to design

### Comps
1. **Loaded — free preview (primary mock)** — your property + **exactly 3 comps** with real-looking Airbnb cover photos.  
2. **Loading** — skeleton / shimmer. No fake finished photos.  
3. **Empty / unavailable** — honest empty; keep your-property revenue visible.

### Badge standing
1. **Mixed (primary mock)** — e.g. Superhost **yes**, Guest Favorite **no**, Top 10% **no** — status beside impact on every row.  
2. **None** — missing all three; impact reads as the cost of the gap.  
3. **All / most** — has Superhost + Guest Favorite (Top 10% optional yes); still show impact as “what you’re protecting.”

Do **not** design a pre-audit version (the page hides report blocks until “Run my audit”).

---

## Data you may show (real API fields — do not invent metrics we don’t have)

### Comps
| Field | Notes |
|--------|--------|
| `photoUrl` | Cover photo URL (AirROI `cover_photo_url`) — **hero of the card** |
| `title` | e.g. `2BR · 1BA · King West` |
| `meta` | Badges / rating line e.g. `Guest Favorite · Superhost · 4.92` |
| `monthly` | e.g. `$6,480` trailing monthly revenue |
| `delta` | vs host pace e.g. `+$2,900 / mo` (can compute in UI) |
| `diff` / diffs | Short “why it earns more” teasers — **blur or lock** on free preview |
| `distanceMiles` | Optional small meta |

### Your property (comps anchor)
| Field | Notes |
|--------|--------|
| Label | Your property |
| Title | Your listing, as it stands today |
| `currentMonthly` | From intake / AirROI subject e.g. `$2,333` |
| Optional | Subject cover photo (`subject.photoUrl`) — design with and without |

### Badge standing (subject listing)
| Field | Notes |
|--------|--------|
| `subject.superhost` | boolean → **You have Superhost** / **You don’t have Superhost** |
| `subject.guestFavorite` | boolean → **You have Guest Favorite** / **You don’t** |
| `subject.topTenPercent` | boolean when known (Airbnb “Top 10% of homes” / area callout). If unknown in mock, show a designed yes/no either way — engineering will wire when the field is available |
| Impact copy | Keep the known stats: +29% Superhost revenue lift; 52% GF CTR; 23% vs 9% conversion; 5–15% drop after losing Superhost. Add one short Top 10% visibility line (no fake precise % if we don’t have one). |

Paid “full comp set” later on the page — **out of scope** except the comps footnote pointing down.

---

## Layout intent (direction, not wireframe law)

**Comps**
- **Photo-first comps.** Thumbnail / cover must dominate each comp cell.  
- **Your listing** is the anchor (dark panel is fine if it matches the page).  
- Free preview: **3 comps** in one composition with your property.  
- Locked differentiators: blur / fade / Unlock — not fake deep analysis.

**Badge standing**
- One row (or stacked mobile row) **per signal**: status chip/label on one side, impact on the other.  
- Partial ownership must be obvious at a glance (green/check vs coral/missing — stay on-brand, no emoji).  
- Do not ship impact tiles alone without “your listing’s status.”  
- Criteria can sit under the status, not replace it.

Mobile: stack cleanly; photos stay large enough to feel real.  
Ship **1–2 subtle motions** (image fade-in, soft stagger) — presence, not noise.

---

## Sample content for the mock (use as-is)

**Your property:** `$2,333` / mo · “From your intake above”

**Comp A:** bright modern condo · `2BR · 2BA · King West` · `Guest Favorite · 4.92` · `$6,480` · `+$4,147 / mo` · locked why  
**Comp B:** city loft · `2BR · 1BA · Entertainment District` · `Superhost · 4.88` · `$5,910` · `+$3,577 / mo` · locked why  
**Comp C:** furnished suite · `1BR + den · Liberty Village` · `Guest Favorite · 4.95` · `$5,240` · `+$2,907 / mo` · locked why

**Badge standing (mixed — primary):**
- Superhost — **You have this** — +29% more annual revenue vs non-Superhosts; protect the quarterly review  
- Guest Favorite — **You don’t have this** — 52% higher CTR / 23% vs 9% conversion for listings that do  
- Top 10% in the area — **You don’t have this** — missing the “top of area” callout guests see on stronger listings nearby  

Use realistic STR interior photography in the mock (no watermarks, no text burned into images).

---

## Deliverable

1. Desktop + mobile of **comps + badge standing** (audit header chrome optional).  
2. Comps states: loaded / loading / empty.  
3. Badge standing states: mixed / none / mostly-have.  
4. Design Canvas `.dc.html` with `sc-for` comps, `sc-if` loading/empty/loaded, and clear bindings:  
   `photoUrl`, `subject.superhost`, `subject.guestFavorite`, `subject.topTenPercent`.  
5. Status + impact must appear **together** on every badge row in the export.

---

## Out of scope

- Full audit page, unlock modals, proof/black band, furniture program, final CTA  
- Inventing AirDNA charts, heatmaps, or metrics we don’t pull yet  
- Stock Unsplash filler that looks like a template — photos must feel like **that listing’s** cover  
- Impact-only badge section with no personalized have / don’t status (that’s the bug this brief fixes)
