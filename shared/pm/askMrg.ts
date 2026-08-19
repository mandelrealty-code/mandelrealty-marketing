/**
 * Ask MRG — cheap host-portal answers.
 *
 * Cost rules:
 * - Dashboard chips / obvious number questions never hit Claude.
 * - Otherwise Haiku only, tiny facts pack, last 4 turns, max 180 tokens.
 * - Hard cap: 40 host messages / 20 billed replies per rolling 24h.
 */

import { getAwaitingContractForClient, listSignedContractsForClient } from "./contractStore.js";
import { buildOwnerDashboard } from "./ownerDashboard.js";
import { listPmProperties } from "./propertyStore.js";
import type { OwnerDashboardPayload, OwnerEarningsSnapshot } from "./ownerDashboardTypes.js";
import type { PortalUser } from "./portalUserStore.js";
import {
  countAskLastDay,
  insertAskMessage,
  isAskTableMissing,
  listAskMessages,
  type AskMessage,
} from "./askMrgStore.js";

export const ASK_MRG_MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 180;
const HISTORY_TURNS = 4;
const MSG_CAP = 40;
const LLM_CAP = 20;
const INPUT_MAX = 400;

const SYSTEM = `You are Ask MRG, Mandel Realty Group's owner advisor for ONE property.

Answer only from UNIT FACTS. If a number is missing, say you don't have it yet — never invent money, dates, occupancy, or bank details.

Style: 2–5 short sentences. CAD. Warm, calm, plain. No emoji, no headings, no bullet walls.

Never say: Hospitable, WhatsApp, knowledge base, AI, Claude, chatbot.
If asked to change banking, cancel management, or give legal advice: say email info@mandelrealtygroup.com — you only explain the numbers on file.

You may point them to Documents in this portal for statements and the signed agreement.`;

function moneyCad(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-CA")}`;
}

function stayRange(checkIn: string, checkOut: string): string {
  const fmt = (iso: string) => {
    if (!iso) return "—";
    const d = new Date(`${iso}T12:00:00Z`);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  };
  return `${fmt(checkIn)} → ${fmt(checkOut)}`;
}

function todayLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Toronto",
  });
}

function norm(q: string): string {
  return q
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9%]+/g, " ")
    .trim();
}

function occPct(e: OwnerEarningsSnapshot): number {
  return Math.round(e.occupancy_bps / 100);
}

function momLine(e: OwnerEarningsSnapshot): string {
  if (e.mom_bps == null) return "";
  const pct = (Math.abs(e.mom_bps) / 100).toFixed(1);
  return e.mom_bps >= 0 ? `up ${pct}% vs last month` : `down ${pct}% vs last month`;
}

type Facts = {
  propertyLabel: string;
  firstName: string;
  signedOn: string | null;
  awaiting: boolean;
  dashboard: OwnerDashboardPayload;
};

function bookingsAnswer(e: OwnerEarningsSnapshot): string {
  const n = e.reservation_count;
  const nights = e.nights_booked;
  return `${e.month_title} has ${n} booking${n === 1 ? "" : "s"} across ${nights} night${nights === 1 ? "" : "s"} — ${occPct(e)}% occupancy.`;
}

function projectedAnswer(e: OwnerEarningsSnapshot): string {
  if (e.projected_year_cents == null) {
    return `We don’t have a full-year projection on file yet. Year-to-date net is ${moneyCad(e.ytd_net_cents)}.`;
  }
  return `Projected net for ${e.projected_year} is about ${moneyCad(e.projected_year_cents)}, based on year-to-date ${moneyCad(e.ytd_net_cents)}.`;
}

function payoutAnswer(e: OwnerEarningsSnapshot): string {
  const p = e.next_payout;
  if (!p) {
    return "Payouts go out by EFT around the 5th of each month for the prior month’s net. We’ll show the next date once this listing is live.";
  }
  if (p.amount_cents != null) {
    return `${p.label} — ${moneyCad(p.amount_cents)} by EFT for your ${p.covers_title} net, alongside that month’s statement.`;
  }
  return `Next EFT is around ${p.label} for ${p.covers_title}, once that month closes. Mandel Realty pays by direct deposit around the 5th.`;
}

function netAnswer(e: OwnerEarningsSnapshot): string {
  const extra = momLine(e);
  return `Net to you for ${e.month_title} is ${moneyCad(e.net_to_host_cents)}${extra ? ` — ${extra}` : ""}.`;
}

function yoyAnswer(e: OwnerEarningsSnapshot): string {
  if (!e.prior_year) {
    return `We don’t have ${e.month_title.replace(/ \d{4}$/, "")} last year on file yet. Once a full year is in the portal, this comparison will show here. This month’s net is ${moneyCad(e.net_to_host_cents)}.`;
  }
  const a = e.net_to_host_cents;
  const b = e.prior_year.net_to_host_cents;
  if (b === 0) {
    return `${e.month_title} net is ${moneyCad(a)}. ${e.prior_year.month_title} isn’t comparable on file yet.`;
  }
  const bps = Math.round(((a - b) * 10000) / Math.abs(b));
  const pct = (Math.abs(bps) / 100).toFixed(1);
  const dir = bps >= 0 ? "up" : "down";
  return `Net to you was ${moneyCad(a)} versus ${moneyCad(b)} in ${e.prior_year.month_title} — ${dir} ${pct}%.`;
}

function upcomingAnswer(e: OwnerEarningsSnapshot): string {
  if (!e.upcoming.length) return "No upcoming stays on the books yet.";
  const lines = e.upcoming.map((s) => {
    const money = s.amount_cents > 0 ? ` · ${moneyCad(s.amount_cents)}` : "";
    return `${stayRange(s.check_in, s.check_out)} · ${s.nights} night${s.nights === 1 ? "" : "s"}${s.channel ? ` · ${s.channel}` : ""}${money}`;
  });
  return `Next on the calendar:\n${lines.join("\n")}`;
}

function statementAnswer(e: OwnerEarningsSnapshot): string {
  if (e.prior_month) {
    return `Your ${e.prior_month.month_title} statement is ready in Documents — ${moneyCad(e.prior_month.net_to_host_cents)} net.`;
  }
  return "Monthly statements appear in Documents after month close.";
}

function occupancyAnswer(e: OwnerEarningsSnapshot): string {
  return `${e.month_title} occupancy is ${occPct(e)}% of available nights (${e.nights_booked} night${e.nights_booked === 1 ? "" : "s"} booked).`;
}

function tryDeterministic(question: string, facts: Facts): string | null {
  const n = norm(question);
  const dash = facts.dashboard;
  const e = dash.earnings;

  if (!dash.linked || !e) {
    if (/earn|when.*(show|live|ready)|listing|airbnb|calendar|set ?up|what.?s left/.test(n)) {
      const open = dash.setup.filter((s) => s.state !== "done").map((s) => s.label);
      const signed = facts.signedOn
        ? `Agreement signed ${facts.signedOn}. `
        : facts.awaiting
          ? "Your agreement is ready to sign in this portal. "
          : "";
      return `${signed}Full earnings appear here once your listing is connected. Still open: ${open.join(" · ") || "our team is finishing setup"}.`;
    }
    if (/sign|agreement|contract|document/.test(n)) {
      if (facts.awaiting) return "Your management agreement is ready to sign in this portal — open the agreement from Home.";
      if (facts.signedOn) return `Your signed agreement is in Documents (${facts.signedOn}).`;
      return "Documents in this portal hold your signed agreement once it’s complete.";
    }
    if (/payout|paid|deposit|eft/.test(n)) {
      return "Payouts go out by EFT around the 5th of each month for the prior month’s net. Dates show here once the listing is live.";
    }
    if (/booking|occupancy|projected|revenue|net|statement|stay/.test(n)) {
      return "Those numbers unlock once your listing is connected. You’ll get an email the day it goes live.";
    }
    return null;
  }

  if (
    /how many booking|how many reservation|bookings? (do i|this month|have)|reservations this month|^bookings$/.test(
      n,
    )
  ) {
    return bookingsAnswer(e);
  }
  if (/occupancy|how full/.test(n)) return occupancyAnswer(e);
  if (/projected|full year|year.?s (revenue|net)|for 20\d{2}/.test(n) && /project|revenue|net|year/.test(n)) {
    return projectedAnswer(e);
  }
  if (/payout|when.{0,12}paid|next payment|direct deposit|eft/.test(n)) return payoutAnswer(e);
  if (/last year|year over year|yoy|compare/.test(n)) return yoyAnswer(e);
  if (/statement/.test(n)) return statementAnswer(e);
  if (/upcoming|next (stay|guest|booking)|who.?s coming|calendar/.test(n)) {
    return upcomingAnswer(e);
  }
  if (
    /^(how much|what.?s my net|net to (me|host)|how (am i|did i) do|this month)$/.test(n) ||
    (/net|how much (did|do|have) i (make|earn)/.test(n) && !/project/.test(n))
  ) {
    return netAnswer(e);
  }
  return null;
}

function factsBlock(facts: Facts): string {
  const e = facts.dashboard.earnings;
  const lines = [
    `UNIT: ${facts.propertyLabel}`,
    `HOST: ${facts.firstName}`,
    `TODAY: ${todayLabel()} (America/Toronto)`,
    facts.signedOn ? `AGREEMENT: signed ${facts.signedOn}` : facts.awaiting ? "AGREEMENT: waiting for signature in portal" : "AGREEMENT: none on file",
    `LISTING: ${facts.dashboard.linked ? "connected" : "not connected yet"}`,
  ];
  if (!e) {
    const setup = facts.dashboard.setup
      .map((s) => `${s.label}: ${s.status_label || s.state}`)
      .join("; ");
    lines.push(`SETUP: ${setup}`);
    lines.push("Earnings, bookings, occupancy, and payout dates are not on file yet.");
    return lines.join("\n");
  }
  lines.push(`THIS MONTH (${e.month_title}):`);
  lines.push(`- net to host: ${moneyCad(e.net_to_host_cents)} ${e.currency}`);
  if (e.mom_bps != null) lines.push(`- vs last month: ${momLine(e)}`);
  lines.push(`- bookings: ${e.reservation_count}`);
  lines.push(`- nights: ${e.nights_booked}`);
  lines.push(`- occupancy: ${occPct(e)}%`);
  lines.push(`- YTD net: ${moneyCad(e.ytd_net_cents)}`);
  lines.push(
    `- projected ${e.projected_year} net: ${e.projected_year_cents != null ? moneyCad(e.projected_year_cents) : "not on file"}`,
  );
  if (e.prior_month) {
    lines.push(`LAST MONTH (${e.prior_month.month_title}): net ${moneyCad(e.prior_month.net_to_host_cents)}`);
  } else {
    lines.push("LAST MONTH: not on file");
  }
  if (e.prior_year) {
    lines.push(
      `SAME MONTH LAST YEAR (${e.prior_year.month_title}): net ${moneyCad(e.prior_year.net_to_host_cents)}`,
    );
  } else {
    lines.push("SAME MONTH LAST YEAR: not on file — do not invent");
  }
  if (e.next_payout) {
    const amt =
      e.next_payout.amount_cents != null
        ? moneyCad(e.next_payout.amount_cents)
        : "not closed yet";
    lines.push(
      `NEXT PAYOUT: ${e.next_payout.label} EFT covering ${e.next_payout.covers_title}; amount ${amt}`,
    );
  }
  lines.push("PAYOUT POLICY: EFT around the 5th for the prior calendar month. Never invent bank last-4.");
  if (e.upcoming.length) {
    lines.push("UPCOMING STAYS:");
    for (const s of e.upcoming) {
      lines.push(
        `- ${stayRange(s.check_in, s.check_out)} · ${s.nights}n · ${s.channel || "Direct"}${s.amount_cents > 0 ? ` · ${moneyCad(s.amount_cents)}` : ""}`,
      );
    }
  } else {
    lines.push("UPCOMING STAYS: none");
  }
  lines.push("Never say Hospitable. Channels may be Airbnb, Vrbo, Direct, Booking.com.");
  return lines.join("\n");
}

function capReply(text: string): string {
  const clean = text
    .replace(/\*\*/g, "")
    .replace(/^#+\s+/gm, "")
    .replace(/\bHospitable\b/gi, "our booking systems")
    .replace(/\bWhatsApp\b/gi, "message")
    .trim();
  if (clean.length <= 900) return clean;
  return `${clean.slice(0, 880).replace(/\s+\S*$/, "")}…`;
}

async function callHaiku(input: {
  facts: string;
  history: AskMessage[];
  question: string;
}): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return null;
  const model = process.env.ASK_MRG_MODEL?.trim() || ASK_MRG_MODEL;

  const prior = input.history.slice(-HISTORY_TURNS * 2).map((m) => ({
    role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: m.body.slice(0, 280),
  }));

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      temperature: 0,
      system: [
        { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
        { type: "text", text: `UNIT FACTS\n${input.facts}`, cache_control: { type: "ephemeral" } },
      ],
      messages: [...prior, { role: "user", content: input.question.slice(0, INPUT_MAX) }],
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    content?: { type: string; text?: string }[];
    error?: { message?: string };
  };
  if (!res.ok) {
    console.error("[askMrg] Claude error", res.status, data.error?.message);
    return null;
  }
  const text = (data.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("\n")
    .trim();
  return text ? capReply(text) : null;
}

const dashCache = new Map<string, { at: number; value: OwnerDashboardPayload }>();
const DASH_TTL_MS = 60_000;

async function dashboardFor(clientId: string): Promise<OwnerDashboardPayload | null> {
  const hit = dashCache.get(clientId);
  if (hit && Date.now() - hit.at < DASH_TTL_MS) return hit.value;
  const value = await buildOwnerDashboard(clientId).catch(() => null);
  if (value) dashCache.set(clientId, { at: Date.now(), value });
  return value;
}

const FALLBACK =
  "I can answer bookings, occupancy, payouts, statements, and projections from your Mandel Realty numbers. Try one of the suggested questions, or email info@mandelrealtygroup.com.";

const CAP_REPLY =
  "You’ve asked quite a bit today. Email info@mandelrealtygroup.com if you need something specific — your manager will pick it up.";

async function persist(
  input: {
    portalUserId: string;
    clientId: string;
    role: "user" | "assistant";
    body: string;
    billed?: boolean;
  },
  persistOk: boolean,
): Promise<AskMessage | null> {
  if (!persistOk) return null;
  try {
    return await insertAskMessage(input);
  } catch (e) {
    if (isAskTableMissing(e)) return null;
    console.error("[askMrg] persist failed", e);
    return null;
  }
}

export type AskResult = {
  reply: string;
  billed: boolean;
  persist: boolean;
};

export async function answerAskMrg(input: {
  user: PortalUser;
  message: string;
}): Promise<AskResult> {
  const question = input.message.trim().slice(0, INPUT_MAX);
  if (!question) {
    return { reply: "Ask anything about this property.", billed: false, persist: false };
  }

  let persistOk = true;
  let counts = { total: 0, billed: 0 };
  let history: AskMessage[] = [];
  try {
    counts = await countAskLastDay(input.user.id);
    history = await listAskMessages(input.user.id, HISTORY_TURNS * 2);
  } catch (e) {
    if (isAskTableMissing(e)) persistOk = false;
    else throw e;
  }

  if (counts.total >= MSG_CAP) {
    return { reply: CAP_REPLY, billed: false, persist: persistOk };
  }

  const [dashboard, props, awaiting, signed] = await Promise.all([
    dashboardFor(input.user.pm_client_id),
    listPmProperties(input.user.pm_client_id).catch(() => []),
    getAwaitingContractForClient(input.user.pm_client_id).catch(() => null),
    listSignedContractsForClient(input.user.pm_client_id).catch(() => []),
  ]);

  const primary = props[0];
  const propertyLabel = primary
    ? `${primary.name}${primary.address ? ` · ${primary.address}` : ""}`
    : "your property";

  const facts: Facts = {
    propertyLabel,
    firstName: input.user.first_name || "there",
    signedOn: signed[0]?.signed_on ?? null,
    awaiting: Boolean(awaiting),
    dashboard: dashboard ?? { linked: false, synced: false, kb_ready: false, setup: [], earnings: null },
  };

  await persist(
    {
      portalUserId: input.user.id,
      clientId: input.user.pm_client_id,
      role: "user",
      body: question,
    },
    persistOk,
  );

  const canned = tryDeterministic(question, facts);
  if (canned) {
    await persist(
      {
        portalUserId: input.user.id,
        clientId: input.user.pm_client_id,
        role: "assistant",
        body: canned,
        billed: false,
      },
      persistOk,
    );
    return { reply: canned, billed: false, persist: persistOk };
  }

  if (counts.billed >= LLM_CAP) {
    const reply = CAP_REPLY;
    await persist(
      {
        portalUserId: input.user.id,
        clientId: input.user.pm_client_id,
        role: "assistant",
        body: reply,
      },
      persistOk,
    );
    return { reply, billed: false, persist: persistOk };
  }

  let reply: string | null = null;
  try {
    reply = await callHaiku({
      facts: factsBlock(facts),
      history,
      question,
    });
  } catch (err) {
    console.error("[askMrg] haiku failed", err);
  }

  const billed = Boolean(reply);
  const text = reply || FALLBACK;
  await persist(
    {
      portalUserId: input.user.id,
      clientId: input.user.pm_client_id,
      role: "assistant",
      body: text,
      billed,
    },
    persistOk,
  );
  return { reply: text, billed, persist: persistOk };
}
