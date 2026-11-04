/**
 * What a guest thread implies someone still has to do, read from the thread's own words. A detector only speaks when it can
 * quote the line that triggered it, and only about facts in this guest's own thread.
 */

import { vehiclesFromThread } from "./guestVehicle.js";

export type ThreadMsg = { at: string; role: string; name: string; body: string };

export type ThreadAction = {
  kind: "building_email" | "confirm_early_checkin" | "house_rules_confirmation";
  /** The thread line that triggered it. */
  quote: { who: string; at: string; text: string };
  /** What was agreed, such as the early check-in time. */
  detail: string;
};

const isGuest = (message: ThreadMsg) => message.role === "guest";
const byTime = (a: ThreadMsg, b: ThreadMsg) => a.at.localeCompare(b.at);

/** "1 PM", "1:30pm", "noon" as { clock: "13:30", label: "1:30 PM" }. */
export function parseClock(text: string): { clock: string; label: string } | null {
  if (/\bnoon\b/i.test(text)) return { clock: "12:00", label: "12:00 PM" };
  const match = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)/i.exec(text);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const pm = /^p/i.test(match[3]!);
  if (hour < 1 || hour > 12 || minute > 59) return null;
  if (pm && hour < 12) hour += 12;
  if (!pm && hour === 12) hour = 0;
  return { clock: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`, label: `${hour % 12 === 0 ? 12 : hour % 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}` };
}

const EARLY = /\b(?:early check-?in|check-?in (?:at|from|around|is|works)|check in (?:at|from|around)|come (?:in )?(?:at|from)|arrive (?:at|from|around)|welcome to (?:check|come|arrive))\b/i;
const AGREE = /\b(?:yes|sure|works|work for us|fine|ok(?:ay)?|can do|no problem|happy to|that'?s fine|go ahead|approved|absolutely|we can|you can|you're welcome|you are welcome)\b/i;
const TENTATIVE = /\b(?:let me check|i'?ll check|i will check|i'?ll see|i will see|not sure|can'?t promise|might|if possible|i'?ll let you know)\b/i;

const RULES = /\bhouse rules\b/i;
const ACCEPTED = /\b(?:agree|agreed|accept|accepted|confirm|confirmed|have read|i read|read them|understood|will follow|will abide|sounds good|got it|i do)\b/i;

/** The pending actions a thread implies for this stay. Verification against the record is the caller's. */
export function threadActions(input: { guest: string; address: string; messages: ThreadMsg[] }): ThreadAction[] {
  const messages = [...input.messages].sort(byTime);
  const out: ThreadAction[] = [];

  // Car details provided: the building has to be told, but only at the one building that has a registration process.
  if (/blue jays|\b318\b/i.test(input.address)) {
    const car = vehiclesFromThread(messages.map((m) => ({ at: m.at, role: m.role, body: m.body })), input.guest);
    if (car.vehicles.length) out.push({ kind: "building_email", quote: { who: input.guest, at: car.at, text: car.quote }, detail: "vehicle details" });
  }

  // Early check-in agreed by the host with a time, and no later host line confirming it back.
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]!;
    if (isGuest(message) || !EARLY.test(message.body) || !AGREE.test(message.body) || TENTATIVE.test(message.body)) continue;
    const when = parseClock(message.body);
    if (!when) continue;
    const confirmedAfter = messages.slice(index + 1).some((row) => !isGuest(row) && /\bconfirm/i.test(row.body) && parseClock(row.body)?.clock === when.clock);
    if (!confirmedAfter) out.push({ kind: "confirm_early_checkin", quote: { who: message.name || "Host", at: message.at, text: message.body.trim().slice(0, 240) }, detail: `${when.clock}|${when.label}` });
    break;
  }

  // House rules sent, and the guest never said they agree.
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]!;
    if (isGuest(message) || !RULES.test(message.body)) continue;
    const answered = messages.slice(index + 1).some((row) => isGuest(row) && ACCEPTED.test(row.body));
    if (!answered) out.push({ kind: "house_rules_confirmation", quote: { who: message.name || "Host", at: message.at, text: message.body.trim().slice(0, 240) }, detail: "house rules" });
    break;
  }
  return out;
}
