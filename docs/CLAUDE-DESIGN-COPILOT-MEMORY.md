# Claude Design — Copilot Memory (one file per memory)

**Product:** MRG Admin · Copilot mode (third mode beside CRM and OPS)
**URL:** `admin.mandelrealtygroup.com` → Copilot
**Audience:** The two partners of Mandel Realty Group. Shared by both.
**Timebox:** One design pass. Return a single HTML file with every screen below on one canvas.

## The problem to solve
A partner asked Copilot "how many units do we manage currently". Copilot answered off Hospitable and listed 10 properties. The partner said "remember this, MRG only tracks 8 charlotte 606, roseglor, 20 blue jays way, and 1065 shaw street." Copilot stopped. The bubble read "Stopped. Nothing was sent." The correction died in that chat.

Design **Memory** as files, the way Muse keeps them. Each thing Copilot keeps is its own file. The partner can open the file and read it. There is no form, no named field, and no Save button.

Saving "remember this" writes two files in that same moment:
1. **The memory file.** One subject, one file. This one is `memory/units-we-manage.md`.
2. **Today's log.** `memory/2026-10-06.md` records the sentence they said and points at the memory file.

A later "remember that garbage bags are the 25L ones" writes a new file, `memory/garbage-bags.md`, and adds a line to today's log. It does not edit the units file.

A correction of the same subject rewrites that file. It does not create a second units file.

When a property is added, renamed, paused, or removed in OPS, Copilot rewrites `memory/units-we-manage.md` on its own and adds a line to today's log: "Updated from OPS."

Once a night, Copilot writes `dreams/2026-10-06.md`. That file is a review of the day. It is never used in an answer. The lines an answer must follow live in `memory/guidance.md`, and that file is short.

## Shell lock: don't redesign Copilot chrome
Copilot already has:
- Top **CRM | OPS | Copilot** switcher
- Desktop **left sidebar:** New chat · Overview · list of chats
- **Settings** with rows: Skills · Connectors · Account · Billing
- Mobile: top bar with chats button, title, new chat. Settings screens use a back button.

Add **one** Settings row: **Memory**, subtitle "A file for each thing this chat keeps."

**Design Memory inside Settings, plus the file shown in chat.** Keep the sidebar and switcher exactly as described. Don't add a sidebar row.

## Scope lock: only design what ships
### In scope
| Thing | What's real |
|------|-------------|
| Settings row | **Memory** · "A file for each thing this chat keeps." |
| File list | Paths first. Three groups: **Today**, **Files**, **Tonight**. |
| Today | `memory/2026-10-06.md` — the log. One quiet line: "Wrote units we manage. Wrote garbage bags." |
| Files | `memory/units-we-manage.md` and `memory/garbage-bags.md`. Name, then one quiet line of the fact. |
| Tonight | `memory/guidance.md` — "Used in answers." `dreams/2026-10-06.md` — "Not used in answers." |
| Units file | Four units, one per line. Last line cites today's log. "You said this · Oct 6." |
| Units file after OPS | Same file, rewritten. A fifth unit is now in it. "Updated from OPS · Oct 7." Today's log has a new line for that rewrite. |
| Daily log | The quote they typed, then "Wrote memory/units-we-manage.md". Later, "Wrote memory/garbage-bags.md". |
| Chat | Partner says "remember this…". Copilot answers in one or two sentences. Under that, the file it wrote: path, first lines, "Wrote memory/units-we-manage.md". No Save button. |
| The next answer | "We manage 4." then the four names. One line under it: "From memory/units-we-manage.md. Hospitable lists 10. The other 6 are not in that file." |
| Garbage bags in chat | A new file, `memory/garbage-bags.md`, body "The 25L ones." |
| Dream file | A short review of the day. A quiet line: "Not used in answers." |
| Guidance file | Two or three short lines the next answer follows. "Used in answers." |
| Empty state | No files yet. A file gets written by telling Copilot to remember something in chat. |

### Out of scope (don't draw these)
- Skills, Connectors, Account, Billing, Overview.
- Sending anything. No guest messages, no approvals, no drafts.
- Schedules, dashboards, charts, onboarding, essays.
- A form for typing a memory by hand.

## Real data to use
**memory/units-we-manage.md** — You said this · Oct 6:
- 8 Charlotte 606 — 606, 8 Charlotte Street
- Roseglor — floor 2, 41 Roseglor Crescent
- 20 Blue Jays Way — 318, 20 Blue Jays Way
- 1065 Shaw Street
- Cited from memory/2026-10-06.md

That is four and only four. Hospitable still has the other six (19 Markham #3, 19 Markham 1, Markham 2, 8 Charlotte 1103, 1104, 2104). Those are on Hospitable. They are not in this file.

**After OPS:** the same file now also has "Nance Unit". "Updated from OPS · Oct 7."

**memory/garbage-bags.md** — "The 25L ones."

**memory/2026-10-06.md**
- "remember this, MRG only tracks 8 charlotte 606, roseglor, 20 blue jays way, and 1065 shaw street."
- Wrote memory/units-we-manage.md
- "remember that garbage bags are the 25L ones."
- Wrote memory/garbage-bags.md

**memory/guidance.md** — "Units we manage are the four in memory/units-we-manage.md. Do not count the other Hospitable listings."

**dreams/2026-10-06.md** — "They corrected the unit count. The managed list is a file now, and Hospitable's extra listings stay out of it." Not used in answers.

## Hard rules
1. One concept: **Memory**. What you open is a **file**. The path is the first thing you read. The words job, cron, knowledge base, note, prompt, and field never appear.
2. Each memory is its own file. Two subjects means two files.
3. Short copy. Buttons are at most 3 words: Open file · Delete.
4. "Nothing was sent" appears only where a run finished without sending. A written file never says it.
5. Mobile 390 first, then desktop. Both light and dark.
6. No emoji, no new colors, no card-inside-card.
7. Font **Manrope**. Gold primary `#c4a35a` (hover `#dcc084`).

## Tokens (live Copilot)
**Dark:** page `#0b0a10` · sidebar `#121119` · surface `#1b1a23` · text `#f5f5f7` · muted `#a4a2ae` · quiet `#7a7884` · line `rgba(255,255,255,0.08)` · done `oklch(0.72 0.13 155)` · danger `oklch(0.72 0.12 20)`
**Light:** page `#f4f3f7` · surface `#ffffff` · text `#16151b` · muted `#6b6975` · quiet `#8f8d99` · line `rgba(22,20,30,0.09)` · done `oklch(0.58 0.13 155)`

## Screens (only these)
1. **M1 Settings rows:** mobile and desktop, with the new **Memory** row beside Skills, Connectors, Account, Billing.
2. **M2 File list:** mobile and desktop. Groups Today, Files, Tonight, with the paths above.
3. **M3 Units file:** `memory/units-we-manage.md` open. Four units, the citation, "You said this · Oct 6", Delete.
4. **M4 Units file after OPS:** same path, five units, "Updated from OPS · Oct 7".
5. **M5 Daily log:** `memory/2026-10-06.md` open, quote then "Wrote memory/units-we-manage.md".
6. **M6 Chat:** "remember this…", the spoken answer, and the file it wrote (path and first lines).
7. **M7 The next answer:** "We manage 4." the four names, then the line that names the file and the Hospitable 10.
8. **M8 Garbage bags:** chat writes `memory/garbage-bags.md`. Show that file open.
9. **M9 Tonight:** `memory/guidance.md` marked "Used in answers", and `dreams/2026-10-06.md` marked "Not used in answers".
10. **M10 Empty state:** no files yet.
