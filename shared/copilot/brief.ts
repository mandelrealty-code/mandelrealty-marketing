import { getSupabaseAdmin } from "../supabase.js";
import { addDays, greeting, torontoToday } from "./time.js";
import type { BriefCard, BriefPayload } from "./types.js";
import { latestInboxOffer } from "../adminApi/gmail.js";
import { latestOutlookOffer } from "../adminApi/outlook.js";
import { chooseBriefOpenItem, listOpenItems, openItemChoice, verifiedLabel } from "./openItems.js";
import { dismissCard, listDismissed, listDueReminders, listRuns, listSkills, listSupplyDrafts, listWaitingDrafts, readBriefSnapshot, readGmailOffer, saveBriefSnapshot, saveGmailOffer, type WaitingDraft } from "./store.js";
import { runsOnItsOwn } from "./skillRunner.js";
import { runUnattendedChecks } from "./stayCheck.js";
import { listConnectorFailures } from "./connectorFailures.js";
import { parityEnabled } from "./parity/flag.js";
import { purchaseCardText, recordedSupplies } from "./purchase.js";

const MAX_CARDS = 4;

function ship(cards: BriefCard[], next: BriefCard, skipped: Set<string>) {
  if (skipped.has(next.id) || cards.length >= MAX_CARDS) return;
  if (!next.headline?.trim() || !next.detail?.trim()) return;
  if (!next.action?.trim() && !next.actions?.length) return;
  const text = next.text?.trim() || `${next.headline} ${next.detail}`;
  cards.push({ ...next, text });
}

export function quietBrief(now = new Date()): BriefPayload {
  const greet = greeting(now);
  return { hello: greet.hello, line: greet.line, quiet: true, focus: [], eating: [] };
}

/** The last pass, already stored. This does not scan mail, stays, or the cleaner app. */
export async function readSavedBrief(now = new Date()): Promise<BriefPayload> {
  const saved = await readBriefSnapshot();
  return saved ?? quietBrief(now);
}

/** Rebuilds the brief off the page-load path and stores it for the next open. */
export async function refreshSavedBrief(now = new Date()): Promise<BriefPayload> {
  const brief = await buildBrief(now);
  await saveBriefSnapshot(brief);
  return brief;
}

export async function dismissSavedCard(cardId: string, now = new Date()): Promise<BriefPayload> {
  await dismissCard(cardId);
  const current = await readSavedBrief(now);
  const focus = current.focus.filter((card) => card.id !== cardId);
  const eating = current.eating.filter((card) => card.id !== cardId);
  const next = { ...current, focus, eating, quiet: focus.length + eating.length === 0 };
  await saveBriefSnapshot(next);
  return next;
}

export async function applyOpenItemOnBrief(cardId: string, label: string, now = new Date()): Promise<BriefPayload | null> {
  const applied = await chooseBriefOpenItem(cardId, label);
  if (!applied) return null;
  const choice = openItemChoice(label);
  const current = await readSavedBrief(now);
  const keep = (cards: BriefCard[]) => cards.flatMap((card) => {
    if (card.id !== cardId) return [card];
    if (choice === "closed") return [];
    return [{ ...card, action: "Open", actions: undefined }];
  });
  const focus = keep(current.focus);
  const eating = keep(current.eating);
  const next = { ...current, focus, eating, quiet: focus.length + eating.length === 0 };
  await saveBriefSnapshot(next);
  return next;
}

export async function buildBrief(now = new Date()): Promise<BriefPayload> {
  const greet = greeting(now);
  const today = torontoToday(now);
  const tomorrow = addDays(today, 1);
  const focus: BriefCard[] = [];
  const eating: BriefCard[] = [];
  const skipped = new Set(await listDismissed().catch(() => []));
  const seenSupply = new Set<string>();
  for (const row of recordedSupplies()) {
    seenSupply.add(row.confirmation);
    const card = supplyCard(row);
    if (card) ship(focus, card, skipped);
  }
  try {
    for (const row of await listSupplyDrafts()) {
      if (seenSupply.has(row.confirmation)) continue;
      const card = supplyCard(row);
      if (card) ship(focus, card, skipped);
    }
  } catch {
    /* The overview still loads when a saved order cannot be read. */
  }
  // The live page reads checks the morning and afternoon passes already saved.
  // The parity suite still runs them here, because that is how a fixture scan works.
  if (parityEnabled()) {
    try {
      await runUnattendedChecks(now);
    } catch {
      /* The overview still loads when a check cannot finish. */
    }
  }
  try {
    for (const failure of await listConnectorFailures()) {
      const headline = `${failure.connector} failed read`;
      const detail = `${failure.error} Nothing was read.`;
      ship(focus, {
        id: `failed-read:${failure.connector}`,
        group: "focus",
        headline,
        detail,
        text: `${headline}: ${failure.error}`,
        action: "Open",
        source: "Checks",
      }, skipped);
    }
  } catch {
    /* The overview still loads when connector failures cannot be read. */
  }
  try {
    const items = await listOpenItems();
    for (const item of items) {
      if (item.status !== "open") continue;
      const choices = item.askedOn === today ? undefined : ["Already upgraded", "Still pending"];
      const headline = item.text.trim();
      const detail = `Last verified ${verifiedLabel(item.verifiedOn)}. A choice here updates this item. Nothing has been changed yet.`;
      ship(focus, {
        id: `open:${item.id}`,
        group: "focus",
        headline,
        detail,
        text: `${headline}. Last verified ${verifiedLabel(item.verifiedOn)}.`,
        action: choices ? choices[0] : "Open",
        actions: choices,
        source: item.source || "Records",
      }, skipped);
    }
  } catch {
    /* The overview still loads when open items cannot be read. */
  }
  if (parityEnabled()) {
    try {
      const offer = await latestInboxOffer();
      if (offer) {
        await saveGmailOffer({ ...offer, mailbox: "gmail" });
        const card = mailCard(offer.from, offer.subject, "Gmail", offer.messageId);
        if (card) ship(focus, card, skipped);
      }
    } catch {
      /* The overview still loads when Gmail is not connected. */
    }
    try {
      const offer = await latestOutlookOffer();
      if (offer) {
        await saveGmailOffer({ ...offer, mailbox: "outlook" });
        const card = mailCard(offer.from, offer.subject, "Outlook", offer.messageId);
        if (card) ship(focus, card, skipped);
      }
    } catch {
      /* The overview still loads when Outlook is not connected. */
    }
  } else {
    try {
      const offer = await readGmailOffer();
      if (offer) {
        const where = offer.mailbox === "outlook" ? "Outlook" : "Gmail";
        const card = mailCard(offer.from, offer.subject, where, offer.messageId);
        if (card) ship(focus, card, skipped);
      }
    } catch {
      /* The overview still loads when the saved offer cannot be read. */
    }
  }
  // Today's skill reports go first, so waiting drafts cannot push them off the page.
  const skills = (await listSkills().catch(() => [])).filter((row) => row.enabled && row.chat_id && runsOnItsOwn(row));
  for (const skill of skills.slice(0, 2)) {
    const last = (await listRuns(skill.id, 1).catch(() => []))[0];
    if (!last || last.status === "running" || torontoToday(new Date(last.started_at)) !== today) continue;
    const chatId = skill.chat_id as string;
    if (!chatId) continue;
    const headline = last.status === "failed"
      ? `${skill.name} couldn't finish this time`
      : last.result?.headline
        ? `${skill.name}: ${last.result.headline}`
        : `${skill.name} finished`;
    const detail = "Opening this run shows what it did. Nothing was sent.";
    ship(focus, {
      id: `run:${last.id}`,
      chatId,
      group: "focus",
      headline,
      detail,
      text: `${headline}. ${detail}`,
      action: "Open",
      source: "Skill",
    }, skipped);
  }
  const waiting = await listWaitingDrafts().catch(() => []);
  for (const item of waiting) {
    const card = waitingDraftCard(item);
    if (card) ship(focus, card, skipped);
  }
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
      const name = (contract.client_id && names.get(contract.client_id as string)) || "";
      const title = String(contract.title || "").trim();
      if (!name || !title) continue;
      const headline = `${name} hasn't signed ${title}`;
      const detail = "Drafting a message does not send it. Nothing has been sent.";
      ship(focus, {
        id: `contract:${contract.id}`,
        group: "focus",
        headline,
        detail,
        text: `${headline}. ${detail}`,
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
    const properties = new Map<string, { name: string; address: string }>();
    if (propertyIds.length) {
      const { data: rows } = await sb.from("pm_properties").select("id, name, address").in("id", propertyIds);
      for (const row of rows ?? []) {
        properties.set(row.id as string, { name: String(row.name ?? ""), address: String(row.address ?? "") });
      }
    }
    for (const stay of stays ?? []) {
      if (focus.length + eating.length >= MAX_CARDS) break;
      const property = properties.get(stay.property_id as string);
      const place = cleanPlace(`${property?.name ?? ""} ${property?.address ?? ""}`);
      const when = spokenWhen(String(stay.check_in ?? ""));
      if (!place || !when) continue;
      const headline = `A guest checks in at ${place} on ${when}`;
      const detail = "Drafting the arrival note does not send it to the guest. Nothing has been sent.";
      ship(focus, {
        id: `stay:${stay.id}`,
        group: "focus",
        headline,
        detail,
        text: `${headline}. ${detail}`,
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
      const title = String(task.title ?? "").trim();
      const when = spokenWhen(String(task.due_on ?? today));
      if (!title || !when) continue;
      const headline = `${title} is due ${when}`;
      const detail = "Drafting the next step does not assign anyone. Nothing has been sent.";
      ship(eating, {
        id: `task:${task.id}`,
        group: "eating",
        headline,
        detail,
        text: `${headline}. ${detail}`,
        action: "Draft the next step",
        source: "Today only",
      }, skipped);
    }
  }

  const reminders = await listDueReminders(today).catch(() => []);
  for (const reminder of reminders) {
    if (focus.length + eating.length >= MAX_CARDS) break;
    const about = reminder.text.trim();
    if (!about) continue;
    const headline = `Reminder: ${about}`;
    const detail = "Opening the follow-up drafts a note. Nobody has been contacted.";
    ship(focus, {
      id: `reminder:${reminder.id}`,
      group: "focus",
      headline,
      detail,
      text: `You asked me to remind you: ${about}`,
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

function supplyCard(row: { status: "ordered" | "shipped" | "delivered"; product: string; property: string; item: string; confirmation: string; delivery: string; tracking: string }): BriefCard | null {
  const place = row.property.trim();
  if (!place) return null;
  const text = purchaseCardText(row);
  if (row.status === "delivered") {
    const headline = `Ready for pickup at ${place}`;
    const detail = `Cleaners notified in the cleaner app. ${row.product || row.item} has arrived.`;
    return {
      id: `supply:${row.confirmation}`,
      group: "focus",
      headline,
      detail,
      text,
      action: "Dismiss",
      source: `Supplies · ${place}`,
      purchaseStatus: row.status,
      trackingUrl: row.tracking,
    };
  }
  if (!row.tracking.trim()) return null;
  const headline = row.status === "shipped"
    ? `${row.product} is on the way to ${place}`
    : `Ordered ${row.product} for ${row.item} at ${place}`;
  const detail = `Confirmation ${row.confirmation}. Estimated delivery ${row.delivery}. Nothing else has been ordered.`;
  return {
    id: `supply:${row.confirmation}`,
    group: "focus",
    headline,
    detail,
    text,
    action: "Track order",
    source: `Supplies · ${place}`,
    purchaseStatus: row.status,
    trackingUrl: row.tracking,
  };
}

function mailCard(from: string, subject: string, where: "Gmail" | "Outlook", messageId: string): BriefCard | null {
  const who = from.trim();
  const about = subject.trim();
  if (!who || !about) return null;
  const headline = `${who} wrote about ${about} in ${where}`;
  const detail = "Reply drafts an answer in Checks. Nothing has been sent.";
  return {
    id: `${where === "Outlook" ? "outlook" : "gmail"}:${messageId}`,
    group: "focus",
    headline,
    detail,
    text: `${headline}. Want me to reply?`,
    action: "Reply",
    source: where,
  };
}

export function waitingDraftCard(item: WaitingDraft): BriefCard | null {
  if (!item.chatId || !item.messageId) return null;
  const base = {
    id: `draft:${item.messageId}`,
    chatId: item.chatId,
    messageId: item.messageId,
    group: "focus" as const,
    action: "Review",
    source: item.purchaseLine ? `Supplies · ${item.purchaseProperty}` : "Checks",
  };
  if (item.cleanerName && item.cleanerUnit && item.cleanerOn) {
    const place = cleanPlace(item.cleanerUnit);
    const when = spokenWhen(item.cleanerOn);
    if (!place || !when) return null;
    const headline = `Assign ${item.cleanerName} to the ${place} clean on ${when}`;
    const detail = `Approving writes ${item.cleanerName} onto that turnover in the cleaner app. Nothing has been written yet.`;
    return { ...base, headline, detail, text: `${headline}. ${detail}` };
  }
  if (item.purchaseLine && item.purchaseProperty) {
    const headline = item.purchaseLine.trim();
    const detail = "Approving places the order. Nothing has been ordered yet.";
    return { ...base, headline, detail, text: `${headline} ${detail}` };
  }
  if (item.channel === "skill" && item.skillName.trim()) {
    const headline = `${item.skillName.trim()} is ready to save`;
    const detail = "Approving saves it and leaves it off. It is not running.";
    return { ...base, headline, detail, text: `${headline}. ${detail}` };
  }
  if (item.channel === "email" && item.subject.trim()) {
    const who = item.to.trim();
    const headline = who ? `Email ${item.subject.trim()} to ${who}` : item.subject.trim();
    if (!who && /^an email$/i.test(headline)) return null;
    const detail = who
      ? `Approving sends it to ${who}. Nothing has been sent.`
      : "Approving sends this email. Nothing has been sent.";
    return { ...base, headline, detail, text: `${headline}. ${detail}` };
  }
  if (item.channel === "hospitable" && item.to.trim()) {
    const headline = `Reply to ${item.to.trim()} is waiting`;
    const detail = "Submitting sends it. Nothing has been sent.";
    return { ...base, headline, detail, text: `${headline}. ${detail}` };
  }
  if (item.channel === "note" && item.subject.trim() && !/^a note$/i.test(item.subject.trim())) {
    const headline = item.subject.trim();
    const detail = "Approving keeps this note. Nothing has been sent.";
    return { ...base, headline, detail, text: `${headline}. ${detail}` };
  }
  return null;
}

function cleanPlace(unit: string): string {
  if (/blue jays/i.test(unit)) return "Blue Jays Way";
  if (/roseglor|scarborough/i.test(unit)) return "Roseglor";
  if (/charlotte/i.test(unit) && /\b606\b/.test(unit)) return "Charlotte 606";
  if (/\bshaw\b/i.test(unit)) return "Shaw Street";
  const street = unit.split(",").map((part) => part.trim()).find((part) => /\d/.test(part) && /[A-Za-z]/.test(part));
  return street || "";
}

function spokenWhen(iso: string): string {
  const day = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "";
  const date = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(date);
  const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(date);
  return `${weekday} ${month} ${date.getUTCDate()}`;
}
