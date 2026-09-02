# Claude Design brief — Employee / VA Portal (MRG): Login + My work + Hours

**Product:** Mandel Realty Group — **employee / contractor portal** (separate from admin OPS and host owner portal)  
**URL:** `mandelrealtygroup.com/team/{slug}`  
**Audience:** Invited VAs / contractors / internal team (e.g. Upwork VA doing Airbnb outreach)  
**Your job:** Design **exactly 3 screens** (plus mobile variants). Do **not** design admin invite UI, SOP browsers, clock-in timers, chat, payroll, or Kanban.

1. **Login / welcome** (+ set-password variant after invite)
2. **My work** — assigned tasks list + status update
3. **Log hours** — manual timesheet entry + recent list

---

## Brand (exact — match admin / host portal)

| Token | Hex |
|--------|-----|
| Background | `#0a0a0a` / `#0c0c0c` |
| Surface | `#141414` / `#1c1c1c` |
| Text | `#f5f5f5` |
| Muted | `#9a9590` / `#6f6a65` |
| Gold | `#c4a35a` |
| Gold light | `#dcc084` |
| Positive / done | `#4ea882` |
| Warning / due soon | `#c99a4b` |
| Danger / blocked | `#cf7f7b` |
| Hairlines | `rgba(255,255,255,0.08–0.10)` |

- Font: **Manrope** 400/500/600/700 — **required on every frame** (UI text, labels, buttons, empty states)
- Logo: MRG mark / wordmark (white or gold)
- Avoid: purple SaaS, cream paper, Inter, card soup, emoji, neon glow, floating badge clutter
- **Banned fonts (hard):** Architects Daughter, Caveat, Patrick Hand, or any handwriting / “sketch wireframe” cursive. Do **not** use Claude Design’s default doodle typeface. Product comps must look like the live MRG app (Manrope), not a napkin sketch.

**Tone:** Calm **work tool** for contractors — operator density like OPS Tasks, not cinematic host ownership. No unit hero photography.

---

## Hard design rules

- **Brand first on login.** One composition: MRG mark + welcome + sign-in. Atmosphere via subtle dark gradient / texture — not flat gray, not a property photo.
- **One job per screen.** Login = get in. My work = see and update tasks. Hours = log time.
- **No card soup.** Flat rows, hairline dividers, one sheet at a time for task detail / add hours.
- **Thumb zone:** bottom tabs for **Tasks · Hours** after login (mobile). Desktop: same two tabs or left sub-nav.
- Desktop **~1280** and mobile **390**.
- Do **not** invent admin screens, SOP library, live clock-in, GPS, chat, or payroll.

---

## Not in this brief

- OPS admin invite / hours review UI
- Public SOP hub redesign (`/sop/{slug}` already exists — link out only if useful as quiet helper text)
- Live clock-in / clock-out timer
- Multi-assignee task editing, creating tasks, deleting tasks
- Role matrices, payroll export, Upwork sync

---

## Screen 1 — Login / welcome

**Job:** Clear “this is your MRG team login” before they type credentials.

**Must include:**

- Quiet MRG mark
- **Welcome, {First name}** (sample: “Welcome, Maya”)
- One short supporting line: “Your Mandel Realty team portal”
- Quiet role line optional: “Virtual Assistant · Outreach”
- **Email** + **Sign-in code / password**
- Primary gold CTA: **Continue** / **Sign in**
- Secondary: Need help? → `mailto:info@mandelrealtygroup.com`

**Set-password variant (same chrome, different form):**

- Title: “Choose a password for your portal”
- New password + Confirm
- Gold CTA: **Save password**
- Shown after first invite login (`must_change_password`)

**Do not include:** marketing nav, feature grids, stats, unit photography, forgot-password deep flow.

**Frames:** Desktop login · Mobile login · Set-password mobile (or desktop)

---

## Screen 2 — My work (tasks)

**Job:** See only **my** assigned tasks; update status without OPS noise.

### Layout

- Header: MRG mark + first name · **Sign out**
- Tabs: **Tasks** (active) · **Hours**
- List of assigned tasks as flat rows (not Kanban)

### Each task row must show

- Title
- Status pill: open · in progress · blocked · done (use token colors)
- Priority if high (quiet gold or muted label)
- Due date (overdue = danger tint)
- Optional quiet meta: task type (e.g. marketing) · property name if present

### Task detail / update (sheet or inline expand)

- Full title + detail
- Status control (segmented or select): open / in_progress / blocked / done
- Optional short note field (employee comment — not full task edit)
- Primary: **Update** · Secondary: Close

**Empty state:** “No open tasks — check back after your manager assigns work.”

**Do not include:** create task, reassign, delete, property/client pickers, filters beyond open vs done (a quiet “Show done” toggle is OK).

---

## Screen 3 — Log hours

**Job:** Manual timesheet so managers know she put in the work.

### Layout

- Same header + tabs; **Hours** active
- **Add entry** form (top or sheet):
  - Date
  - Hours (decimal OK, e.g. 2.5)
  - Note (what she worked on — e.g. “Airbnb outreach — 12 hosts contacted”)
  - Optional: link to a task (select from her open tasks) — nice-to-have; omit if it clutters
- Gold CTA: **Log hours**
- **Recent entries** list below: date · hours · note · quiet delete if accidental

### Week summary (quiet)

- “This week · 12.5 hrs” above the list — one number, not a dashboard of charts

**Do not include:** live timer, GPS, screenshots, payroll rates, approval workflow UI.

---

## Sample data

Employee **Maya Chen** · slug `maya` · email `maya.va@example.com` · role VA Outreach  

Tasks:

1. **Airbnb outreach — batch A** · in progress · high · due Sep 3 · marketing  
   Detail: “Message 15 self-managed hosts in GTA per SOP.”
2. **Update outreach tracker** · open · normal · due Sep 4 · marketing  
3. **Follow up warm replies** · blocked · normal · due Sep 2 · marketing  

Hours:

| Date | Hours | Note |
|------|-------|------|
| Sep 2 | 3.0 | Outreach batch A — 14 hosts messaged |
| Sep 1 | 2.5 | Read SOP + set up Airbnb account |
| Aug 31 | 1.0 | Onboarding call notes |

This week total: **6.5 hrs**

---

## Frames required

| # | Frame |
|---|--------|
| 1 | Login desktop |
| 2 | Login mobile |
| 3 | Set password (mobile or desktop) |
| 4 | My work / tasks list desktop |
| 5 | My work / tasks list mobile |
| 6 | Task status update sheet (mobile) |
| 7 | Log hours desktop (form + recent) |
| 8 | Log hours mobile |

---

## Success test

Login feels like MRG team access (brand-first, not a generic SaaS login). Tasks answer “what should I do today?” in seconds. Hours make it obvious she can prove work with date + duration + note. Density matches OPS — calm, no card soup.

---

## One-line direction

**Dark-gold MRG team portal: invite-only login, a thin assigned-task queue with status updates, and a simple manual timesheet — work tool energy, not host cinema.**
