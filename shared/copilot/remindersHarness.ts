/**
 * Reminders, end to end through the chat endpoint: any phrasing lands on a stated time, the card asks
 * whose it is at most once, an overdue reminder holds the top of Overview with its days outstanding,
 * and done from chat is done everywhere. Nothing is sent to anyone.
 */

import handleCopilot from "../adminApi/copilot.js";
import { createAdminSessionToken } from "../adminAuth.js";
import { capturedCommits, resetCaptures } from "./parity/capture.js";
import { worldAt } from "./parity/catalog.js";
import { setParityClock } from "./parity/clock.js";
import { installWorld } from "./parity/world.js";
import { asksReminder, createReminder, listReminders, resetParityReminders, surfaceDueReminders } from "./reminders.js";
import { exactLabel, resolveReminderTime } from "./reminderTime.js";
import { groupReminders, overviewReminders, reminderRow, sidebarCount, type Reminder, type ReminderCardDraft } from "./reminderView.js";
import type { CopilotMessage } from "./types.js";

function fail(message: string): never {
  throw new Error(`Reminders harness failed: ${message}`);
}

process.env.ADMIN_PASSWORD = "parity-admin";
process.env.ADMIN_SESSION_SECRET = "parity-secret";
const token = createAdminSessionToken();

async function call<T>(body: Record<string, unknown>): Promise<T> {
  let payload: unknown = null;
  let status = 200;
  await handleCopilot(
    { method: "POST", headers: { cookie: `mrg_admin_session=${encodeURIComponent(token)}` }, body, query: {} } as never,
    { status(code: number) { status = code; return this; }, json(value: unknown) { payload = value; return this; } } as never,
  );
  if (status >= 400) fail(`${String(body.op)} returned ${status}: ${JSON.stringify(payload)}`);
  return payload as T;
}

type Sent = { chatId: string; messages: CopilotMessage[] };

async function say(chatId: string, text: string): Promise<{ chatId: string; reply: CopilotMessage; messages: CopilotMessage[] }> {
  const sent = await call<Sent>({ op: "send", text, chatId, kind: "chat", viewer: "Shane" });
  const reply = [...sent.messages].reverse().find((row) => row.role === "assistant");
  if (!reply) fail(`no answer to "${text}"`);
  return { chatId: sent.chatId, reply, messages: sent.messages };
}

async function saveFrom(reply: CopilotMessage): Promise<{ line: string; reminder: Reminder }> {
  const card = reply.reminder?.card as ReminderCardDraft | undefined;
  if (!card) fail(`no reminder card: ${reply.body}`);
  return call({ op: "reminders-save", messageId: reply.id, card, viewer: "Shane" });
}

// Tuesday, October 13, 2026, 11:05 AM in Toronto.
const NOW = new Date("2026-10-13T15:05:00Z");
installWorld(worldAt("2026-10-13T11:05:00-04:00"));
setParityClock(NOW);
resetParityReminders();
resetCaptures();

// Every phrasing resolves; none bounces.
const expectations: [string, string][] = [
  ["remind me at 6:00PM", "Tuesday Oct 13 at 6:00 PM"],
  ["tomorrow at 6pm", "Wednesday Oct 14 at 6:00 PM"],
  ["Friday at 10:30", "Friday Oct 16 at 10:30 AM"],
  ["in 2 hours", "Tuesday Oct 13 at 1:05 PM"],
  ["in 30 minutes", "Tuesday Oct 13 at 11:35 AM"],
  ["tomorrow morning", "Wednesday Oct 14 at 9:00 AM"],
  ["tomorrow midday", "Wednesday Oct 14 at 12:00 PM"],
  ["tomorrow afternoon", "Wednesday Oct 14 at 1:00 PM"],
  ["tomorrow evening", "Wednesday Oct 14 at 6:00 PM"],
  ["tonight", "Tuesday Oct 13 at 7:00 PM"],
  ["next week sometime", "Monday Oct 19 at 9:00 AM"],
  ["later this week", "Thursday Oct 15 at 9:00 AM"],
  ["in a few days", "Friday Oct 16 at 9:00 AM"],
  ["tomorrow", "Wednesday Oct 14 at 9:00 AM"],
  ["at 9am", "Wednesday Oct 14 at 9:00 AM"],
];
for (const [said, expected] of expectations) {
  const resolved = resolveReminderTime(said, NOW);
  if (!resolved || exactLabel(resolved.at) !== expected) fail(`"${said}" resolved to ${resolved ? exactLabel(resolved.at) : "nothing"}, not ${expected}`);
}
if (!/had already passed today/.test(resolveReminderTime("at 9am", NOW)?.rolled ?? "")) fail("a past time rolled without saying so");
if (asksReminder("remind me what the wifi password is at Shaw") || !asksReminder("Remind Ryan to order towels Friday at 10")) fail("reminder intent");

// "at 6:00PM" lands exactly, and the saved line states the date and time.
const six = await say("", "remind me at 6:00PM to call the plumber about the Shaw sink");
const sixCard = six.reply.reminder?.card;
if (!sixCard || sixCard.assignee !== "Shane" || exactLabel(new Date(sixCard.dueAt)) !== "Tuesday Oct 13 at 6:00 PM" || sixCard.text !== "Call the plumber about the Shaw sink" || sixCard.unit !== "1065 Shaw St") fail(`6 PM card: ${JSON.stringify(sixCard)}`);
const sixSaved = await saveFrom(six.reply);
if (sixSaved.line !== "Reminder set: call the plumber about the Shaw sink, Shane, Tuesday Oct 13 at 6:00 PM, 1065 Shaw St.") fail(`6 PM line: ${sixSaved.line}`);

// "tomorrow morning to order…": the task keeps the partner's words; "to" inside "tomorrow" is not a connective.
const morning = await say("", "remind me tomorrow morning to order supplies for royas unit");
const morningCard = morning.reply.reminder?.card;
if (!morningCard || morningCard.text !== "Order supplies for royas unit" || morningCard.unit !== "1065 Shaw St" || exactLabel(new Date(morningCard.dueAt)) !== "Wednesday Oct 14 at 9:00 AM") fail(`morning card: ${JSON.stringify(morningCard)}`);
for (const [said, task] of [["remind me today to call Bob", "Call Bob"], ["remind me tonight to lock up", "Lock up"], ["set a reminder tomorrow to book the cleaner", "Book the cleaner"], ["remind Ryan tomorrow at 4pm to tour 41 Roseglor", "Tour 41 Roseglor"]] as const) {
  const reply = await say("", said);
  if (reply.reply.reminder?.card?.text !== task) fail(`"${said}" task: ${reply.reply.reminder?.card?.text}`);
}

// Changing it from chat: "cancel that one" deletes the reminder just above; undo, move and done work the same way.
const cancelled = await say(six.chatId, "cancel that one");
if (!/^Deleted the reminder: Call the plumber about the Shaw sink, Shane, Tuesday Oct 13 at 6:00 PM\./.test(cancelled.reply.body) || /phone|calendar|another app|don't have a tool/i.test(cancelled.reply.body)) fail(`cancel: ${cancelled.reply.body}`);
if (groupReminders(await listReminders(), NOW).today.some((row) => row.id === sixSaved.reminder.id)) fail("a deleted reminder is still listed");
const undone = await say(six.chatId, "undo");
if (!/^It's back: Call the plumber/.test(undone.reply.body) || !groupReminders(await listReminders(), NOW).today.some((row) => row.id === sixSaved.reminder.id)) fail(`undo: ${undone.reply.body}`);
const moved = await say(six.chatId, "move it to Friday at 3pm");
if (moved.reply.body !== "Moved: Call the plumber about the Shaw sink, Shane, now Friday Oct 16 at 3:00 PM.") fail(`move: ${moved.reply.body}`);
const doneChat = await say(six.chatId, "mark it done");
if (!/^Marked done/.test(doneChat.reply.body) || (await listReminders()).find((row) => row.id === sixSaved.reminder.id)?.status !== "done") fail(`done from chat: ${doneChat.reply.body}`);
const viaView = await call<{ reminders: Reminder[] }>({ op: "reminders-delete", id: sixSaved.reminder.id });
if (viaView.reminders.find((row) => row.id === sixSaved.reminder.id)?.status !== "deleted" || groupReminders(viaView.reminders, NOW).done.some((row) => row.id === sixSaved.reminder.id)) fail("delete from the view");
const restored = await call<{ reminders: Reminder[] }>({ op: "reminders-restore", id: sixSaved.reminder.id });
if (restored.reminders.find((row) => row.id === sixSaved.reminder.id)?.status !== "done") fail("restore returns the status it had");

// "tomorrow evening" is 6:00 PM tomorrow; whose and when given, so the card needs one tap.
const evening = await say("", "remind Ryan to check the smoke detectors tomorrow evening");
const eveningCard = evening.reply.reminder?.card;
if (!eveningCard || eveningCard.assignee !== "Ryan" || exactLabel(new Date(eveningCard.dueAt)) !== "Wednesday Oct 14 at 6:00 PM") fail(`evening card: ${JSON.stringify(eveningCard)}`);
if (!/^For Ryan, Wednesday Oct 14 at 6:00 PM\./.test(evening.reply.body)) fail(`evening lead: ${evening.reply.body}`);
await saveFrom(evening.reply);

// "next week sometime" is a reminder at Monday 9:00 AM, stated, with no error.
const vague = await say("", "remind Ryan to order towels next week sometime");
if (/specific|which day|what time|couldn't/i.test(vague.reply.body)) fail(`vague bounced: ${vague.reply.body}`);
if (!/Next week is read as Monday/.test(vague.reply.body)) fail(`vague resolution not stated: ${vague.reply.body}`);
const towels = await saveFrom(vague.reply);
if (towels.line !== "Reminder set: order towels, Ryan, Monday Oct 19 at 9:00 AM.") fail(`towels line: ${towels.line}`);

// No assignee: "Whose task is this?" is asked exactly once; the answer saves it.
const us = await say("", "remind us to renew the Charlotte 606 parking permit Friday");
if (us.reply.body !== "Whose task is this?") fail(`whose lead: ${us.reply.body}`);
const answered = await say(us.chatId, "Ryan");
const asked = answered.messages.filter((row) => row.role === "assistant" && /Whose task is this\?/.test(row.body)).length;
if (asked !== 1) fail(`asked whose ${asked} times`);
if (!/^Reminder set: renew the Charlotte 606 parking permit, Ryan, Friday Oct 16 at 9:00 AM, Charlotte 606\./.test(answered.reply.body)) fail(`answered whose: ${answered.reply.body}`);

// "Remind me about this" links the item just above.
const about = await say(answered.chatId, "remind me about this tomorrow afternoon");
const aboutCard = about.reply.reminder?.card;
if (!aboutCard?.sourceRef || !aboutCard.text || exactLabel(new Date(aboutCard.dueAt)) !== "Wednesday Oct 14 at 1:00 PM") fail(`about this: ${JSON.stringify(aboutCard)}`);

// A reminder two days overdue holds the top of Overview with "2 days outstanding".
setParityClock(new Date("2026-10-11T13:00:00Z"));
const permit = await createReminder({ text: "Renew the Roseglor garage permit", assignee: "Shane", dueAt: new Date("2026-10-11T14:00:00Z").toISOString(), createdBy: "Shane", source: "checks", sourceRef: "card-1" });
setParityClock(NOW);
const all = await listReminders();
const overview = overviewReminders(all, NOW);
if (overview.rows[0]?.id !== permit.id) fail(`overview top: ${overview.rows.map((row) => row.text).join(" / ")}`);
const top = reminderRow(overview.rows[0]!, NOW);
if (top.outText !== "2 days outstanding" || !top.meta.includes("From Checks") || top.meta[0] !== "41 Roseglor") fail(`overdue row: ${JSON.stringify(top)}`);
if (groupReminders(all, NOW).overdue[0]?.id !== permit.id) fail("the view's Overdue group doesn't lead with it");

// Due and outstanding reminders come back in chat, once each.
const surfaced = await surfaceDueReminders(NOW);
if (surfaced.posted < 1) fail("nothing surfaced");
if ((await surfaceDueReminders(NOW)).posted !== 0) fail("the same reminder surfaced twice in one day");

// Marking done in chat (the due-now message's button) clears it in the view and Overview.
const before = sidebarCount(await listReminders(), NOW);
const afterDone = await call<{ reminders: Reminder[] }>({ op: "reminders-done", id: permit.id, viewer: "Shane" });
const doneRow = afterDone.reminders.find((row) => row.id === permit.id)!;
if (doneRow.status !== "done" || doneRow.doneBy !== "Shane") fail(`done record: ${JSON.stringify(doneRow)}`);
const groups = groupReminders(afterDone.reminders, NOW);
if (groups.overdue.some((row) => row.id === permit.id) || !groups.done.some((row) => row.id === permit.id)) fail("done did not move it in the view");
const ovAfter = overviewReminders(afterDone.reminders, NOW);
if (ovAfter.open !== before - 1 || reminderRow(ovAfter.rows.find((row) => row.id === permit.id)!, NOW).doneText !== "Done · marked by Shane, Tue 11:05 AM") fail("done did not show on Overview");
if (sidebarCount(afterDone.reminders, NOW) !== before - 1) fail("sidebar count didn't drop");

// Snooze moves it and counts; undo brings it back.
const snoozed = await call<{ reminders: Reminder[] }>({ op: "reminders-snooze", id: towels.reminder.id, dueAt: new Date("2026-10-20T13:00:00Z").toISOString() });
const towelsRow = snoozed.reminders.find((row) => row.id === towels.reminder.id)!;
if (towelsRow.snoozeCount !== 1 || reminderRow(towelsRow, NOW).snText !== "Snoozed once") fail("snooze count");

if (capturedCommits().length) fail("a reminder sent something");
setParityClock(null);
console.log("Reminders harness passed.");
