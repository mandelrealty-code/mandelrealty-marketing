/** Live spend for the three accounts. A missing balance stays blank. Nothing here is estimated. */

import type { AccountSpend } from "./models.js";

export type { AccountSpend };

const TTL_MS = 15 * 60 * 1000;
let cached: { at: number; accounts: AccountSpend[] } | null = null;

function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function moneyDollars(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

async function readJson(url: string, init: RequestInit): Promise<{ ok: boolean; status: number; data: unknown }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  } finally {
    clearTimeout(timer);
  }
}

function openAiNote(status: number, hasAdmin: boolean): string {
  if (status === 401 || status === 403) {
    return hasAdmin
      ? "This OpenAI admin key can’t read spend."
      : "This key can’t read spend. An OpenAI admin key is required.";
  }
  if (!status) return "OpenAI didn’t answer.";
  return "OpenAI didn’t return spend.";
}

async function openAiSpend(): Promise<AccountSpend> {
  const admin = process.env.OPENAI_ADMIN_API_KEY?.trim() || "";
  const key = admin || process.env.OPENAI_API_KEY?.trim() || "";
  const base = { id: "openai" as const, name: "OpenAI", spent: null, left: null };
  if (!key) return { ...base, note: "OpenAI isn’t connected." };
  const end = Math.floor(Date.now() / 1000);
  const start = end - 30 * 24 * 60 * 60;
  let page = "";
  let total = 0;
  let saw = false;
  for (let i = 0; i < 5; i += 1) {
    const url = new URL("https://api.openai.com/v1/organization/costs");
    url.searchParams.set("start_time", String(start));
    url.searchParams.set("end_time", String(end));
    url.searchParams.set("bucket_width", "1d");
    url.searchParams.set("limit", "31");
    if (page) url.searchParams.set("page", page);
    const res = await readJson(url.toString(), { headers: { Authorization: `Bearer ${key}` } });
    if (!res.ok) return { ...base, note: openAiNote(res.status, Boolean(admin)) };
    const body = res.data as { data?: { results?: { amount?: { value?: number } }[] }[]; has_more?: boolean; next_page?: string };
    for (const bucket of body.data ?? []) {
      for (const row of bucket.results ?? []) {
        const value = row.amount?.value;
        if (typeof value === "number" && Number.isFinite(value)) {
          total += value;
          saw = true;
        }
      }
    }
    if (!body.has_more || !body.next_page) break;
    page = body.next_page;
  }
  return {
    ...base,
    spent: saw ? `${moneyDollars(total)} · last 30 days` : null,
    left: null,
    note: "OpenAI doesn’t report credits left.",
  };
}

async function anthropicSpend(): Promise<AccountSpend> {
  const admin = process.env.ANTHROPIC_ADMIN_API_KEY?.trim() || "";
  const key = admin || process.env.ANTHROPIC_API_KEY?.trim() || "";
  const base = { id: "anthropic" as const, name: "Anthropic", spent: null, left: null };
  if (!key) return { ...base, note: "Anthropic isn’t connected." };
  const ending = new Date();
  const starting = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const url = new URL("https://api.anthropic.com/v1/organizations/cost_report");
  url.searchParams.set("starting_at", starting.toISOString());
  url.searchParams.set("ending_at", ending.toISOString());
  url.searchParams.set("bucket_width", "1d");
  const res = await readJson(url.toString(), {
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
  });
  if (!res.ok) {
    const note = res.status === 401 || res.status === 403
      ? (admin ? "This Anthropic admin key can’t read spend." : "This key can’t read spend. An Anthropic admin key is required.")
      : res.status ? "Anthropic didn’t return spend." : "Anthropic didn’t answer.";
    return { ...base, note };
  }
  const body = res.data as { data?: { results?: { amount?: string }[] }[] };
  let cents = 0;
  let saw = false;
  for (const bucket of body.data ?? []) {
    for (const row of bucket.results ?? []) {
      const value = Number(row.amount);
      if (Number.isFinite(value)) {
        cents += value;
        saw = true;
      }
    }
  }
  return {
    ...base,
    spent: saw ? `${money(cents)} · last 30 days` : null,
    left: null,
    note: "Anthropic doesn’t report credits left.",
  };
}

type CursorMember = {
  spendCents?: number;
  overallSpendCents?: number;
  includedSpendCents?: number;
  totalPercentUsed?: number;
  monthlyLimitDollars?: number;
};

async function cursorSpend(): Promise<AccountSpend> {
  const admin = process.env.CURSOR_ADMIN_API_KEY?.trim() || "";
  const key = admin || process.env.CURSOR_API_KEY?.trim() || "";
  const base = { id: "cursor" as const, name: "Cursor", spent: null, left: null };
  if (!key) return { ...base, note: "Cursor isn’t connected." };
  const members: CursorMember[] = [];
  let page = 1;
  let pages = 1;
  while (page <= pages && page <= 5) {
    const res = await readJson("https://api.cursor.com/teams/spend", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ page, pageSize: 100 }),
    });
    if (!res.ok) {
      const note = res.status === 401 || res.status === 403
        ? (admin ? "This Cursor admin key can’t read the team bill." : "The agent key can’t read the team bill. A team admin key is required.")
        : res.status ? "Cursor didn’t return spend." : "Cursor didn’t answer.";
      return { ...base, note };
    }
    const body = res.data as { teamMemberSpend?: CursorMember[]; totalPages?: number };
    members.push(...(body.teamMemberSpend ?? []));
    pages = Math.max(1, Number(body.totalPages) || 1);
    page += 1;
  }
  let cents = 0;
  let saw = false;
  let onDemandLeft = 0;
  let sawLimit = false;
  let percentLeft: number | null = null;
  for (const member of members) {
    const overall = member.overallSpendCents;
    const piece = typeof overall === "number"
      ? overall
      : (Number(member.spendCents) || 0) + (Number(member.includedSpendCents) || 0);
    if (Number.isFinite(piece)) {
      cents += piece;
      saw = true;
    }
    if (typeof member.monthlyLimitDollars === "number" && typeof member.spendCents === "number") {
      onDemandLeft += Math.max(0, Math.round(member.monthlyLimitDollars * 100) - member.spendCents);
      sawLimit = true;
    }
    if (typeof member.totalPercentUsed === "number" && Number.isFinite(member.totalPercentUsed)) {
      const left = Math.max(0, Math.round(100 - member.totalPercentUsed));
      percentLeft = percentLeft == null ? left : Math.min(percentLeft, left);
    }
  }
  const left = sawLimit
    ? `${money(onDemandLeft)} on-demand room left`
    : percentLeft != null
      ? `${percentLeft}% of included usage left`
      : null;
  return {
    ...base,
    spent: saw ? `${money(cents)} · this cycle` : null,
    left,
    note: left ? "From the team bill." : "This plan doesn’t report a remaining credit balance.",
  };
}

export async function accountSpend(): Promise<AccountSpend[]> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.accounts;
  const accounts = await Promise.all([openAiSpend(), anthropicSpend(), cursorSpend()]);
  cached = { at: Date.now(), accounts };
  return accounts;
}
