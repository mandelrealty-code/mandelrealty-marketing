# Cursor prompt: build the Copilot Overview v2 from the Claude Design HTML

Put the Claude Design export at `design-prompts/overview-v2.html` (a single self-contained file, including the "Copilot Overview Frame" component). Then paste everything below the line into Cursor (Agent mode).

---

Build the new Copilot **Overview** screen from the design at `design-prompts/overview-v2.html`. Match it exactly: layout, spacing, type, colors, states and copy style. Wire every element to real data. Work only in this repo.

## Repo context

- **Stack:** Vite + React (TypeScript) frontend. The API is Vercel `api/admin.ts`, which routes to `shared/adminApi/*`. Copilot logic lives in `shared/copilot/*`. It's live at admin.mandelrealtygroup.com/copilot.
- **The current Overview** is `OverviewHome` in `src/pages/copilot/CopilotApp.tsx` (about line 262). Its ranking is in `shared/copilot/overviewRank.ts`, and its reminders block is `OverviewReminders` in `src/pages/copilot/RemindersUi.tsx`. Its styles are the `.cp-ov-*` rules in `src/pages/copilot/copilot.css`. Replace that screen, and leave the top bar, sidebar and pinned chat composer unchanged.
- **New code goes in a new component:** `src/pages/copilot/OverviewV2.tsx`. Prefix every new class `cp-ov2-` and scope the CSS under it. Class collisions have broken screens here twice before (e.g. `.cp-rv-*` was shared by Reviews and the report viewer). Don't reuse or override any existing class name.
- **Theme:** use the existing tokens on `.cp` / `.cp[data-theme="dark"]` (`--canvas --side --surface --tint --ink --ink2 --muted --line --line2 --accent-fill --accent-hover --accent-ink --on-accent --needs --info --failed --wash --desk`, plus `--ok` where already defined). Never hard-code colors. Fonts are already loaded: Instrument Sans for the UI, Source Serif 4 for the serif text, JetBrains Mono for numbers.

## Data sources: use these, invent nothing

The client calls `api(op, body)` in CopilotApp.tsx. The helper owns `op`. Sub-actions travel as `action`.

| Overview element | Where the data comes from |
|---|---|
| Briefing, last check | `boot` GET → `brief` (`shared/copilot/brief.ts`), plus `refresh-brief` |
| Guests waiting, inquiries, on-the-guest | `guestQueue` (GuestQueue in `shared/copilot/guestTypes.ts`: `waiting`, `onGuest`, `held`, `followUps` (inquiries with `expiresAt`), `quiet`). Keep it live with the existing `guests-refresh` loop in CopilotApp (it already runs on every screen) |
| Reviews, flagged, retaliation | `reviews-queue` → ReviewQueuePayload (`shared/copilot/reviewTypes.ts`: `flagged`, `retaliation.level`, `stars`, `when`, `note`) |
| Tasks (counts by status, due, assignee) | `tasks-board` → `boardPayload` (`shared/copilot/taskBoardApi.ts`); actions go through `tasks-action` with `action` |
| Reminders (overdue, today) | `reminders-surface`; `sidebarCount` and `groupReminders` in `shared/copilot/reminderView.ts`; actions `reminders-done`, `reminders-snooze` |
| Turnovers / arrivals / departures, today and the next 2 days | `loadDayBoard` in `shared/copilot/dayBoard.ts` (`arrivals`, `departures`, TurnoverRow `assigned` / `overdue`). There's no op for it yet: add a read-only `overview-day` op in `shared/adminApi/copilot.ts` that returns it |
| Drafts waiting for approval | held chat drafts (`messages`/`card` data in boot `chats`), guest drafts (`guestQueue` rows with `sendable`), review drafts |
| Chat follow-ups | boot `chats` (title, updated time); `runningChatIds` |
| Automations / skills | boot `skills` (SkillRow = skill + `lastRun`: status, time, output); `run-skill` for Retry |
| Connections | boot `connectors` (ConnectorRow) and `hospitable` |

**Agent activity feed:** there's no feed yet. Add a read-only `overview-activity` op that builds the feed only from records that already exist:
- skill `lastRun`s;
- the brief's pass time;
- tasks created by Copilot (`source.kind === "copilot"`, with their creation activity);
- review drafts written (the `review-ai|` rows);
- guest-queue refresh times.

Each entry is `{ at, text, tone: "ok" | "needs" | "failed", link }`, in Toronto time, newest first, capped at 30. **Never fabricate an entry.** If a source isn't available, it contributes nothing.

**Cleaning in progress / Cleaned states:** there's no data for them. Render those slots only when data exists (it doesn't yet), so they're absent, never faked.

## Behavior rules (non-negotiable)

1. **Nothing is ever sent, posted or booked without a partner pressing the exact approval.** "Approve" or "Send" on a decision card must call the same existing op the full screen uses (`guests-submit`, `reviews-submit`, `send`, `draft`, …) with the same payload. Then show the design's "Sent h:mm · Undo" line. No auto-send, no batch-approve, no background sends.
2. **Decision queue:** a ranked mix across sources (inquiry expiring, guest waiting longest, flagged review, unassigned turnover today, overdue reminder, draft waiting). Put the ranking in a pure function in `shared/copilot/overviewRank.ts` (extend it, don't fork it) so it can be tested.
3. **Drawer:** clicking a tile or "N more" opens the right-side drawer (a full-height sheet on phone) with that module's full list and actions. Reuse the existing screens' logic where possible. Esc closes it, focus is trapped while open, and focus returns to the trigger.
4. **One viewport:** the busy day fits 1440×900 with no page scroll. Overflow goes into drawers.
5. **Live:** tiles update from the existing polling. A new item gets the design's highlight for a few seconds. Respect `prefers-reduced-motion`.
6. **Copy:**
   - Toronto time everywhere ("Wed Oct 14, 9:00 AM").
   - Names, never "me" or "you", for assignees.
   - No em dashes in any UI text. A shared `withoutEmDashes` exists in `shared/copilot/guestTranslate.ts`.
7. **Phone (390px):** follow the design's phone frame. Targets are at least 44px, 16px gutters, and no horizontal scroll. Inputs are at least 16px font so iOS doesn't zoom (the app is a PWA).
8. **Accessibility:** buttons are real `<button>`s with labels, tiles are keyboard-reachable, and the drawer has `role="dialog"` with `aria-modal`.
9. **Remove the old Overview** (`OverviewHome` and the unused `.cp-ov-*` rules) only once nothing references them. Keep the sidebar count badges working.

## Tests and acceptance (all required before you commit)

- TypeScript is clean for both configs: `npx tsc -p tsconfig.node.json --noEmit` and `npx tsc -p tsconfig.app.json --noEmit`.
- `npm run -s build` passes.
- All suites are green. Script names end in `-harness`, except parity:
  - `npm run -s parity`
  - `npm run -s skill-harness`
  - `npm run -s proposal-harness`
  - `npm run -s purchase-harness`
  - `npm run -s web-harness`
  - `npm run -s business-harness`
  - `npm run -s browser-harness`
  - `npm run -s hospitable-harness`
  - `npm run -s reviews-harness`
  - `npm run -s guest-harness`
  - `npm run -s guidelines-harness`
  - `npm run -s golden-harness`
  - `npm run -s payout-harness`
  - `npm run -s report-harness`
  - `npm run -s upsell-harness`
  - `npm run -s reminders-harness`
  - `npm run -s tasks-harness`
- **Add `shared/copilot/overviewHarness.ts`** with an `"overview-harness"` script that runs with `COPILOT_PARITY=1 NODE_ENV=test`. It uses the parity world (`installWorld`, `setParityClock`, `capturedCommits` in `shared/copilot/parity/*`) and proves:
  - the decision ranking order (an expiring inquiry comes before a waiting guest, which comes before a flagged review, which comes before an overdue reminder);
  - every activity entry maps to a real record, and an empty world gives an empty feed;
  - building the Overview payload commits nothing: `capturedCommits()` is empty;
  - an unassigned turnover today appears, and an assigned one doesn't need a decision.
- Check it in the browser at 1440×900 (busy, no scroll), in dark mode, and at 390px.
- Commit to `main` with a clear message ending with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, then push. Confirm the Vercel production deploy is on your commit: `gh api repos/mandelrealty-code/mandelrealty-marketing/deployments?environment=Production` (the latest has your SHA) and the commit status is `success`.
- Report the commit SHA, the files changed, and anything in the design you couldn't wire to real data (and why).

If something in the design needs data this repo doesn't have, don't simulate it. Leave the slot out and list it in your report.
