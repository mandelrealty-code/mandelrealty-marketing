/**
 * Phase (a) of every watch pass: a cheap, deterministic look at the business, compared with the last pass. No model is
 * involved. The snapshot is only the facts that can change what a partner needs: the reservation list and each thread's
 * newest message time, check-ins and check-outs today, task and review counts, and the newest mail and chat.
 */

import { searchGmail } from "../adminApi/gmail.js";
import { searchOutlook } from "../adminApi/outlook.js";
import { listChats } from "./store.js";
import { loadConversations } from "./stayCheck.js";
import { loadReviewQueue } from "./reviewsQueue.js";
import { boardPayload } from "./taskBoardApi.js";
import { isOpen } from "./taskTypes.js";
import { torontoToday } from "./time.js";

export type Snapshot = { day: string; conv: Record<string, string>; ins: string[]; outs: string[]; tasks: string; reviews: string; mail: string; chat: string };

export async function takeSnapshot(now: Date): Promise<{ snapshot: Snapshot | null; failed: string[] }> {
  const day = torontoToday(now);
  const failed: string[] = [];
  const conv: Record<string, string> = {};
  const ins: string[] = [];
  const outs: string[] = [];
  try {
    const loaded = await loadConversations(now);
    if (loaded.failed.length) failed.push("Reservations");
    for (const row of loaded.conversations) {
      conv[row.stay.id] = `${row.stay.status}|${row.stay.checkIn}|${row.stay.checkOut}|${row.lastMessageAt}`;
      if (row.stay.checkIn.slice(0, 10) === day) ins.push(row.stay.id);
      if (row.stay.checkOut.slice(0, 10) === day) outs.push(row.stay.id);
    }
  } catch {
    failed.push("Reservations");
  }
  let tasks = "none";
  try {
    const board = await boardPayload({ name: "Shane", partner: true });
    if (board.ready) {
      const open = board.tasks.filter(isOpen);
      tasks = `${open.length}|${board.tasks.length}|${board.tasks.map((task) => task.updatedAt ?? "").sort().at(-1) ?? ""}`;
    }
  } catch {
    failed.push("Tasks");
  }
  let reviews = "none";
  try {
    const queue = await loadReviewQueue(now);
    reviews = queue.connected ? `${queue.reviews.length}|${queue.reviews.filter((row) => row.flagged).length}|${queue.reviews[0]?.id ?? ""}` : "off";
  } catch {
    failed.push("Reviews");
  }
  let mail = "none";
  try {
    const newest = async <T extends { id: string; date: string }>(rows: Promise<T[]>) => [...(await rows)].sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0];
    const [g, o] = await Promise.all([
      newest(searchGmail({ keywords: "", where: "both", includeAirbnb: false, limit: 3 }).catch(() => [])),
      newest(searchOutlook({ keywords: "", where: "both", includeAirbnb: false, limit: 3 }).catch(() => [])),
    ]);
    mail = `${g?.id ?? ""}|${o?.id ?? ""}`;
  } catch {
    failed.push("Mail");
  }
  let chat = "none";
  try {
    chat = (await listChats()).map((row) => row.updated_at).sort().at(-1) ?? "none";
  } catch {
    failed.push("Chats");
  }
  // A read that failed can't confirm "nothing changed".
  return { snapshot: failed.includes("Reservations") ? null : { day, conv, ins, outs, tasks, reviews, mail, chat }, failed };
}

export type Change = { changed: boolean; reasons: string[]; /** Threads worth a deep read this pass. */ threads: Set<string>; mailOrChat: boolean };

/** What differs from the last pass, and which threads that makes worth reading. Nothing different means nothing to triage. */
export function diffSnapshots(prev: Snapshot | null, cur: Snapshot): Change {
  const reasons: string[] = [];
  const threads = new Set<string>();
  if (!prev) return { changed: true, reasons: ["first pass"], threads: new Set(Object.keys(cur.conv)), mailOrChat: true };
  if (prev.day !== cur.day) reasons.push("a new day");
  const moved = Object.keys(cur.conv).filter((id) => prev.conv[id] !== cur.conv[id]);
  const gone = Object.keys(prev.conv).filter((id) => !(id in cur.conv));
  if (moved.length) reasons.push(`${moved.length} reservation${moved.length === 1 ? "" : "s"} changed or got a new message`);
  if (gone.length) reasons.push(`${gone.length} reservation${gone.length === 1 ? "" : "s"} gone from the list`);
  for (const id of moved) threads.add(id);
  // Check-ins and check-outs today always deserve a look at their threads.
  for (const id of [...cur.ins, ...cur.outs]) threads.add(id);
  if ((cur.ins.length || cur.outs.length) && (prev.day !== cur.day || prev.ins.join() !== cur.ins.join() || prev.outs.join() !== cur.outs.join())) reasons.push("check-ins or check-outs today");
  if (prev.tasks !== cur.tasks) reasons.push("tasks changed");
  if (prev.reviews !== cur.reviews) reasons.push("reviews changed");
  if (prev.mail !== cur.mail) reasons.push("new mail");
  if (prev.chat !== cur.chat) reasons.push("chat activity");
  return { changed: reasons.length > 0, reasons, threads, mailOrChat: prev.mail !== cur.mail || prev.chat !== cur.chat || prev.tasks !== cur.tasks };
}
