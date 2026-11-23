/**
 * Partner Dashboard API — actions, stats, activity, active onboarding units.
 * Paths: GET/POST /api/admin/dashboard?op=…
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getSessionFromRequest,
  isAdminConfigured,
  loadPartnerFromSessionToken,
  verifyAdminSessionToken,
  verifyPartnerSessionToken,
} from "../adminAuth.js";
import { getSupabaseAdmin, isSupabaseConfigured } from "../supabase.js";
import { listPartners } from "../pm/partnerStore.js";
import { currentIndex, flowFor, type StageStatus } from "../pm/onboardingLogic.js";

export type DashboardActionType =
  | "contract_signed"
  | "awaiting_signature"
  | "onboarding_milestone"
  | "follow_up";

export type DashboardAction = {
  id: string;
  type: DashboardActionType | string;
  partner_id: string | null;
  lead_id: string | null;
  unit_id: string | null;
  title: string;
  body: string;
  dismissed_at: string | null;
  actioned_at: string | null;
  created_at: string;
  /** Enriched for the UI */
  lead_name?: string;
  lead_phone?: string;
  lead_first_name?: string;
  contract_url?: string | null;
  assigned_to?: string;
  stage?: string;
};

export type ActivityEvent = {
  id: string;
  kind: "call" | "contract_sent" | "contract_signed" | "onboarding" | "lead";
  title: string;
  created_at: string;
  partner_id: string | null;
  partner_name: string | null;
  mine: boolean;
  tone: "g" | "a" | "n";
};

export type DashboardOnboardingUnit = {
  id: string;
  address: string;
  client_name: string;
  stage: string;
  assigned_to: string;
  target_date: string | null;
  created_at: string;
};

export type CreateDashboardActionInput = {
  type: DashboardActionType | string;
  partnerId?: string | null;
  leadId?: string | null;
  unitId?: string | null;
  title: string;
  body: string;
};

function unauthorized(res: VercelResponse) {
  return res.status(401).json({ error: "Unauthorized" });
}

function readBody(req: VercelRequest): Record<string, unknown> {
  const raw = req.body;
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (Buffer.isBuffer(raw)) {
    try {
      return JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return raw as Record<string, unknown>;
}

function q(req: VercelRequest, key: string): string {
  const v = req.query[key];
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v) && typeof v[0] === "string") return String(v[0]).trim();
  return "";
}

function db() {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  return sb;
}

function mapAction(row: Record<string, unknown>): DashboardAction {
  return {
    id: String(row.id || ""),
    type: String(row.type || ""),
    partner_id: row.partner_id ? String(row.partner_id) : null,
    lead_id: row.lead_id ? String(row.lead_id) : null,
    unit_id: row.unit_id ? String(row.unit_id) : null,
    title: String(row.title || ""),
    body: String(row.body || ""),
    dismissed_at: row.dismissed_at ? String(row.dismissed_at) : null,
    actioned_at: row.actioned_at ? String(row.actioned_at) : null,
    created_at: String(row.created_at || ""),
  };
}

function missingDashboardTable(error: { message?: string } | null): Error | null {
  if (!error) return null;
  if (/dashboard_actions|relation|does not exist|schema cache/i.test(error.message || "")) {
    return new Error(
      "Dashboard tables missing. Run supabase/dashboard_v1.sql in Supabase, then retry.",
    );
  }
  return null;
}

function startOfMonthIso(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

function firstName(name: string): string {
  return (name || "").trim().split(/\s+/)[0] || "";
}

/** Resolve Shane's partner id for contract-signed alerts. */
export async function resolveShanePartnerId(): Promise<string | null> {
  const fromEnv = (process.env.SHANE_PARTNER_ID || "").trim();
  if (fromEnv) return fromEnv;
  try {
    const partners = await listPartners();
    const shane = partners.find((p) => /shane/i.test(p.name));
    return shane?.id || null;
  } catch {
    return null;
  }
}

/** Insert a dashboard action card. Safe to call from contract signing. */
export async function createDashboardAction(
  input: CreateDashboardActionInput,
): Promise<DashboardAction | null> {
  const title = String(input.title || "").trim();
  const body = String(input.body || "").trim();
  if (!title || !body) return null;
  const insert: Record<string, unknown> = {
    type: String(input.type || "follow_up").trim() || "follow_up",
    partner_id: input.partnerId?.trim() || null,
    lead_id: input.leadId?.trim() || null,
    unit_id: input.unitId?.trim() || null,
    title,
    body,
  };
  const { data, error } = await db().from("dashboard_actions").insert(insert).select("*").maybeSingle();
  if (error) {
    const mapped = missingDashboardTable(error);
    if (mapped) {
      console.warn("[dashboard] createDashboardAction:", mapped.message);
      return null;
    }
    throw error;
  }
  return data ? mapAction(data as Record<string, unknown>) : null;
}

async function partnerFromReq(
  req: VercelRequest,
): Promise<{ id: string; name: string; email: string } | null> {
  const token = getSessionFromRequest(req.headers.cookie);
  if (!token) return null;
  const parsed = verifyPartnerSessionToken(token);
  if (parsed.valid) {
    const partner = await loadPartnerFromSessionToken(token).catch(() => null);
    if (partner) return { id: partner.id, name: partner.name, email: partner.email };
  }
  return null;
}

async function enrichActions(actions: DashboardAction[]): Promise<DashboardAction[]> {
  const leadIds = [...new Set(actions.map((a) => a.lead_id).filter(Boolean))] as string[];
  if (!leadIds.length) return actions;
  const { data: leads } = await db()
    .from("leads")
    .select("id, name, full_name, phone, contract_id")
    .in("id", leadIds);
  const byId = new Map(
    ((leads ?? []) as Record<string, unknown>[]).map((l) => [String(l.id), l]),
  );
  const contractIds = [
    ...new Set(
      ((leads ?? []) as Record<string, unknown>[])
        .map((l) => String(l.contract_id || "").trim())
        .filter(Boolean),
    ),
  ];
  const contractById = new Map<string, Record<string, unknown>>();
  if (contractIds.length) {
    const { data: contracts } = await db()
      .from("pm_contracts")
      .select("id, sign_token, status")
      .in("id", contractIds);
    for (const c of (contracts ?? []) as Record<string, unknown>[]) {
      contractById.set(String(c.id), c);
    }
  }
  const origin = (
    process.env.ADMIN_PUBLIC_ORIGIN?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "https://admin.mandelrealtygroup.com"
  ).replace(/\/$/, "");

  return actions.map((a) => {
    const lead = a.lead_id ? byId.get(a.lead_id) : null;
    if (!lead) return a;
    const name = String(lead.full_name || lead.name || "").trim();
    const phone = String(lead.phone || "").trim();
    const contractId = String(lead.contract_id || "").trim();
    const contract = contractId ? contractById.get(contractId) : null;
    const token = contract ? String(contract.sign_token || "").trim() : "";
    return {
      ...a,
      lead_name: name,
      lead_phone: phone,
      lead_first_name: firstName(name) || "them",
      contract_url: token ? `${origin}/sign?token=${encodeURIComponent(token)}` : null,
    };
  });
}

async function listActions(partnerId: string | null): Promise<DashboardAction[]> {
  let query = db()
    .from("dashboard_actions")
    .select("*")
    .is("dismissed_at", null)
    .order("created_at", { ascending: false })
    .limit(20);

  if (partnerId) {
    query = query.or(`partner_id.eq.${partnerId},partner_id.is.null`);
  } else {
    query = query.is("partner_id", null);
  }

  const { data, error } = await query;
  if (error) {
    const mapped = missingDashboardTable(error);
    if (mapped) throw mapped;
    throw error;
  }
  const actions = ((data ?? []) as Record<string, unknown>[]).map(mapAction);
  return enrichActions(actions);
}

async function dismissOrAction(
  actionId: string,
  field: "dismissed_at" | "actioned_at",
): Promise<void> {
  const id = actionId.trim();
  if (!id) throw Object.assign(new Error("actionId is required."), { status: 400 });
  const { error } = await db()
    .from("dashboard_actions")
    .update({ [field]: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    const mapped = missingDashboardTable(error);
    if (mapped) throw mapped;
    throw error;
  }
}

async function stats(): Promise<{
  activeUnits: number;
  contractsSentThisMonth: number;
  signedThisMonth: number;
  liveUnits: number;
}> {
  const sb = db();
  const monthStart = startOfMonthIso();

  const [active, live, sent, signed] = await Promise.all([
    sb
      .from("onboarding_units")
      .select("id", { count: "exact", head: true })
      .eq("archived", false)
      .is("live_on", null),
    sb
      .from("onboarding_units")
      .select("id", { count: "exact", head: true })
      .eq("archived", false)
      .not("live_on", "is", null),
    sb
      .from("pm_contracts")
      .select("id", { count: "exact", head: true })
      .gt("created_at", monthStart),
    sb
      .from("pm_contracts")
      .select("id", { count: "exact", head: true })
      .gt("signed_at", monthStart),
  ]);

  for (const r of [active, live, sent, signed]) {
    if (r.error && /onboarding_units|pm_contracts|does not exist/i.test(r.error.message || "")) {
      /* table missing — treat as zero */
      continue;
    }
    if (r.error) throw r.error;
  }

  return {
    activeUnits: active.count ?? 0,
    contractsSentThisMonth: sent.count ?? 0,
    signedThisMonth: signed.count ?? 0,
    liveUnits: live.count ?? 0,
  };
}

async function activity(
  filter: "mine" | "all",
  partner: { id: string; name: string } | null,
): Promise<ActivityEvent[]> {
  const sb = db();
  const partnerFirst = partner ? firstName(partner.name).toLowerCase() : "";
  const partnerName = partner ? partner.name.trim().toLowerCase() : "";
  const isMineName = (name: string) => {
    const n = name.trim().toLowerCase();
    if (!n || !partner) return false;
    return n === partnerName || n === partnerFirst || n.includes(partnerFirst);
  };

  const events: ActivityEvent[] = [];

  const [calls, contracts, units, leads, history] = await Promise.all([
    sb.from("lead_calls").select("id, created_at, lead_id, status, meta").order("created_at", { ascending: false }).limit(20),
    sb
      .from("pm_contracts")
      .select("id, created_at, signed_at, status, title, client_id")
      .order("created_at", { ascending: false })
      .limit(20),
    sb
      .from("onboarding_units")
      .select("id, address, owner_name, assignee, started_on, live_on, created_at, lead_id")
      .eq("archived", false)
      .order("started_on", { ascending: false })
      .limit(20),
    sb.from("leads").select("id, created_at, name, full_name, source, closed_by, booked_by").order("created_at", { ascending: false }).limit(20),
    sb
      .from("onboarding_history")
      .select("id, ts, actor, action, detail, unit_id")
      .order("ts", { ascending: false })
      .limit(20),
  ]);

  const leadIds = new Set<string>();
  for (const c of (calls.data ?? []) as Record<string, unknown>[]) {
    if (c.lead_id) leadIds.add(String(c.lead_id));
  }
  for (const l of (leads.data ?? []) as Record<string, unknown>[]) {
    leadIds.add(String(l.id));
  }
  const leadNameById = new Map<string, string>();
  if (leadIds.size) {
    const { data } = await sb.from("leads").select("id, name, full_name").in("id", [...leadIds]);
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      leadNameById.set(String(row.id), String(row.full_name || row.name || "").trim() || "a lead");
    }
  }

  for (const c of (calls.data ?? []) as Record<string, unknown>[]) {
    const leadName = leadNameById.get(String(c.lead_id || "")) || "a lead";
    const meta = c.meta && typeof c.meta === "object" ? (c.meta as Record<string, unknown>) : {};
    const caller = String(meta.partner_name || meta.operator_name || "").trim();
    events.push({
      id: `call:${c.id}`,
      kind: "call",
      title: caller
        ? `<b>${escapeHtml(caller)}</b> called <b>${escapeHtml(leadName)}</b>`
        : `Call with <b>${escapeHtml(leadName)}</b>`,
      created_at: String(c.created_at || ""),
      partner_id: null,
      partner_name: caller || null,
      mine: isMineName(caller),
      tone: "a",
    });
  }

  for (const c of (contracts.data ?? []) as Record<string, unknown>[]) {
    const title = String(c.title || "agreement").trim();
    const created = String(c.created_at || "");
    events.push({
      id: `contract-sent:${c.id}`,
      kind: "contract_sent",
      title: `Contract sent · <b>${escapeHtml(title)}</b>`,
      created_at: created,
      partner_id: null,
      partner_name: null,
      mine: false,
      tone: "a",
    });
    if (c.signed_at) {
      events.push({
        id: `contract-signed:${c.id}`,
        kind: "contract_signed",
        title: `<b>${escapeHtml(title)}</b> was signed`,
        created_at: String(c.signed_at),
        partner_id: null,
        partner_name: null,
        mine: false,
        tone: "g",
      });
    }
  }

  for (const h of (history.data ?? []) as Record<string, unknown>[]) {
    const actor = String(h.actor || "").trim() || "Team";
    const action = String(h.action || "").trim();
    const detail = String(h.detail || "").trim();
    events.push({
      id: `hist:${h.id}`,
      kind: "onboarding",
      title: `<b>${escapeHtml(actor)}</b> ${escapeHtml(action)}${detail ? `: ${escapeHtml(detail)}` : ""}`,
      created_at: String(h.ts || ""),
      partner_id: null,
      partner_name: actor,
      mine: isMineName(actor),
      tone: "n",
    });
  }

  for (const u of (units.data ?? []) as Record<string, unknown>[]) {
    const address = String(u.address || "a unit").trim();
    const created = String(u.created_at || u.started_on || "");
    if (!created) continue;
    events.push({
      id: `unit:${u.id}`,
      kind: "onboarding",
      title: `Onboarding started · <b>${escapeHtml(address)}</b>`,
      created_at: created,
      partner_id: null,
      partner_name: String(u.assignee || "").trim() || null,
      mine: isMineName(String(u.assignee || "")),
      tone: "n",
    });
  }

  for (const l of (leads.data ?? []) as Record<string, unknown>[]) {
    const name = String(l.full_name || l.name || "New lead").trim();
    const source = String(l.source || "").trim();
    const closedBy = String(l.closed_by || "").trim();
    const bookedBy = String(l.booked_by || "").trim();
    events.push({
      id: `lead:${l.id}`,
      kind: "lead",
      title: `New lead: <b>${escapeHtml(name)}</b>${source ? ` (${escapeHtml(source)})` : ""}`,
      created_at: String(l.created_at || ""),
      partner_id: null,
      partner_name: closedBy || bookedBy || null,
      mine: isMineName(closedBy) || isMineName(bookedBy),
      tone: "n",
    });
  }

  void calls.error;
  void contracts.error;
  void units.error;
  void leads.error;
  void history.error;

  events.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const filtered = filter === "mine" ? events.filter((e) => e.mine) : events;
  return filtered.slice(0, 20);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function activeOnboardingUnits(): Promise<DashboardOnboardingUnit[]> {
  const sb = db();
  const { data: units, error } = await sb
    .from("onboarding_units")
    .select(
      "id, address, owner_name, assignee, stage_due_on, started_on, live_on, plan, plan_tier, furniture, lead_id, created_at",
    )
    .eq("archived", false)
    .is("live_on", null)
    .order("started_on", { ascending: false })
    .limit(10);

  if (error) {
    if (/onboarding_units|does not exist/i.test(error.message || "")) return [];
    throw error;
  }

  const rows = (units ?? []) as Record<string, unknown>[];
  if (!rows.length) return [];

  const unitIds = rows.map((u) => String(u.id));
  const leadIds = rows.map((u) => String(u.lead_id || "")).filter(Boolean);

  const [{ data: stages }, { data: leads }] = await Promise.all([
    sb.from("onboarding_unit_stages").select("unit_id, stage, position, status").in("unit_id", unitIds),
    leadIds.length
      ? sb.from("leads").select("id, name, full_name").in("id", leadIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  const stagesByUnit: Record<string, { stage: string; position: number; status: string }[]> = {};
  for (const s of (stages ?? []) as { unit_id: string; stage: string; position: number; status: string }[]) {
    (stagesByUnit[s.unit_id] ??= []).push(s);
  }
  const leadName = new Map(
    ((leads ?? []) as Record<string, unknown>[]).map((l) => [
      String(l.id),
      String(l.full_name || l.name || "").trim(),
    ]),
  );

  return rows.map((u) => {
    const id = String(u.id);
    const active = flowFor(
      String(u.plan || ""),
      String(u.plan_tier || ""),
      String(u.furniture || "") || "none",
    );
    const byName = new Map((stagesByUnit[id] ?? []).map((s) => [s.stage, s]));
    const statuses = active.map((name) => (byName.get(name)?.status ?? "todo") as StageStatus);
    const idx = currentIndex(statuses);
    const stage = active[idx] || "Audit";
    const leadId = u.lead_id ? String(u.lead_id) : "";
    return {
      id,
      address: String(u.address || "").trim(),
      client_name:
        (leadId && leadName.get(leadId)) || String(u.owner_name || "").trim() || "—",
      stage,
      assigned_to: String(u.assignee || "").trim() || "—",
      target_date: u.stage_due_on ? String(u.stage_due_on) : null,
      created_at: String(u.created_at || u.started_on || ""),
    };
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAdminConfigured()) {
    return res.status(503).json({ error: "Admin is not configured." });
  }

  const token = getSessionFromRequest(req.headers.cookie);
  if (!verifyAdminSessionToken(token)) {
    return unauthorized(res);
  }

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: "Supabase is not configured." });
  }

  const body = req.method === "GET" || req.method === "HEAD" ? {} : readBody(req);
  const op = (q(req, "op") || String(body.op ?? "").trim()).toLowerCase();

  try {
    if (req.method === "GET" || req.method === "HEAD") {
      if (op === "actions" || !op) {
        const partner = await partnerFromReq(req);
        const actions = await listActions(partner?.id ?? null);
        return res.status(200).json({ actions });
      }
      if (op === "stats") {
        return res.status(200).json(await stats());
      }
      if (op === "activity") {
        const filter = q(req, "filter") === "mine" ? "mine" : "all";
        const partner = await partnerFromReq(req);
        const events = await activity(filter, partner);
        return res.status(200).json({ events });
      }
      if (op === "onboarding") {
        const units = await activeOnboardingUnits();
        return res.status(200).json({ units });
      }
      return res.status(400).json({
        error: "Use op=actions, op=stats, op=activity, or op=onboarding",
      });
    }

    if (req.method === "POST") {
      if (op === "dismiss") {
        await dismissOrAction(String(body.actionId ?? ""), "dismissed_at");
        return res.status(200).json({ ok: true });
      }
      if (op === "action") {
        await dismissOrAction(String(body.actionId ?? ""), "actioned_at");
        return res.status(200).json({ ok: true });
      }
      return res.status(400).json({ error: "Use op=dismiss or op=action" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    const status = e && typeof e === "object" && "status" in e ? Number((e as { status: number }).status) : 500;
    const msg = e instanceof Error ? e.message : "Dashboard request failed.";
    return res.status(status >= 400 && status < 600 ? status : 500).json({ error: msg });
  }
}
