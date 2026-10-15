# Claude Design prompt: Mandel Copilot Overview redesign

Copy everything below the line into Claude Design.

---

Design the **Overview** screen for **Mandel Copilot**, the internal operations app for Mandel Realty Group, a Toronto short-term-rental company managing about 10 Airbnb units. The partners (Shane, Ryan) and the team open Overview first thing in the morning and many times a day. In one glance it must answer **"What's going on, and what needs me right now?"** across everything Copilot watches.

Return one self-contained HTML file: inline CSS, no external JS libraries, Google Fonts links allowed. Use realistic sample data (below). Include a light and a dark version via `data-theme="dark"` on the root. Desktop first at 1440px wide, plus a 390px phone layout (the app is installed as a PWA on iPhone).

## The problem with today's Overview

Today it's one narrow column of prose ("Nothing needs you today. Two reminders are outstanding…") followed by a single list. It's hard to scan, hides most of what Copilot knows, and doesn't change shape when the day gets busy. The redesign must be **dynamic**: sections appear, grow, shrink or collapse according to what's actually happening. A quiet day looks calm and short. A busy day leads with what's urgent.

## Layout it sits in (don't redesign these)

- The top bar: brand "Mandel Realty Group", tabs CRM / OPS / **Copilot**, and a theme toggle on the right.
- The left sidebar, 330px: New chat, **Overview** (selected), Guest messaging (with count badge), Reviews (count), Tasks, Reminders (count), Browser, then recent chats with relative dates, and Settings / Install Copilot at the bottom.
- The chat composer pinned at the bottom of the main area ("Ask MRG", + button, round send button), with "Nothing goes out until you confirm." above it.

Design only the main content area between those. It can be wider than today's 720px column. Use the width: up to about 1120px, centered.

## What the Overview must show (every module, with the real data each one has)

Order modules by **urgency, not by type**. Show a module only when it has something; otherwise fold it into one quiet "All clear" line at the bottom listing what was checked.

1. **Today strip (always at the top).** The date in serif ("Thursday, October 15"). Then a compact row of glanceable counters, each one a button that jumps to its screen:
   - Guests waiting for a reply.
   - Reviews to answer, with flagged low-star reviews called out.
   - Tasks due today / overdue.
   - Reminders due.
   - Check-ins today.
   - Check-outs and turnovers today.
   - Drafts waiting for your approval.

   Below that, one short serif sentence written by Copilot summarizing the day, e.g. "3 guests are waiting, the longest 42 minutes. Two turnovers today, one still needs a cleaner."

2. **Needs you now.** One merged, ranked list of the most urgent items across every source, top 5, then "Show all". Each row has:
   - a source tag (Guest message, Review, Task, Reminder, Inquiry, Turnover, Draft);
   - a title;
   - one line of why or context;
   - the time pressure, e.g. "waiting 42 min", "expires in 3h", "1 day outstanding", "due 6:00 PM";
   - one primary action and an optional secondary action.

   Action labels are things like Reply, Review draft, Mark done, Assign cleaner, Open.

3. **Guest messages.** Conversations waiting on us. Each has:
   - the guest photo (32px circle, or initials) and first name;
   - the listing photo tile (44×32, radius 8) and property name;
   - the stay dates;
   - the last message preview (translated to English when the guest wrote in another language, with a small "Translated from French" note);
   - how long they've waited.

   Separately show **Inquiries** (pre-booking questions). They have an expiry countdown and are the highest priority because they lose bookings. Also show a small "On the guest" count: we replied last and are waiting on them.

4. **Arrivals, departures and cleaning, today and the next 2 days.** A compact day-by-day timeline. For each property:
   - check-in and check-out with times and the guest name;
   - the turnover between them, with its state: **Cleaner assigned**, **Needs a cleaner** (warning), or **Overdue and unassigned** (danger).

   Design a visual slot for **"Cleaning in progress"** and **"Cleaned"** states too. We'll wire those up later, so make them clearly optional. "Assign cleaner" is the action.

5. **Reviews.** The count waiting.
   - **Flagged reviews** (3 stars or fewer) come first: stars, guest, property, the AI's one-line assessment, and a "Possibly retaliatory" or "Likely retaliatory" badge when it applies.
   - Then "N 5-star replies drafted and ready", with Review drafts as the action.
   - Nothing posts until someone presses Submit, so show that reassurance subtly.

6. **Tasks.** A mini board summary:
   - counts by To do / Doing / Waiting;
   - the tasks due today or overdue, each with its assignee chip ("Shane", "Ryan", "Rita O."), unit and due time;
   - tasks Copilot created automatically, marked with a small "Copilot" source tag, e.g. "Copilot · from a guest follow-up".

   Assignees are always shown by name, never "me". There's a filter chip row: Everyone / Shane / Ryan.

7. **Reminders.** Overdue first ("1 day outstanding", in the warning color, with a dot), then today, then upcoming. Each has Mark done.

8. **Waiting on your approval (drafts).** Everything Copilot prepared that's waiting for a person to press the button: guest reply drafts, review replies, emails (e.g. a building parking registration email for 20 Blue Jays Way), skill cards. Each shows what it is, who it goes to, and Open / Approve. This module matters: **nothing is ever sent, posted or booked without a partner approving it**, so this is the outbox of pending decisions.

9. **Conversations with Copilot that need follow-up.** Recent chats where Copilot is waiting on an answer, has a result to review, or produced a draft. Each has the chat title, the last line, "Today" or "Yesterday", and Continue.

10. **Automations and skills.** The skills that run on a schedule, e.g. "Weekly guest check-in texts, every Monday 9:00 AM" and "Review reply drafts, every morning 5:00 AM". Each shows:
    - its last run (time, plus OK or Failed);
    - what it produced ("drafted 4 replies");
    - its next run.

    A failed run is shown in the danger color with Retry. Healthy ones collapse to one line, e.g. "4 automations ran fine overnight".

11. **System health (quiet, at the bottom).** Connections: Hospitable, Gmail, Outlook, Google Calendar ("Mandel Tasks"). Each is a small dot with its state: Connected / Not connected / Paused, plus "Copilot's last check ran 9:12 AM". When something is broken, promote it to the top as a slim banner.

## Dynamic behavior to show in the design

- **Two states, side by side or as two frames:** a **busy day** (many items: guests waiting, a flagged review, an unassigned turnover, overdue reminders, a failed automation) and a **quiet day** (almost everything clear: a short, calm page that says what was checked).
- Counters and modules update live. Show how a newly arrived item enters, e.g. a subtle highlight on the new row and "new" for a few seconds. Keep it calm: no bouncing, no confetti.
- Overflow: each module shows at most 3–5 rows, then "Show all N".
- Phone (390px): the counters become a 2-column grid, and modules stack in urgency order. Targets are at least 44px, with 16px side gutters.

## Sample data (use it, it's real-shaped)

- **Properties:**
  - 20 Blue Jays Way (Unit 318)
  - "1,100SqFt. 2B+Den Rogers/Convention Centre, TIFF"
  - Unit #606 (8 Charlotte)
  - Chic 2BR w/ Yard + Parking | Shaw St (1065 Shaw St)
  - 41 Roseglor Cres ("Bright and comfortable home for families")
- **Guests:** Alyssa at 41 Roseglor Cres, Oct 15–18, 3 nights: "Hi! What's the wifi password?", waiting 12 min. Edith (French, translated). Lee, an inquiry for Nov 5–8, expires in 3h.
- **Review:** Don, 3 stars, the Rogers/Convention Centre unit. Assessment: "Construction noise and the 'luxury' label; not reported during the stay; no retaliation indicators." Marty and Jenny, 5 stars, drafted.
- **Tasks:** "Finish groceries flow", Shane, Doing, due Sat Oct 17. "Replace hallway bulb", Rita O., To do, unit 606.
- **Reminders:** "Purchase supplies for roya unit", Shane, 1065 Shaw St, 1 day outstanding (Wed Oct 14, 9:00 AM). "Call city for raj unit", Shane, Blue Jays Way 318, 1 day outstanding.
- **Turnovers:** Roseglor today 11:00 AM (Needs a cleaner). Unit 606 tomorrow (Cleaner assigned).
- **Drafts:** "Parking registration email to 20 Blue Jays Way concierge", waiting approval.
- **Chats:** "when are all units available", Today. "Parking Email for 20 Blue Jays Way", Yesterday.
- **Automations:** "Review reply drafts, daily 5:00 AM, ran 5:00 AM, drafted 4". "Weekly guest check-in texts, Mondays 9:00 AM, next Mon Oct 19".

## Style guide (stay inside it, invent nothing outside it)

**Personality:** quiet, editorial, warm paper. Calm and trustworthy, not a flashy SaaS dashboard. No gradients (except the existing hatched placeholder tile), no drop shadows, no glassmorphism, no emoji, no icon soup. Hierarchy comes from type, spacing and thin rules.

**Fonts:**
- UI and body: **Instrument Sans**, with system-ui as fallback.
- Headlines, the date and the summary sentence: **Source Serif 4**, with Georgia as fallback.
- Numbers, IDs and codes: **JetBrains Mono**.
- Load all three from Google Fonts. Use `font-variant-numeric: tabular-nums` everywhere.

**Type scale (size / line-height / weight):**

| Element | Font | Size / line-height | Weight | Other |
|---|---|---|---|---|
| Page date | Serif | 28 / 36 | 500 | letter-spacing -0.01em |
| Summary sentence | Serif | 17 / 28 | 400 | color ink2 |
| Section label | Sans | 13 / 20 | 600 | ink; secondary text after it 12px, 500, muted |
| Row title | Sans | 15 / 22 | 600 | |
| Row body | Sans | 14 / 22 | 400 | ink2 |
| Meta / kind / time | Sans | 12 / 16 | 500 | muted |
| Base | Sans | 14 / 22 | | |

**Color tokens: light** (`.cp`):

| Token | Value |
|---|---|
| canvas (page bg) | #f7f4ee |
| side (sidebar / bars) | #f0ece4 |
| surface (cards / inputs) | #fffdf9 |
| tint (chips, selected) | #eae5dc |
| ink | #211f1b |
| ink2 | #3b3731 |
| muted | #6f685e |
| line | #e4ded4 |
| line2 (button borders) | #d3cbbe |
| accent-fill (primary buttons, selection ring) | #b5562a |
| accent-hover | #a04b23 |
| accent-ink (accent text) | #a04b23 |
| on-accent | #fffdf9 |
| needs (warning / outstanding) | #8a620e |
| info | #56656d |
| failed (danger) | #9a4450 |
| wash (accent wash bg) | #efdfd2 |
| desk | #e6e1d8 |
| ok (success) | oklch(0.55 0.13 155) |

**Color tokens: dark** (`.cp[data-theme="dark"]`):

| Token | Value |
|---|---|
| canvas | #1e1c19 |
| side | #191815 |
| surface | #282521 |
| tint | #302c27 |
| ink | #ede8e0 |
| ink2 | #d3cdc3 |
| muted | #a29b90 |
| line | #34302a |
| line2 | #47423a |
| accent-fill | #d57a4a |
| accent-hover | #e08a5b |
| accent-ink | #e2895a |
| on-accent | #1e1c19 |
| needs | #d4a65a |
| info | #9aaab1 |
| failed | #d78c95 |
| wash | #3b2a1f |
| desk | #141311 |
| ok | oklch(0.74 0.13 155) |

**Shapes and spacing:**
- Radius: 8px for buttons, inputs and tiles; 12px for cards and panels; 999px for pills and count badges; 50% for avatars.
- Spacing runs on a 4px grid. Common values: 4, 6, 8, 10, 12, 16, 20, 24, 40. Sections sit 40px apart, and rows have 20px vertical padding.
- Separators are 1px `line` rules between rows. Prefer rules and whitespace over boxed cards, and use cards sparingly (e.g. the counters).

**Components to reuse (match these exactly):**
- **Secondary button:** 32px tall, 0 14px padding, radius 8, 1px `line2` border, transparent background, 13px / 600, ink.
- **Primary button:** `accent-fill` background, `on-accent` text, same size. Hover is `accent-hover`. One primary per row at most.
- **Count badge (sidebar style):** small pill, 12px / 600. Accent for attention, muted otherwise.
- **Status:** a 6px dot plus a 12px / 600 label in the status color. `needs` for outstanding or waiting, `failed` for overdue or broken, `ok` for healthy, `muted` for done.
- **Assignee chip:** `tint` background, 12px / 600, radius 6, name only.
- **Guest avatar:** 32px circle photo, or initials on `tint`. **Listing tile:** 44×32, radius 8, photo or the hatched placeholder `repeating-linear-gradient(135deg, tint 0 4px, line 4px 8px)`.
- **Focus:** a 2px `accent` outline.
- **Underlined text links:** 12px / 500, muted, underline offset 3px (e.g. "Open Reminders", "Show all").

**Voice in the UI:**
- Plain, short, and specific, written as Copilot.
- Use real names, real properties and real times in Toronto time ("Wed Oct 14, 9:00 AM").
- Never use em dashes. Use commas or periods.
- Never say "me" or "you" for an assignee; use the name.
- Reassure where it matters: "Nothing goes out until you confirm."

## Deliverable

One HTML file with:
1. the busy-day Overview, desktop, light;
2. the same, dark;
3. the quiet-day Overview, desktop, light;
4. the busy day at phone width.

Label each frame. Keep every color, font, radius and button style inside the style guide above.
