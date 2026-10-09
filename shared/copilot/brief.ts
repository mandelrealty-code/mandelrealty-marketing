import { getSupabaseAdmin } from "../supabase.js";
import { addDays, greeting, torontoToday } from "./time.js";
import type { BriefCard, BriefPayload, CopilotMessage } from "./types.js";
import { latestInboxOffer } from "../adminApi/gmail.js";
import { latestOutlookOffer } from "../adminApi/outlook.js";
import { chooseBriefOpenItem, listOpenItems, openItemChoice, verifiedLabel, type OpenItem } from "./openItems.js";
import { turnoverLine, weekTurnovers, type TurnoverRow } from "./dayBoard.js";
import { inputFromCard, noteSignal, rankOverview } from "./overviewRank.js";
import { listConnectorFailures, type ConnectorFailure } from "./connectorFailures.js";
import { dismissCard, listChecksMessages, listDismissed, listDueReminders, listRuns, listSkills, listStoredOpenItems, listSupplyDrafts, listWaitingDrafts, readBriefSnapshot, readGmailOffer, readRankSignals, saveBriefSnapshot, saveGmailOffer, writeRankSignals, type WaitingDraft } from "./store.js";
import { runsOnItsOwn } from "./skillRunner.js";
import { runUnattendedChecks } from "./stayCheck.js";
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
  return { hello: greet.hello, line: greet.line, quiet: true, focus: [], eating: [], overview: rankOverview([], {}, now) };
}

/** The Checks chat's stored items, ranked. This does not scan mail, stays, or the cleaner app. */
export async function readSavedBrief(now = new Date()): Promise<BriefPayload> {
  const saved = await readBriefSnapshot();
  if (parityEnabled()) return saved ?? quietBrief(now);
  try {
    const [messages, open, failed, signals, skipped] = await Promise.all([
      listChecksMessages(),
      listStoredOpenItems(),
      listConnectorFailures(),
      readRankSignals(),
      listDismissed(),
    ]);
    return briefFromChecksMessages(messages, open.filter((item) => item.status === "open"), failed, now, {
      saved,
      signals,
      skipped,
    });
  } catch {
    return saved ?? quietBrief(now);
  }
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
  const card = [...current.focus, ...current.eating].find((row) => row.id === cardId);
  let signals = await readRankSignals().catch(() => ({}));
  const kind = card?.rank?.kind ?? inputFromCard(card ?? { id: cardId, text: "", action: "" }).kind;
  const property = card?.rank?.property || inputFromCard(card ?? { id: cardId, text: cardId, action: "" }).property;
  if (card && kind !== "failed") {
    signals = noteSignal(signals, "dismiss", kind, property);
    await writeRankSignals(signals);
  }
  const focus = current.focus.filter((row) => row.id !== cardId);
  const eating = current.eating.filter((row) => row.id !== cardId);
  const done = [...(current.overview?.done ?? []), {
    id: cardId,
    at: "Just now",
    who: "You",
    text: `Set aside ${card?.headline || card?.text || "an item"}.`,
  }];
  const next = finishBrief(current, focus, eating, signals, now, done);
  await saveBriefSnapshot(next);
  return next;
}

export async function applyOpenItemOnBrief(cardId: string, label: string, now = new Date()): Promise<BriefPayload | null> {
  const applied = await chooseBriefOpenItem(cardId, label);
  if (!applied) return null;
  const choice = openItemChoice(label);
  const current = await readSavedBrief(now);
  let signals = await readRankSignals().catch(() => ({}));
  signals = notePassedAbove(current, cardId, signals);
  await writeRankSignals(signals);
  const keep = (cards: BriefCard[]) => cards.flatMap((card) => {
    if (card.id !== cardId) return [card];
    if (choice === "closed") return [];
    return [{ ...card, action: "Open", actions: undefined }];
  });
  const focus = keep(current.focus);
  const eating = keep(current.eating);
  const next = finishBrief(current, focus, eating, signals, now, current.overview?.done ?? []);
  await saveBriefSnapshot(next);
  return next;
}

export async function noteRankPass(cardId: string, now = new Date()): Promise<BriefPayload> {
  const current = await readSavedBrief(now);
  let signals = await readRankSignals().catch(() => ({}));
  signals = notePassedAbove(current, cardId, signals);
  await writeRankSignals(signals);
  const next = finishBrief(current, current.focus, current.eating, signals, now, current.overview?.done ?? []);
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
        rank: { kind: "failed", property: failure.connector, deadline: "", when: "Last pass", lead: `${failure.connector} could not be read. ${failure.error}` },
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
        rank: { kind: "expiring", property: item.source || "Records", deadline: "", when: `Verified ${verifiedLabel(item.verifiedOn)}`, lead: headline },
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
  try {
    for (const card of storedCheckCards(await listChecksMessages(), [], [], now)) {
      if ([...focus, ...eating].some((row) => row.id === card.id || (row.messageId && row.messageId === card.messageId && row.rank?.kind === "cleaner" && card.rank?.kind === "cleaner"))) continue;
      ship(focus, card, skipped);
    }
  } catch {
    /* The overview still loads when the Checks chat cannot be read. */
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

  const openTurnovers = await weekTurnovers(now);
  if (openTurnovers) {
    const kept = focus.filter((card) => !card.id.startsWith("turnover:"));
    focus.length = 0;
    focus.push(...kept);
    for (const row of openTurnovers) {
      const card = boardTurnoverCard(row);
      if (!skipped.has(card.id) && !focus.some((item) => item.id === card.id)) focus.push(card);
    }
  }
  const failed = [...focus, ...eating].filter((card) => card.id.startsWith("failed-read:"));
  const rest = [...focus, ...eating].filter((card) => !card.id.startsWith("failed-read:"));
  const turnovers = rest.filter((card) => card.id.startsWith("turnover:"));
  const others = rest.filter((card) => !card.id.startsWith("turnover:"));
  const capped = others.slice(0, MAX_CARDS);
  const all = [...capped, ...turnovers, ...failed.filter((card) => !capped.includes(card) && !turnovers.includes(card))];
  const keptFocus = all.filter((card) => card.group === "focus");
  const keptEating = all.filter((card) => card.group === "eating");
  const signals = await readRankSignals().catch(() => ({}));
  return finishBrief({ hello: greet.hello, line: greet.line, quiet: false, focus: [], eating: [] }, keptFocus, keptEating, signals, now, []);
}

function finishBrief(
  current: BriefPayload,
  focus: BriefCard[],
  eating: BriefCard[],
  signals: Parameters<typeof noteSignal>[0],
  now: Date,
  done: NonNullable<BriefPayload["overview"]>["done"],
): BriefPayload {
  const live = [...focus, ...eating].filter((card) => card.purchaseStatus !== "delivered");
  const arrived = [...focus, ...eating].filter((card) => card.purchaseStatus === "delivered");
  const handed = [
    ...done.filter((row) => !arrived.some((card) => card.id === row.id)),
    ...arrived.map((card) => ({
      id: card.id,
      at: "Today",
      who: "Copilot",
      text: card.headline || card.text,
    })),
  ];
  const overview = rankOverview(
    live.map((card) => inputFromCard(card)),
    signals,
    now,
    handed,
    current.overview?.checked ?? [],
  );
  return {
    ...current,
    quiet: focus.length + eating.length === 0,
    focus,
    eating,
    overview,
  };
}

function notePassedAbove(current: BriefPayload, cardId: string, signals: Parameters<typeof noteSignal>[0]) {
  const today = current.overview?.today ?? [];
  const acted = today.find((row) => row.id === cardId);
  if (!acted || acted.failed) return signals;
  let next = signals;
  for (const row of today) {
    if (row.failed || row.rank <= 0 || row.rank >= acted.rank) continue;
    next = noteSignal(next, "passed", row.kind, row.property);
  }
  return next;
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
      rank: { kind: "stock", property: place, deadline: "", when: "Delivered", lead: headline },
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
    rank: { kind: "stock", property: place, deadline: "", when: row.delivery || "This week", lead: headline },
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
    return {
      ...base,
      headline,
      detail,
      text: `${headline}. ${detail}`,
      rank: {
        kind: "cleaner",
        property: place,
        deadline: `${item.cleanerOn.slice(0, 10)}T15:00:00Z`,
        when,
        lead: `${place} has no cleaner on ${when}.`,
      },
    };
  }
  if (item.purchaseLine && item.purchaseProperty) {
    const headline = item.purchaseLine.trim();
    const detail = "Approving places the order. Nothing has been ordered yet.";
    return {
      ...base,
      headline,
      detail,
      text: `${headline} ${detail}`,
      rank: { kind: "stock", property: item.purchaseProperty, deadline: "", when: "This week", lead: headline },
    };
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
    const registration = /registration|building/i.test(`${item.subject} ${item.body}`);
    return {
      ...base,
      headline,
      detail,
      text: `${headline}. ${detail}`,
      rank: {
        kind: registration ? "registration" : "draft",
        property: cleanPlace(`${item.subject} ${item.body}`) || who || "the portfolio",
        deadline: "",
        when: "Today",
        lead: headline,
      },
    };
  }
  if (item.channel === "hospitable" && item.to.trim()) {
    const headline = `Reply to ${item.to.trim()} is waiting`;
    const detail = "Submitting sends it. Nothing has been sent.";
    return {
      ...base,
      headline,
      detail,
      text: `${headline}. ${detail}`,
      rank: { kind: "guest", property: cleanPlace(item.body) || item.to.trim(), deadline: "", when: "Waiting", lead: headline },
    };
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

/** Ranked overview of the same stored Checks rows, open items, and failed reads. An empty list is an empty day. */
export function briefFromChecksMessages(
  messages: CopilotMessage[],
  open: OpenItem[] = [],
  failed: ConnectorFailure[] = [],
  now = new Date(),
  extra: { saved?: BriefPayload | null; signals?: Parameters<typeof noteSignal>[0]; skipped?: string[] } = {},
): BriefPayload {
  const skipped = new Set(extra.skipped ?? []);
  const cards = storedCheckCards(messages, open, failed, now).filter((card) => !skipped.has(card.id));
  const saved = extra.saved ?? null;
  const base = saved ?? quietBrief(now);
  if (!cards.length) {
    const overview = rankOverview([], extra.signals ?? {}, now, base.overview?.done ?? [], base.overview?.checked ?? []);
    return { ...base, quiet: true, focus: [], eating: [], overview };
  }
  return finishBrief(
    base,
    cards.filter((card) => card.group !== "eating"),
    cards.filter((card) => card.group === "eating"),
    extra.signals ?? {},
    now,
    base.overview?.done ?? [],
  );
}

function storedCheckCards(messages: CopilotMessage[], open: OpenItem[], failed: ConnectorFailure[], now: Date): BriefCard[] {
  const cards: BriefCard[] = [];
  const cleaners = new Set<string>();
  const failedNames = new Set<string>();
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    const draft = waitingFromMessage(message);
    const card = draft ? waitingDraftCard(draft) ?? plainWaitingCard(draft) : null;
    if (card) {
      if (card.rank?.kind === "cleaner") cleaners.add(cleanerKey(card));
      cards.push(card);
      continue;
    }
    const turnover = turnoverCard(message, now);
    if (turnover) {
      const key = cleanerKey(turnover);
      if (cleaners.has(key)) continue;
      cleaners.add(key);
      cards.push(turnover);
      continue;
    }
    const missed = failedCard(message);
    if (missed) {
      failedNames.add(missed.rank?.property.toLowerCase() ?? missed.id);
      cards.push(missed);
    }
  }
  for (const item of open) {
    if (item.status !== "open") continue;
    const today = torontoToday(now);
    const choices = item.askedOn === today ? undefined : ["Already upgraded", "Still pending"];
    const headline = item.text.trim();
    if (!headline) continue;
    const detail = `Last verified ${verifiedLabel(item.verifiedOn)}. A choice here updates this item. Nothing has been changed yet.`;
    cards.push({
      id: `open:${item.id}`,
      group: "focus",
      headline,
      detail,
      text: `${headline}. Last verified ${verifiedLabel(item.verifiedOn)}.`,
      action: choices ? choices[0] : "Open",
      actions: choices,
      source: item.source || "Records",
      rank: { kind: "expiring", property: item.source || "Records", deadline: "", when: `Verified ${verifiedLabel(item.verifiedOn)}`, lead: headline },
    });
  }
  for (const failure of failed) {
    if (failedNames.has(failure.connector.toLowerCase())) continue;
    const headline = `${failure.connector} failed read`;
    const detail = `${failure.error} Nothing was read.`;
    cards.push({
      id: `failed-read:${failure.connector}`,
      group: "focus",
      headline,
      detail,
      text: `${headline}: ${failure.error}`,
      action: "Open",
      source: "Checks",
      rank: { kind: "failed", property: failure.connector, deadline: "", when: "Last pass", lead: `${failure.connector} could not be read. ${failure.error}` },
    });
  }
  return cards;
}

function plainWaitingCard(item: WaitingDraft): BriefCard | null {
  if (!item.chatId || !item.messageId) return null;
  const line = item.body.trim().split("\n").find((row) => row.trim()) || item.subject.trim();
  const headline = item.to.trim() ? `Reply to ${item.to.trim()} is waiting` : (line || "A draft is waiting");
  const detail = "It is waiting in Checks. Nothing has been sent.";
  return {
    id: `draft:${item.messageId}`,
    chatId: item.chatId,
    messageId: item.messageId,
    group: "focus",
    headline,
    detail,
    text: `${headline}. ${detail}`,
    action: "Review",
    source: "Checks",
    rank: {
      kind: item.channel === "hospitable" ? "guest" : "draft",
      property: cleanPlace(`${item.subject} ${item.body}`) || item.to.trim() || "the portfolio",
      deadline: "",
      when: "Waiting",
      lead: headline,
    },
  };
}

function waitingFromMessage(message: CopilotMessage): WaitingDraft | null {
  const draft = message.draft;
  if (!draft || draft.status !== "waiting") return null;
  if (draft.channel !== "email" && draft.channel !== "note" && draft.channel !== "skill" && draft.channel !== "hospitable") return null;
  return {
    messageId: message.id,
    chatId: message.chat_id,
    createdAt: message.created_at,
    channel: draft.channel,
    subject: draft.subject || "",
    body: draft.body || "",
    to: draft.to || "",
    skillName: draft.skillName || "",
    purchaseLine: draft.purchase?.kind === "detail" ? draft.purchase.overview : "",
    purchaseProperty: draft.purchase?.kind === "detail" ? draft.purchase.property : "",
    cleanerName: draft.cleanerAssign?.cleanerName || "",
    cleanerUnit: draft.cleanerAssign?.unit || "",
    cleanerOn: draft.cleanerAssign?.scheduledOn || "",
  };
}

function checkText(message: CopilotMessage): string {
  const rows = message.report?.sections.flatMap((section) => section.rows.map((row) => `${row.who} ${row.meta}`)) ?? [];
  return [message.report?.title, message.report?.summary, message.body, ...rows].filter(Boolean).join(" ");
}

function boardTurnoverCard(row: TurnoverRow): BriefCard {
  const line = turnoverLine(row);
  const headline = row.overdue
    ? `Overdue: no cleaner on the ${row.property} turnover on ${row.when}`
    : `No cleaner on the ${row.property} turnover on ${row.when}`;
  return {
    id: `turnover:${row.propertyId}:${row.date}`,
    group: "focus",
    headline,
    detail: `${line}. The turnover has no cleaner. Nothing has been assigned yet.`,
    text: `${headline}. ${line}.`,
    action: "Review",
    source: "Checks",
    rank: { kind: "cleaner", property: row.property, deadline: `${row.date}T15:00:00Z`, when: row.when, lead: headline },
  };
}

function turnoverCard(message: CopilotMessage, now: Date): BriefCard | null {
  const text = checkText(message);
  if (!/no cleaner assigned/i.test(text)) return null;
  const place = cleanPlace(text) || "the unit";
  const guest = text.match(/\b([A-Z][a-z]+) arrives\b/)?.[1] ?? text.match(/\b([A-Z][a-z]+)'s\b/)?.[1] ?? "";
  const day = turnoverDay(text, now);
  const when = spokenWhen(day);
  const soon = day === torontoToday(now) ? "today" : day === addDays(torontoToday(now), 1) ? "tomorrow" : when;
  const headline = guest
    ? `No cleaner for ${guest}'s turnover at ${place}${when ? ` on ${when}` : ""}`
    : `No cleaner on the ${place} turnover${when ? ` on ${when}` : ""}`;
  const lead = guest
    ? `${guest} arrives ${soon} at ${place} and the turnover has no cleaner.`
    : `${place} has no cleaner${when ? ` on ${when}` : ""}.`;
  const detail = "The turnover has no cleaner. Nothing has been assigned yet.";
  return {
    id: `turnover:${message.id}`,
    chatId: message.chat_id,
    messageId: message.id,
    group: "focus",
    headline,
    detail,
    text: `${headline}. ${detail}`,
    action: "Review",
    source: "Checks",
    rank: { kind: "cleaner", property: place, deadline: day ? `${day}T15:00:00Z` : "", when: when || "Waiting", lead },
  };
}

function turnoverDay(text: string, now: Date): string {
  const today = torontoToday(now);
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
  if (iso) return iso;
  if (/turnover today|arrives today|arriving today/i.test(text)) return today;
  if (/turnover in 1 day|arrives tomorrow|arriving tomorrow|\btomorrow\b/i.test(text)) return addDays(today, 1);
  const days = text.match(/turnover in (\d+) days/i);
  if (days) return addDays(today, Number(days[1]));
  return "";
}

function failedCard(message: CopilotMessage): BriefCard | null {
  const text = checkText(message);
  const named = text.match(/\b([A-Za-z][A-Za-z0-9 .'-]{1,40}) failed read\b/);
  if (!named) return null;
  const connector = named[1].trim();
  const headline = `${connector} failed read`;
  const detail = `${text} Nothing was read.`;
  return {
    id: `failed-read:${message.id}`,
    chatId: message.chat_id,
    messageId: message.id,
    group: "focus",
    headline,
    detail,
    text: headline,
    action: "Open",
    source: "Checks",
    rank: { kind: "failed", property: connector, deadline: "", when: "Last pass", lead: `${connector} could not be read.` },
  };
}

function cleanerKey(card: BriefCard): string {
  return `${(card.rank?.property ?? "").toLowerCase()}|${card.rank?.deadline.slice(0, 10) ?? ""}`;
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
