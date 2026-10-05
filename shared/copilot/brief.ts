import { getSupabaseAdmin } from "../supabase.js";
import { addDays, greeting, torontoToday } from "./time.js";
import type { BriefCard, BriefPayload } from "./types.js";
import { listDismissed, listDueReminders } from "./store.js";

const MAX_CARDS = 4;

function take(cards: BriefCard[], next: BriefCard, skipped: Set<string>) {
  if (skipped.has(next.id) || cards.length >= MAX_CARDS) return;
  cards.push(next);
}

export async function buildBrief(now = new Date()): Promise<BriefPayload> {
  const greet = greeting(now);
  const today = torontoToday(now);
  const tomorrow = addDays(today, 1);
  const focus: BriefCard[] = [];
  const eating: BriefCard[] = [];
  const skipped = new Set(await listDismissed().catch(() => []));
  const sb = getSupabaseAdmin();

  if (sb) {
    const { data: contracts } = await sb
      .from("pm_contracts")
      .select("id, title, status, client_id")
      .eq("status", "awaiting_signature")
      .order("created_at", { ascending: false })
      .limit(3);
    const clientIds = [
      ...new Set((contracts ?? []).map((c) => c.client_id).filter(Boolean)),
    ] as string[];
    const names = new Map<string, string>();
    if (clientIds.length) {
      const { data: clients } = await sb.from("pm_clients").select("id, name").in("id", clientIds);
      for (const client of clients ?? []) names.set(client.id as string, client.name as string);
    }
    for (const contract of contracts ?? []) {
      const name = (contract.client_id && names.get(contract.client_id as string)) || "A client";
      take(focus, {
        id: `contract:${contract.id}`,
        group: "focus",
        text: `${name} hasn't signed ${contract.title || "the contract"}. Let's get them going.`,
        action: "Draft a message",
        source: "Clients",
      }, skipped);
    }

    const { data: stays } = await sb
      .from("pm_reservations")
      .select("id, check_in, check_out, property_id")
      .gte("check_in", today)
      .lte("check_in", tomorrow)
      .limit(6);
    const propertyIds = [
      ...new Set((stays ?? []).map((s) => s.property_id).filter(Boolean)),
    ] as string[];
    const properties = new Map<string, string>();
    if (propertyIds.length) {
      const { data: rows } = await sb.from("pm_properties").select("id, name").in("id", propertyIds);
      for (const row of rows ?? []) properties.set(row.id as string, row.name as string);
    }
    for (const stay of stays ?? []) {
      if (focus.length + eating.length >= MAX_CARDS) break;
      const place = properties.get(stay.property_id as string) || "a unit";
      const when = stay.check_in === today ? "today" : "tomorrow";
      take(focus, {
        id: `stay:${stay.id}`,
        group: "focus",
        text: `A guest checks in ${when} at ${place}. Confirm the arrival details before they arrive.`,
        action: "Draft the arrival note",
        source: "Hospitable",
      }, skipped);
    }

    const { data: tasks } = await sb
      .from("pm_tasks")
      .select("id, title, due_on, status, priority, task_type")
      .eq("due_on", today)
      .in("status", ["open", "in_progress"])
      .limit(8);
    for (const task of tasks ?? []) {
      if (focus.length + eating.length >= MAX_CARDS) break;
      const urgent =
        task.priority === "high" ||
        task.task_type === "cleaning" ||
        task.task_type === "maintenance";
      if (!urgent) continue;
      take(eating, {
        id: `task:${task.id}`,
        group: "eating",
        text: `${task.title} is due today.`,
        action: "Draft the next step",
        source: "Today only",
      }, skipped);
    }
  }

  const reminders = await listDueReminders(today).catch(() => []);
  for (const reminder of reminders) {
    if (focus.length + eating.length >= MAX_CARDS) break;
    take(focus, {
      id: `reminder:${reminder.id}`,
      group: "focus",
      text: `You asked me to remind you: ${reminder.text}`,
      action: "Open the follow-up",
      source: "Reminder",
    }, skipped);
  }

  const all = [...focus, ...eating].slice(0, MAX_CARDS);
  return {
    hello: greet.hello,
    line: greet.line,
    quiet: all.length === 0,
    focus: all.filter((c) => c.group === "focus"),
    eating: all.filter((c) => c.group === "eating"),
  };
}
