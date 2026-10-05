# Claude Design — Copilot Skills (one list, no "Jobs")

**Product:** MRG Admin · Copilot mode (third mode beside CRM and OPS)
**URL:** `admin.mandelrealtygroup.com` → Copilot
**Audience:** The two partners of Mandel Realty Group. Shared by both.
**Timebox:** One design pass. Return a single HTML file with every screen below on one canvas.

## The problem to solve
Settings today has two rows, **Skills** and **Jobs**. Jobs is being removed. Design **one** idea: **Skills**.

How a skill works: a partner describes a task in the Copilot chat ("every morning, read the Hospitable messages and tell us who's waiting on a reply"). Copilot drafts the skill as a card in chat, the partner presses **Save**, and from then on Copilot's agent runs it on its own on its schedule. It reads what it needs and leaves a report or drafts in its own chat. **Anything that would go to a guest, host or client waits for a partner to press Approve.**

Each row must show at a glance: **when it runs** ("Every morning, ~5:00", "When a clean is done"), whether it's on, and how the last run went.

There is no "Jobs" anywhere in the design.

## Shell lock: don't redesign Copilot chrome
Copilot already has:
- Top **CRM | OPS | Copilot** switcher
- Desktop **left sidebar:** New chat · Overview · list of chats (an unread dot on a chat means "this needs you")
- **Settings** with rows: Skills · Connectors · Account
- Mobile: top bar with chats button, title, new chat. Settings screens use a back button.

**Design the Skills area inside Settings only.** Keep the sidebar and switcher exactly as described. Don't add sidebar rows.

## Scope lock: only design what ships
### In scope
| Thing | What's real |
|------|-------------|
| Skills list | Every skill on one list: name, how it starts, on/off, one status line |
| **Morning inbox** (a skill the partners created in chat) | Each morning ~5:00 it reads Hospitable guest messages for stays checked in now or arriving within 14 days. Reports who's **waiting on a reply** and who **may have sent details**. It only reads. Nothing is sent. |
| Morning inbox controls | On/off · **Run now** · last run (time + worked / failed + error) · the skill's fields (when it runs, what it reads, what it leaves you, must not; the details to look for live in "what it leaves you") · **Open report** (opens its chat) |
| Run now states | Idle · Running (can take a few minutes; it's fine to leave the page, the result lands in the skill's chat) · Worked · Failed ("Hospitable could not be read: …") |
| Text skill (runs on its own) | "Clean done text": when a clean is done, texts the partners' own phone numbers. Fields: name, when, text message (with `{unit}`), numbers to text, must not. Shows a log of texts already sent. |
| Drafting skill | Fields: name, when it runs, what it reads, what it drafts, must not. Its runs leave drafts waiting for **Approve**. Save · Turn off · Delete · Run now. |
| New skill | A button that opens a chat where Copilot drafts the skill. Show the **skill draft card** in chat (name, when it runs, what it reads, what it leaves you, must not · Save · Not now). |
| **Morning inbox report** in its chat | Today it's a plain text bubble. Design it as a readable report inside the existing chat: header (Morning inbox · Tue Oct 6, "Read 23 of 23 stays. Nothing was sent."), **Waiting on a reply** list, **Couldn't tell who wrote last** list, **May have sent details** list with the matching quote, and a failed-read version. |

### Out of scope (don't draw these)
- Gmail, WhatsApp, AirROI, furniture report, guest-sending buttons. Nothing in this design sends anything to a guest.
- Scheduling pickers, cron editors, custom triggers. The schedule is fixed.
- The Overview/morning page, Connectors, Account, and the rest of the chat.
- Dashboards, charts, counts of runs, onboarding tours, essays.

## Real data to use
- **Morning inbox:** On · Every morning, ~5:00 · Last run today 5:02 AM · Worked · "2 waiting on a reply · 3 may have sent details"
- **Clean done text:** On · When a clean is done · Texts +1 (416) 555-0142 · log: "20 Blue Jays Way is clean, no issues. Here's the link to the report." (Oct 4, 11:12 AM)
- **20 Blue Jays Way parking email:** On · "Every morning, checks for new Airbnb bookings at 20 Blue Jays Way" · last run: "1 draft waiting for approval"
- Report rows: "Sarah · 20 Blue Jays Way · checks in Thu Oct 8 · waiting 9h · “Is there parking for two cars?”", "Mike · Nance Unit · in the unit until Sat Oct 10 · arrival time, licence plate · “We'll arrive around 4pm, plate CXRT 482”"

## Hard rules
1. One concept: **Skills**. The words "job", "cron", "run history" never appear.
2. How it starts is the first thing you read on each row.
3. Short copy. Buttons are at most 3 words: Run now · Turn off · Open report · Save · Delete.
4. Always say "Nothing was sent" where a skill finishes without sending.
5. "May have sent", never "sent", for details found in guest messages.
6. Mobile 390 first, then desktop. Both light and dark.
7. No emoji, no new colors, no card-inside-card.

## Tokens (live Copilot)
Font **Manrope**. Gold primary `#c4a35a` (hover `#dcc084`).
**Dark:** page `#0b0a10` · sidebar `#121119` · surface `#1b1a23` · text `#f5f5f7` · muted `#a4a2ae` · quiet `#7a7884` · line `rgba(255,255,255,0.08)` · done `oklch(0.72 0.13 155)` · danger `oklch(0.72 0.12 20)`
**Light:** page `#f4f3f7` · surface `#ffffff` · text `#16151b` · muted `#6b6975` · quiet `#8f8d99` · line `rgba(22,20,30,0.09)` · done `oklch(0.58 0.13 155)`

## Screens (only these)
1. **S1 Skills list:** mobile and desktop, three skills above, with the New skill button.
2. **S2 Morning inbox:** detail with on/off, last run, fields, Run now, Open report. Show the Running and Failed states as small variants.
3. **S3 Clean done text:** detail with fields, numbers, and the sent-text log.
4. **S4 Parking email skill:** detail, plus the waiting draft in its chat with **Approve** and **Hold** (Approve doesn't send yet if the channel isn't connected, and must say so).
5. **S5 Morning inbox report in chat:** the normal report and the failed-read version.
6. **S6 Empty state:** no skills yet, pointing to New skill.
7. **S7 Skill draft card in chat:** Copilot proposing the Morning inbox skill, with Save · Not now.
