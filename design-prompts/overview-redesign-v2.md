# Claude Design prompt: Overview v2 (one screen, agentic)

Paste this into the same Claude Design project as a revision of "Copilot Overview".

---

Revise the Copilot Overview. The content and functionality are right, but it's far too long: with everything in, it's a scroll-heavy report. An overview should be read in one glance. Redesign it as an **agentic command centre**: modern SaaS polish, smart, and compact. Copilot works in the background all day, and this screen is where it briefs the team and hands over the decisions only a person can make.

## Hard constraints

- **The busy day fits in one desktop viewport with no page scroll:** 1440×900 for the main area, between the existing top bar, sidebar and pinned composer. The quiet day is visibly lighter.
- **Nothing is removed.** Every module from v1 stays reachable: guests, inquiries, turnovers and cleaners, reviews, tasks, reminders, drafts waiting for approval, chat follow-ups, automations, connection health. Depth moves into **drill-downs**, not down the page.
- **Same style guide as v1, exactly.**
  - Warm paper palette tokens (light and dark).
  - Instrument Sans for the UI, Source Serif 4 for the briefing, JetBrains Mono for numbers.
  - Radii of 8 / 12 / 999.
  - The same 32px buttons with one accent-filled primary.
  - No gradients, no drop shadows, no glassmorphism, no emoji.
  - No em dashes in copy.
  - Names, never "me".

  "SaaS" here means a tighter grid, better density and smarter structure, not a new visual language.
- **Nothing is ever sent, posted or booked without a partner pressing the exact approval.** The design must make that obvious, not hide it.

## Structure

### 1. Agent briefing (top-left, the hero)

Copilot speaks first, in two or three short serif lines. For example: "Good morning, Shane. Since 6 AM I read 34 guest conversations, drafted 4 review replies and created 2 tasks. **3 things need you**, the most urgent is Lee's inquiry, which expires in 3h."

Under it, a status line: a live dot for "Copilot is watching", then "Last check 9:12 AM", then "Next 9:17".

### 2. Decision queue (the core, beside or under the briefing)

The 3 to 6 items that need a human, as compact **decision cards** ranked by urgency. Each card has:

- a source tag (Inquiry, Guest, Review, Turnover, Draft, Reminder);
- a one-line title;
- Copilot's proposed action with its reason ("I drafted a reply from the Knowledge Hub: wifi is in the welcome book");
- the time pressure;
- buttons:
  - **Approve or Send** (primary), only where a draft exists;
  - **Edit**, which opens the drawer;
  - **Not now**.

Approving a card collapses it with a quiet "Sent 9:14 AM · Undo" line. "N more" opens the full queue in the drawer.

### 3. Pulse tiles (a compact bento grid)

About 8 small tiles, each about 1/4 or 1/3 width, about 120px tall:

- Guests waiting
- Inquiries
- Turnovers today
- Reviews
- Tasks
- Reminders
- Automations
- Connections

Each tile has:

- the number, big, in mono;
- a state word in its status color: OK, Needs you, Overdue, Failed;
- the single most important line, e.g. "Roseglor 11:00 AM needs a cleaner";
- a tiny inline visual where it adds meaning:
  - the guest wait time as a thin bar;
  - turnovers as 3 day dots (today and the next two);
  - tasks as a To do / Doing / Waiting mini stacked bar;
  - automations as a run history of the last 7 runs as small squares.

Clicking a tile opens its drawer.

### 4. Agent activity (narrow right rail or bottom strip)

A live, timestamped log of what Copilot did by itself, all of it reading and preparing, never sending:

- "9:12 Read 12 guest threads, nothing new"
- "8:40 Drafted 5-star reply for Marty"
- "8:02 Created task: Assign cleaner, Roseglor"
- "5:00 Skill Review reply drafts ran, drafted 4"
- "5:00 Skill Weekly check-in texts failed: Gmail not connected" (in the danger color, with Retry)

New entries slide in at the top with a subtle highlight. The rail stays visible on desktop and becomes a collapsed "Activity" row on phone.

### 5. Ask bar suggestions (right above the existing composer)

Three contextual prompt chips Copilot suggests from the current state, e.g. "Who still needs a cleaner this week?", "Summarize Don's review", "What's due before Saturday?". Clicking one sends it to chat.

## Drill-down drawer (show it open in one frame)

A right-side drawer about 480px wide, over the Overview, with the overview dimmed. Use it for any tile or "N more". It holds that module's full list in the v1 row style, with its filters (e.g. Everyone / Shane / Ryan for tasks) and actions. Esc or × closes it. On phone it's a full-height sheet.

## Dynamic states to show

- **Busy day:** the decision queue is full, two tiles are in the warning or danger color, the activity rail is busy.
- **Quiet day:** the briefing says "All clear. I checked guests, reviews, turnovers, tasks and 4 automations at 9:12 AM. Nothing needs you." The decision queue is replaced by a small "Nothing to decide" state, the tiles show calm OK states, and the activity rail stays.
- **Something broken:** e.g. Hospitable disconnected. A slim banner above the briefing, "Hospitable stopped answering at 8:55. Guest messages may be stale. Reconnect", and every affected tile says "Paused".

## Frames to return

1. Busy, desktop 1440×900, light, no scroll.
2. Busy, dark.
3. Quiet, light.
4. Busy with the Reviews drawer open.
5. Broken-connection state.
6. Phone 390: the briefing, then the decision cards as a swipeable stack, then the tiles in 2 columns, then Activity collapsed.

Use the same realistic sample data as v1:
- Alyssa at 41 Roseglor Cres asking for the wifi, waiting 12 min.
- Lee's inquiry for Nov 5–8, expiring in 3h.
- Don's 3-star review, flagged.
- Marty and Jenny's 5-star review, drafted.
- Roseglor's turnover today at 11:00 AM, needs a cleaner.
- Reminders: "Purchase supplies for roya unit" and "Call city for raj unit", both 1 day outstanding.
- Task: "Finish groceries flow", Shane, due Sat Oct 17.
- Draft: the parking registration email for 20 Blue Jays Way.
- Skills: Review reply drafts, daily at 5:00 AM. Weekly check-in texts, Mondays at 9:00 AM.
