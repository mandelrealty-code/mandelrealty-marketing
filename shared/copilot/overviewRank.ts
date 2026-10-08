/**
 * One ranked morning list. Tiers are fixed. A learned signal can drop a type
 * one tier for a property. Guest-arrival items in tier 1 stay where they are.
 * Failed reads stay last and are always named.
 */

export type OverviewKind = "registration" | "guest" | "cleaner" | "expiring" | "stock" | "draft" | "failed" | "other";

export type RankSignals = Record<string, { dismissals: number; passed: number }>;

export type OverviewInput = {
  id: string;
  kind: OverviewKind;
  property: string;
  title: string;
  why: string;
  lead: string;
  when: string;
  deadline: string;
  action: string;
  actions?: string[];
  chatId?: string;
  messageId?: string;
  trackingUrl?: string;
};

export type OverviewRow = OverviewInput & {
  tier: number;
  rank: number;
  soon: boolean;
  failed: boolean;
  demoted: boolean;
  section: "today" | "coming";
};

export type OverviewDone = { id: string; at: string; who: string; text: string };
export type OverviewCheck = { what: string; result: string; src: string };

export type OverviewModel = {
  summary: string;
  count: number;
  dateLabel: string;
  checkedAt: string;
  today: OverviewRow[];
  coming: OverviewRow[];
  comingPeek: string;
  done: OverviewDone[];
  checked: OverviewCheck[];
  empty: boolean;
};

const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six"];

export function signalKey(kind: OverviewKind, property: string): string {
  return `${kind}|${property.trim().toLowerCase()}`;
}

export function noteSignal(signals: RankSignals, kind: "dismiss" | "passed", itemKind: OverviewKind, property: string): RankSignals {
  if (itemKind === "failed" || !property.trim()) return signals;
  const key = signalKey(itemKind, property);
  const prev = signals[key] ?? { dismissals: 0, passed: 0 };
  const next = kind === "dismiss"
    ? { dismissals: prev.dismissals + 1, passed: prev.passed }
    : { dismissals: prev.dismissals, passed: prev.passed + 1 };
  return { ...signals, [key]: next };
}

export function isDemoted(signals: RankSignals, kind: OverviewKind, property: string, tier: number): boolean {
  if (tier <= 1 || kind === "failed") return false;
  const row = signals[signalKey(kind, property)];
  if (!row) return false;
  return row.dismissals >= 2 || row.passed >= 3;
}

export function inputFromCard(card: {
  id: string;
  text: string;
  action: string;
  headline?: string;
  detail?: string;
  actions?: string[];
  chatId?: string;
  messageId?: string;
  trackingUrl?: string;
  rank?: { kind: OverviewKind; property: string; deadline: string; when?: string; lead?: string };
}): OverviewInput {
  const hint = card.rank;
  const kind = hint?.kind ?? inferKind(card);
  const property = hint?.property?.trim() || inferProperty(`${card.headline ?? ""} ${card.text}`);
  return {
    id: card.id,
    kind,
    property: property || "the portfolio",
    title: card.headline?.trim() || card.text,
    why: card.detail?.trim() || card.text,
    lead: hint?.lead?.trim() || card.headline?.trim() || card.text,
    when: hint?.when?.trim() || "Today",
    deadline: hint?.deadline || "",
    action: card.actions?.[0] || card.action,
    actions: card.actions,
    chatId: card.chatId,
    messageId: card.messageId,
    trackingUrl: card.trackingUrl,
  };
}

function inferKind(card: { id: string; text: string; headline?: string }): OverviewKind {
  const blob = `${card.id} ${card.headline ?? ""} ${card.text}`.toLowerCase();
  if (card.id.startsWith("failed-read:")) return "failed";
  if (/registration|building email/.test(blob)) return "registration";
  if (card.id.startsWith("supply:") || /low on|paper towel|toilet paper/.test(blob)) return "stock";
  if (/^assign /.test((card.headline ?? "").toLowerCase()) || /\bcleaner\b/.test(blob)) return "cleaner";
  if (card.id.startsWith("open:")) return "expiring";
  if (/reply to /.test(blob) || card.id.startsWith("gmail:") || card.id.startsWith("outlook:")) return "guest";
  if (card.id.startsWith("draft:")) return "draft";
  return "other";
}

function inferProperty(text: string): string {
  if (/blue jays/i.test(text)) return "Blue Jays Way";
  if (/charlotte/i.test(text) && /\b606\b/.test(text)) return "Charlotte 606";
  if (/roseglor|scarborough/i.test(text)) return "Roseglor";
  if (/\bshaw\b/i.test(text)) return "Shaw Street";
  return "";
}

export function rankOverview(
  items: OverviewInput[],
  signals: RankSignals = {},
  now = new Date(),
  done: OverviewDone[] = [],
  checked: OverviewCheck[] = [],
): OverviewModel {
  const unique = dedupe(items);
  const scored = unique.map((item) => score(item, signals, now));
  const active = scored.filter((row) => !row.failed).sort(byRank);
  const failed = scored.filter((row) => row.failed).sort(byRank);
  const ordered = [...active, ...failed];
  const today = ordered.filter((row) => row.section === "today");
  const coming = ordered.filter((row) => row.section === "coming");
  let rank = 0;
  for (const row of today) {
    if (row.failed) {
      row.rank = 0;
      continue;
    }
    rank += 1;
    row.rank = rank;
  }
  const counted = today.filter((row) => !row.failed);
  return {
    summary: summaryLine(counted, failed),
    count: counted.length,
    dateLabel: dateLabel(now),
    checkedAt: checkedLabel(now),
    today,
    coming,
    comingPeek: comingPeek(coming),
    done,
    checked,
    empty: counted.length === 0 && failed.length === 0,
  };
}

function dedupe(items: OverviewInput[]): OverviewInput[] {
  const seen = new Set<string>();
  const out: OverviewInput[] = [];
  for (const item of items) {
    const key = item.kind === "guest" || item.kind === "draft"
      ? `id:${item.id}`
      : `${item.kind}|${item.property.trim().toLowerCase()}|${item.deadline.slice(0, 10)}`;
    if (seen.has(item.id) || seen.has(key)) continue;
    seen.add(item.id);
    seen.add(key);
    out.push(item);
  }
  return out;
}

function score(item: OverviewInput, signals: RankSignals, now: Date): OverviewRow {
  const filled = fillDeadline(item, now);
  const base = baseTier(filled, now);
  const demoted = isDemoted(signals, item.kind, item.property, base);
  const tier = demoted ? Math.min(6, base + 1) : base;
  const failed = item.kind === "failed";
  const hours = hoursUntil(filled.deadline, now);
  return {
    ...filled,
    actions: item.actions?.length ? item.actions : undefined,
    tier,
    rank: 0,
    soon: !failed && hours <= 4 && hours > -1,
    failed,
    demoted,
    section: sectionFor(filled, tier, demoted, failed, now),
  };
}

function fillDeadline(item: OverviewInput, now: Date): OverviewInput {
  if (/^\d{4}-\d{2}-\d{2}/.test(item.deadline)) return item;
  const today = dayKey(now);
  if (item.kind === "registration" || item.kind === "failed") return { ...item, deadline: `${today}T18:00:00Z` };
  if (item.kind === "stock") return { ...item, deadline: `${addDays(today, 3)}T12:00:00Z` };
  return item;
}

function baseTier(item: OverviewInput, now: Date): number {
  if (item.kind === "failed") return 6;
  const window = arrivalWindow(item.deadline, now);
  const blocking = window === "today" || window === "tomorrow";
  const hours = hoursUntil(item.deadline, now);
  if (blocking && (item.kind === "registration" || item.kind === "guest" || item.kind === "cleaner")) return 1;
  if (item.kind === "expiring" && hours <= 48) return 2;
  if (item.kind === "cleaner" && hours <= 48) return 3;
  if (item.kind === "guest" || item.kind === "draft") return 4;
  if (item.kind === "stock" && window !== "later") return 5;
  return 6;
}

function sectionFor(item: OverviewInput, tier: number, demoted: boolean, failed: boolean, now: Date): "today" | "coming" {
  if (failed || demoted || tier <= 5) return "today";
  const day = item.deadline.slice(0, 10);
  const today = dayKey(now);
  const week = addDays(today, 7);
  if (day > today && day <= week) return "coming";
  return "today";
}

function byRank(a: OverviewRow, b: OverviewRow): number {
  if (a.tier !== b.tier) return a.tier - b.tier;
  if (a.demoted !== b.demoted) return a.demoted ? 1 : -1;
  const ad = a.deadline || "";
  const bd = b.deadline || "";
  if (ad !== bd) return ad < bd ? -1 : 1;
  return a.title.localeCompare(b.title);
}

function summaryLine(counted: OverviewRow[], failed: OverviewRow[]): string {
  if (!counted.length) {
    return failed.length
      ? `Nothing needs you today. ${failed[0]?.title ?? "A read failed."}`
      : "Nothing needs you today.";
  }
  const n = counted.length;
  const word = n <= 6 ? WORDS[n] : String(n);
  const noun = n === 1 ? "thing needs" : "things need";
  return `${word} ${noun} you today. ${counted[0]?.lead || counted[0]?.title || ""}`.trim();
}

function comingPeek(rows: OverviewRow[]): string {
  if (!rows.length) return "Nothing else is due this week.";
  return rows.slice(0, 4).map((row) => row.title).join(", ");
}

function hoursUntil(deadline: string, now: Date): number {
  const at = new Date(deadline).getTime();
  if (Number.isNaN(at)) return 24 * 30;
  return (at - now.getTime()) / 36e5;
}

function arrivalWindow(deadline: string, now: Date): "today" | "tomorrow" | "week" | "later" {
  const day = deadline.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "later";
  const today = dayKey(now);
  if (day <= today) return "today";
  if (day === addDays(today, 1)) return "tomorrow";
  if (day <= addDays(today, 7)) return "week";
  return "later";
}

function dayKey(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, (d ?? 1) + days));
  return dt.toISOString().slice(0, 10);
}

function dateLabel(now: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/Toronto",
  }).format(now);
}

function checkedLabel(now: Date): string {
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Toronto",
  }).format(now);
  return `Checked ${time}`;
}
