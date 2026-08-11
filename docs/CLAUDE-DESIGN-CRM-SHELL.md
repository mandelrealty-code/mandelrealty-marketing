# Mandel Realty CRM — Claude Design brief (all admin screens except contact chat)

**Product:** Mandel Realty Group in-house CRM + AI SMS closer  
**URL:** `admin.mandelrealtygroup.com`  
**Stack feel:** Dark luxury real-estate ops tool — not HubSpot, not a purple SaaS dashboard  

**Already designed & built (do NOT redesign):** Contact / SMS inbox screen (`Contact Screen.dc.html` already shipped). Keep that language for consistency when a row opens into chat.

**Your job:** Design the **rest of the admin shell** so it is **minimal**, **mobile-first (critical)**, and **excellent on desktop**. One clear job per screen. No clutter.

---

## Design principles (hard rules)

1. **Mobile first.** Primary frame **390 × 844**. Also show **desktop ~1280** for Contacts + Pipeline + Settings.
2. **One job per screen.** If a control isn’t needed for that job, put it behind `···`, a sheet, or Settings.
3. **No card soup.** Prefer flat lists, hairline dividers, one elevated surface max per section.
4. **No pill runway clutter.** Filters = compact selects or a short chip row (max ~4–5 visible). Stages on Pipeline = chips that filter a list — not sideways Kanban columns on mobile.
5. **Brand first only on login.** Inside CRM, brand is quiet (small logo + gold label). Content is the hero.
6. **Thumb zone:** Bottom tab bar always reachable; primary CTA in thumb reach on mobile.
7. **Density:** Contact list rows must feel like iMessage/WhatsApp business inbox — name, one subtitle, time — not a data table.
8. **Motion:** Calm only — tab fade, sheet rise, list row fade. No glow, no bounce spam.

---

## Brand tokens (use exactly)

| Token | Hex | Use |
|--------|-----|-----|
| Background | `#0c0c0c` / `#0a0a0a` | Page |
| Surface | `#0e0e0e` / `#141414` | Thread-like panels |
| Elevated | `#1a1a1a` / `#1c1c1c` | Inputs, sheets, list wells |
| Text | `#f5f5f5` / `#ffffff` | Primary |
| Muted | `#9a9590` / `#9a9a9a` | Meta, subtitles |
| Quiet muted | `#6f6a65` / `#5e5a56` | Timestamps, empty states |
| Gold | `#c4a35a` | Primary CTA, accents, active tab |
| Gold light | `#dcc084` | Hover / focus |
| AI live | `#4ea882` / `#8fcbb0` | Live indicator |
| AI paused | `#c99a4b` / `#d9ac63` | Paused |
| Booked / info | soft sky `#a9cfe8` on `rgba(122,167,201,.12)` | Mark booked, info chips |
| Danger | `#cf7f7b` | Delete only |
| Hairlines | `rgba(255,255,255,0.08–0.10)` | Borders |

**Font:** Manrope 400/500/600/700 (as in Contact Screen design).  
**Avoid:** purple gradients, cream paper, Inter-default “AI SaaS”, multi-shadow cards, emoji, floating badges on lists.

**Logo:** White wordmark/logo mark (`mrg-logo-white.png` concept) — small in shell header; larger on login only.

---

## App shell (all authenticated tabs)

### Mobile
- **Top:** minimal bar — logo mark + “CRM” (or page title) + optional AI global pill + Refresh  
- **Bottom tab bar (fixed):** Contacts · Pipeline · Knowledge · Settings  
  - Active = gold text + tiny gold underline or dot  
  - Inactive = muted  
  - Safe-area bottom padding  
- Content scrolls above the tab bar (`pb` for tab height)

### Desktop (≥1024)
- Same bottom tabs **or** a slim left rail (prefer **same bottom tabs centered** for consistency — or a left icon rail if it stays minimal). Pick one; don’t invent a third nav pattern.
- Content max-width ~960–1040px centered.
- Contacts list can be **list + empty detail hint** on desktop (“Select a contact”) — opening a contact still uses the existing full-screen chat (already built). Optional split view is nice-to-have, not required.

---

## Screens to design

### 0) Login
**Job:** Get in.  
- Centered card on dark ground  
- Small logo + “Mandel Realty Group” gold eyebrow + “CRM”  
- Password field + gold Sign in  
- No marketing copy wall  

**Frames:** mobile 390, desktop 1280 (card still centered).

---

### 1) Contacts (default home)
**Job:** See who needs you, find people, open a chat.

**Mobile layout (top → bottom):**
1. **Stats strip (quiet):** 3 equal cells — Total leads · Booked · Closed — gold numbers, muted labels. Compact; not hero.
2. **Needs you** (only if count > 0): amber-tinted compact block, max ~5–6 rows, “Needs you · N”. Each row: name + reason chips (AI stuck / Unanswered / High intent / KB miss) + one-line what’s next. Tap → chat.
3. **Search** + gold **+ Lead** (opens Settings paste, or jump to Settings).
4. **Filter/sort row** (horizontal, minimal): Path · Stage · AI · Booked this week · Sort (Needs you / Newest / Oldest). Prefer compact selects over many chips.
5. **Inbox list:**  
   - Unread = gold dot + bold name  
   - Subtitle = What’s next **or** last SMS preview  
   - Meta line = path · stage · Added date (or SMS time)  
   - Trailing `···` for quick actions (not full swipe UI in the mock — show the action sheet state as a separate frame)

**Quick actions sheet (from `···`):** Take over / Resume · Mark booked · Call · Copy phone · Open chat · Cancel  

**Empty state:** one short line + CTA to paste/import.

**Frames required:**
- A Mobile Contacts (with Needs you + list)
- B Mobile Contacts empty / filtered empty
- C Mobile quick-actions sheet
- D Desktop Contacts (wider list, same hierarchy — not a spreadsheet)

---

### 2) Pipeline
**Job:** Scan by stage without sideways scrolling hell.

**Mobile:**  
- Horizontal **stage chips** (All + each stage with counts)  
- Below: **sorted vertical list** (same row language as Contacts: name + what’s next + path)  
- Tap → chat  

**Do not design** multi-column Kanban for mobile.  
**Desktop optional:** chips + denser list, or 2-column only if it stays calm — prefer one list.

**Frames:** mobile Pipeline default; desktop Pipeline.

---

### 3) Knowledge
**Job:** Feed the AI — upload & activate docs.

**Mobile:**
- Short intro (1–2 lines): “AI only answers from these docs.”
- Title field (optional)  
- Primary gold CTA: **Add PDF / DOCX / TXT**  
- Doc list: title, filename, status (Ready / Processing / Failed), Active toggle, delete  
- Failed = quiet red error line  

No feature gallery. No fake “AI insights” charts.

**Frames:** mobile Knowledge with 2–3 docs; one with upload idle.

---

### 4) Settings
**Job:** Global AI + import leads.

**Sections (stacked, minimal):**
1. **AI Responses** — one row: label + short helper + toggle (and env-kill note if off)  
2. **Paste Meta lead** — textarea (mono small), Preview + Import buttons, preview dl (Name, Phone, City, Airbnb, Process, Pipeline, Decision), warnings list  
3. Optional quiet note: CSV = header + one row; Make.com auto-import for new leads  

**Frames:** mobile Settings AI on; mobile Settings with preview filled; desktop Settings.

---

## Component inventory (reuse across screens)

- Bottom tabs  
- Stats cell  
- Needs-you row  
- Contact inbox row (read / unread)  
- Filter select / chip  
- Primary gold button / secondary ghost button  
- List well (rounded 16–20px, hairline)  
- Bottom sheet (same language as Contact Details sheet: `#151515`, grabber, Done)  
- Empty state text  
- Toggle (AI)  

Match radii/spacing from Contact Screen: sheet radius ~26px top, bubbles/lists ~14px, composer ~22px pills, hairline borders.

---

## Content samples (use realistic MRG copy)

**Contacts:** Mukesh Gupta, Shabnam Shabnam, Zaki Murtuza, Ritesh Dewan  
**Paths:** Airbnb makeover · Full-service management · Learn / guides  
**Stages:** New, Engaging, Nurturing, Interested, Booked, Won, Low fit, Skip  
**Needs you reasons:** High intent · Unanswered reply · AI stuck  
**What’s next examples:** “Nurture scheduled (~30d)” · “Permit unclear — awaiting reply”

---

## Deliverable checklist for Claude Design

Export one design doc (or pack) with labeled frames:

| # | Frame |
|---|--------|
| 1 | Login — mobile |
| 2 | Login — desktop |
| 3 | Contacts — mobile (populated + Needs you) |
| 4 | Contacts — mobile (quick actions sheet) |
| 5 | Contacts — desktop |
| 6 | Pipeline — mobile |
| 7 | Pipeline — desktop |
| 8 | Knowledge — mobile |
| 9 | Settings — mobile (AI + paste) |
| 10 | Settings — mobile (preview state) |
| 11 | Settings — desktop |
| 12 | App shell / tab bar close-up (mobile) |

**Out of scope:** Contact SMS chat (already done). Marketing site. Purple themes.

---

## Success test

At **390px**, a partner can:
1. Land on Contacts and see Needs you without scrolling past junk  
2. Open a chat in one tap  
3. Switch tabs with thumb  
4. Paste a Meta lead in Settings without a wall of UI  

At **1280px**, the same hierarchy holds — just more air, not a different product.

---

## One-line creative direction

**A quiet gold-on-black closer’s inbox for two operators on their phones — every screen does one job, and the chat is never buried.**
