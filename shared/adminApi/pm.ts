import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getSessionFromRequest,
  isAdminConfigured,
  verifyAdminSessionToken,
} from "../adminAuth.js";
import {
  createContract,
  deleteContract,
  getContract,
  getContractDownloadUrl,
  getContractEditPdfUrl,
  downloadContractSourceBuffer,
  listContracts,
  assignAwaitingContract,
  cancelAwaitingContracts,
} from "../pm/contractStore.js";
import {
  archiveContractTemplate,
  deleteContractTemplate,
  createContractTemplate,
  downloadTemplateBuffer,
  getTemplateDownloadUrl,
  listContractTemplates,
} from "../pm/contractTemplateStore.js";
import {
  hasHostSignature,
  mrgFields,
  normalizeSignFields,
  todayIsoDate,
} from "../pm/signFields.js";
import { stampSignedPdf } from "../pm/stampSignedPdf.js";
import {
  createOrRefreshPortalInvite,
  ensurePortalUserForClient,
  getPortalUserByClientId,
  publicPortalUser,
} from "../pm/portalUserStore.js";
import { createOwnerPreviewToken } from "../portalAuth.js";
import { ownerPortalUrl, sendOwnerInviteEmail } from "../ownerEmails.js";
import {
  createPmClient,
  deletePmClient,
  getHospitablePat,
  getPmClient,
  getPmSettings,
  isHospitableConfigured,
  listPmClients,
  updatePmClient,
  updatePmSettings,
} from "../pm/clientStore.js";
import {
  listAllHospitableProperties,
  verifyHospitablePat,
} from "../pm/hospitableClient.js";
import {
  AUTO_SYNC_LOOKBACK_MONTHS,
  previousYearMonth,
  propertyNeedsAutoSync,
  syncHospitableReservations,
} from "../pm/reservationStore.js";
import { syncHospitableReviews } from "../pm/reviewStore.js";
import { markMatFiling } from "../pm/matCompliance.js";
import { buildOwnerStatement } from "../pm/ownerStatement.js";
import {
  buildCompanyMonthPnl,
  createCompanyExpense,
  deleteCompanyExpense,
  deleteCompanySubscription,
  emptyCompanyMonthPnl,
  listCompanySubscriptions,
  upsertCompanySubscription,
} from "../pm/companyCostStore.js";
import {
  buildMonthPortfolio,
  buildMonthStatement,
  createManualExpense,
  deleteManualExpense,
  getExpenseReceiptUrl,
} from "../pm/statementMath.js";
import {
  changePmCommission,
  createPmProperty,
  getPmPropertyDetail,
  getPropertyCoverUrl,
  importHospitableProperty,
  listLinkedHospitableIds,
  listPmProperties,
  removePropertyCover,
  updatePmProperty,
  uploadPropertyCover,
} from "../pm/propertyStore.js";
import {
  createPmTask,
  deletePmTask,
  getPmTask,
  listPmTasks,
  updatePmTask,
  type TaskPriority,
  type TaskRepeat,
  type TaskStatus,
  type TaskType,
} from "../pm/taskStore.js";
import {
  createPmTeamMember,
  deletePmTeamMember,
  listPmTeamMembers,
} from "../pm/teamStore.js";
import {
  deleteSop,
  getSopBySlug,
  listSops,
  uploadSopVideo,
  upsertSop,
} from "../pm/sopStore.js";
import { percentToRateBps } from "../pm/types.js";
import { isSupabaseConfigured } from "../supabase.js";

const TASK_STATUSES = new Set<TaskStatus>([
  "open",
  "in_progress",
  "blocked",
  "done",
]);
const TASK_PRIORITIES = new Set<TaskPriority>(["normal", "high"]);
const TASK_TYPES = new Set<TaskType>([
  "cleaning",
  "maintenance",
  "owner",
  "compliance",
  "statement",
  "supplies",
  "marketing",
  "software",
  "other",
]);
const TASK_REPEATS = new Set<TaskRepeat>(["off", "weekly", "monthly"]);

function asTaskStatus(v: unknown): TaskStatus | undefined {
  const s = str(v) as TaskStatus;
  return TASK_STATUSES.has(s) ? s : undefined;
}
function asTaskPriority(v: unknown): TaskPriority | undefined {
  const s = str(v) as TaskPriority;
  return TASK_PRIORITIES.has(s) ? s : undefined;
}
function asTaskType(v: unknown): TaskType | undefined {
  const s = str(v) as TaskType;
  return TASK_TYPES.has(s) ? s : undefined;
}
function asTaskRepeat(v: unknown): TaskRepeat | undefined {
  const s = str(v) as TaskRepeat;
  return TASK_REPEATS.has(s) ? s : undefined;
}

function asAssignees(v: unknown): string[] | undefined {
  if (v === undefined) return undefined;
  if (Array.isArray(v)) {
    return [
      ...new Set(
        v
          .map((x) => str(x))
          .filter(Boolean),
      ),
    ];
  }
  if (typeof v === "string") {
    return v
      .split(/\s*·\s*|\s*,\s*/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return undefined;
}

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
  return raw as Record<string, unknown>;
}

function resourceOf(req: VercelRequest): string {
  const q = req.query.resource;
  return typeof q === "string" ? q.trim() : "";
}

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function moneyToCents(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.round(v * 100);
  }
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(n)) return Math.round(n * 100);
  }
  return NaN;
}

async function settingsPayload(extra: Record<string, unknown> = {}) {
  const settings = await getPmSettings();
  return {
    settings,
    hospitable_connected: await isHospitableConfigured(),
    ...extra,
  };
}

function apiErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) {
    const m = err.message;
    if (/pm_reservations|pm_manual_expenses|pm_contracts|pm_tasks|pm_company_|cleaning_fee_keeper|hst_bps|default_hst_bps|commission_base_mode|hst_mode/i.test(m) && /does not exist|schema cache|column/i.test(m)) {
      return "Database columns missing. Run the latest supabase/*.sql migrations in Supabase, then retry.";
    }
    return m;
  }
  if (err && typeof err === "object") {
    const o = err as { message?: unknown; error?: unknown; details?: unknown; hint?: unknown };
    const parts = [o.message, o.error, o.details, o.hint]
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter(Boolean);
    if (parts.length) {
      const m = parts.join(" — ");
      if (/pm_reservations|pm_manual_expenses|pm_contracts/i.test(m) && /does not exist|schema cache/i.test(m)) {
        return "Earnings tables missing. Run supabase/pm_earnings_contracts_v1.sql in Supabase, then retry.";
      }
      return m;
    }
  }
  return "Request failed.";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAdminConfigured()) {
    return res.status(503).json({ error: "Admin is not configured." });
  }
  const token = getSessionFromRequest(req.headers.cookie);
  if (!verifyAdminSessionToken(token)) return unauthorized(res);
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: "Supabase is not configured." });
  }

  const resource = resourceOf(req);

  try {
    if (req.method === "GET") {
      if (resource === "clients") {
        const clients = await listPmClients();
        return res.status(200).json({ clients });
      }
      if (resource === "properties") {
        const clientId =
          typeof req.query.client_id === "string" ? req.query.client_id.trim() : "";
        const propertyId =
          typeof req.query.id === "string" ? req.query.id.trim() : "";
        if (propertyId) {
          const property = await getPmPropertyDetail(propertyId);
          if (!property) return res.status(404).json({ error: "Property not found." });
          return res.status(200).json({ property });
        }
        const properties = await listPmProperties(clientId || undefined);
        return res.status(200).json({ properties });
      }
      if (resource === "settings") {
        return res.status(200).json(await settingsPayload());
      }
      if (resource === "hospitable") {
        const pat = await getHospitablePat();
        if (!pat) {
          return res.status(400).json({
            error: "Hospitable is not connected. Paste your PAT in Settings first.",
          });
        }
        const [all, linked] = await Promise.all([
          listAllHospitableProperties(pat),
          listLinkedHospitableIds(),
        ]);
        const available = all.filter((p) => !linked.has(p.id));
        return res.status(200).json({
          available,
          total: all.length,
          linked_count: linked.size,
        });
      }
      if (resource === "month_close") {
        const yearMonth =
          typeof req.query.month === "string" && /^\d{4}-\d{2}$/.test(req.query.month)
            ? req.query.month
            : previousYearMonth();
        const clientId =
          typeof req.query.client_id === "string" ? req.query.client_id.trim() : "";
        const portfolio = await buildMonthPortfolio(yearMonth, {
          clientId: clientId || undefined,
        });
        const fees = {
          management_fees_cents: portfolio.mrg_commission_cents,
          hst_cohost_cents: portfolio.hst_cohost_cents ?? 0,
          hst_invoice_cents: portfolio.hst_invoice_cents,
        };
        let company = emptyCompanyMonthPnl(yearMonth, fees);
        try {
          company = await buildCompanyMonthPnl(yearMonth, fees);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "";
          if (!/pm_company_|does not exist|schema cache/i.test(msg)) throw err;
        }
        return res.status(200).json({ portfolio, company });
      }
      if (resource === "owner_statement") {
        const yearMonth =
          typeof req.query.month === "string" && /^\d{4}-\d{2}$/.test(req.query.month)
            ? req.query.month
            : previousYearMonth();
        const clientId =
          typeof req.query.client_id === "string" ? req.query.client_id.trim() : "";
        if (!clientId) {
          return res.status(400).json({ error: "client_id required." });
        }
        try {
          const statement = await buildOwnerStatement(clientId, yearMonth);
          return res.status(200).json({ statement });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Could not build statement.";
          const status = msg.includes("not found") ? 404 : 400;
          return res.status(status).json({ error: msg });
        }
      }
      if (resource === "earnings") {
        const propertyId =
          typeof req.query.property_id === "string" ? req.query.property_id.trim() : "";
        const yearMonth =
          typeof req.query.month === "string" && /^\d{4}-\d{2}$/.test(req.query.month)
            ? req.query.month
            : previousYearMonth();
        if (!propertyId) return res.status(400).json({ error: "property_id required." });

        const detail = await getPmPropertyDetail(propertyId);
        if (!detail) return res.status(400).json({ error: "Property not found." });

        let statement = await buildMonthStatement(propertyId, yearMonth);
        let autoSynced = false;
        let syncReason = "";

        const wantAuto =
          req.query.auto_sync !== "0" &&
          Boolean(detail.hospitable_property_id);

        if (wantAuto) {
          const need = await propertyNeedsAutoSync(propertyId, yearMonth);
          if (need.needed) {
            if (need.reason === "zero_financials") {
              // Re-pull the viewed month so payouts re-parse correctly.
              await syncHospitableReservations({ propertyId, yearMonth });
            } else {
              await syncHospitableReservations({
                propertyId,
                lookbackMonths: AUTO_SYNC_LOOKBACK_MONTHS,
              });
            }
            statement = await buildMonthStatement(propertyId, yearMonth);
            autoSynced = true;
            syncReason = need.reason;
          }
        }

        return res.status(200).json({
          statement,
          auto_synced: autoSynced,
          sync_reason: syncReason || undefined,
        });
      }
      if (resource === "expense_receipt") {
        const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
        if (!id) return res.status(400).json({ error: "id required." });
        const url = await getExpenseReceiptUrl(id);
        return res.status(200).json({ url });
      }
      if (resource === "property_cover") {
        const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
        if (!id) return res.status(400).json({ error: "id required." });
        const url = await getPropertyCoverUrl(id);
        if (!url) return res.status(404).json({ error: "No cover photo." });
        return res.status(200).json({ url });
      }
      if (resource === "contracts") {
        const clientId =
          typeof req.query.client_id === "string" ? req.query.client_id.trim() : "";
        const propertyId =
          typeof req.query.property_id === "string" ? req.query.property_id.trim() : "";
        const contracts = await listContracts({
          client_id: clientId || undefined,
          property_id: propertyId || undefined,
        });
        return res.status(200).json({ contracts });
      }
      if (resource === "contract_url") {
        const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
        if (!id) return res.status(400).json({ error: "id required." });
        const source =
          req.query.source === "1" ||
          req.query.source === "true" ||
          req.query.edit === "1";
        const url = source
          ? await getContractEditPdfUrl(id)
          : await getContractDownloadUrl(id);
        return res.status(200).json({ url });
      }
      if (resource === "contract_templates") {
        const include =
          req.query.include_archived === "1" || req.query.include_archived === "true";
        const templates = await listContractTemplates(include);
        return res.status(200).json({ templates });
      }
      if (resource === "contract_template_url") {
        const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
        if (!id) return res.status(400).json({ error: "id required." });
        const url = await getTemplateDownloadUrl(id);
        return res.status(200).json({ url });
      }
      if (resource === "portal_preview") {
        const clientId =
          typeof req.query.client_id === "string" ? req.query.client_id.trim() : "";
        if (!clientId) return res.status(400).json({ error: "client_id required." });
        const client = await getPmClient(clientId);
        if (!client) return res.status(404).json({ error: "Client not found." });
        const user = await ensurePortalUserForClient({
          pm_client_id: clientId,
          email: client.email,
          fullName: client.name,
        });
        return res.status(200).json({
          slug: user.slug,
          preview_token: createOwnerPreviewToken(user.slug),
          owner_url: ownerPortalUrl(user.slug),
        });
      }
      if (resource === "portal_user") {
        const clientId =
          typeof req.query.client_id === "string" ? req.query.client_id.trim() : "";
        if (!clientId) return res.status(400).json({ error: "client_id required." });
        const user = await getPortalUserByClientId(clientId);
        const { getAwaitingContractForClient, listSignedContractsForClient } =
          await import("../pm/contractStore.js");
        const awaiting = user ? await getAwaitingContractForClient(clientId) : null;
        const signed = user ? await listSignedContractsForClient(clientId) : [];
        return res.status(200).json({
          portal_user: user ? publicPortalUser(user) : null,
          owner_url: user ? ownerPortalUrl(user.slug) : null,
          awaiting_contract: awaiting
            ? {
                id: awaiting.id,
                title: awaiting.title,
                status: awaiting.status,
                template_id: awaiting.template_id || null,
                sign_fields: awaiting.sign_fields ?? [],
              }
            : null,
          signed_contracts: signed.map((c) => ({
            id: c.id,
            title: c.title,
            signed_on: c.signed_on,
            status: c.status,
          })),
        });
      }
      if (resource === "tasks") {
        const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
        if (id) {
          const task = await getPmTask(id);
          if (!task) return res.status(404).json({ error: "Task not found." });
          return res.status(200).json({ task });
        }
        const statusRaw =
          typeof req.query.status === "string" ? req.query.status.trim() : "openish";
        const status =
          statusRaw === "all" || statusRaw === "openish"
            ? statusRaw
            : asTaskStatus(statusRaw) || "openish";
        const assignee =
          typeof req.query.assignee === "string" ? req.query.assignee.trim() : "";
        const taskTypeRaw =
          typeof req.query.task_type === "string" ? req.query.task_type.trim() : "";
        const task_type = asTaskType(taskTypeRaw) || "";
        const tasks = await listPmTasks({
          status,
          assignee: assignee || undefined,
          task_type: task_type || undefined,
        });
        return res.status(200).json({ tasks });
      }
      if (resource === "team_members") {
        const members = await listPmTeamMembers();
        return res.status(200).json({ members });
      }
      if (resource === "sops") {
        const slug = typeof req.query.slug === "string" ? req.query.slug.trim() : "";
        if (slug) {
          const sop = await getSopBySlug(slug);
          return res.status(200).json({ sop });
        }
        const category = typeof req.query.category === "string" ? req.query.category.trim() : undefined;
        const sops = await listSops({ category });
        return res.status(200).json({ sops });
      }
      if (resource === "company_subscriptions") {
        const subscriptions = await listCompanySubscriptions();
        return res.status(200).json({ subscriptions });
      }
      return res.status(400).json({ error: "Unknown resource." });
    }

    if (req.method === "POST") {
      const body = readBody(req);
      const op = str(body.op);

      if (resource === "clients") {
        if (op === "create") {
          const client = await createPmClient({
            name: str(body.name),
            email: str(body.email),
            phone: str(body.phone),
            status: body.status === "paused" ? "paused" : "active",
          });
          return res.status(200).json({ client });
        }
        if (op === "update") {
          const id = str(body.id);
          if (!id) return res.status(400).json({ error: "id required." });
          const client = await updatePmClient(id, {
            name: body.name != null ? str(body.name) : undefined,
            email: body.email != null ? str(body.email) : undefined,
            phone: body.phone != null ? str(body.phone) : undefined,
            status:
              body.status === "paused" || body.status === "active"
                ? body.status
                : undefined,
          });
          return res.status(200).json({ client });
        }
        if (op === "delete") {
          const id = str(body.id);
          if (!id) return res.status(400).json({ error: "id required." });
          await deletePmClient(id);
          return res.status(200).json({ ok: true });
        }
      }

      if (resource === "properties") {
        if (op === "create") {
          let hstBps: number | undefined;
          if (typeof body.hst_bps === "number") hstBps = body.hst_bps;
          else if (typeof body.hst_percent === "number" || typeof body.hst_percent === "string") {
            hstBps = percentToRateBps(Number(body.hst_percent));
          }
          let rateBps: number | undefined;
          if (typeof body.rate_bps === "number") rateBps = body.rate_bps;
          else if (typeof body.rate_percent === "number" || typeof body.rate_percent === "string") {
            rateBps = percentToRateBps(Number(body.rate_percent));
          }
          const property = await createPmProperty({
            client_id: str(body.client_id),
            name: str(body.name),
            address: str(body.address),
            hospitable_property_id: str(body.hospitable_property_id),
            cleaning_fee_keeper:
              body.cleaning_fee_keeper === "host" || body.cleaning_fee_keeper === "mrg"
                ? body.cleaning_fee_keeper
                : undefined,
            commission_base_mode:
              body.commission_base_mode === "nightly" ||
              body.commission_base_mode === "nightly_minus_host_fee"
                ? body.commission_base_mode
                : undefined,
            hst_mode:
              body.hst_mode === "invoice" || body.hst_mode === "cohost"
                ? body.hst_mode
                : undefined,
            hst_bps: hstBps,
            rate_bps: rateBps,
          });
          return res.status(200).json({ property });
        }
        if (op === "import_hospitable") {
          let hstBps: number | undefined;
          if (typeof body.hst_bps === "number") hstBps = body.hst_bps;
          else if (typeof body.hst_percent === "number" || typeof body.hst_percent === "string") {
            hstBps = percentToRateBps(Number(body.hst_percent));
          }
          let rateBps: number | undefined;
          if (typeof body.rate_bps === "number") rateBps = body.rate_bps;
          else if (typeof body.rate_percent === "number" || typeof body.rate_percent === "string") {
            rateBps = percentToRateBps(Number(body.rate_percent));
          }
          const property = await importHospitableProperty({
            client_id: str(body.client_id),
            hospitable_property_id: str(body.hospitable_property_id),
            name: str(body.name),
            address: str(body.address),
            cleaning_fee_keeper:
              body.cleaning_fee_keeper === "host" || body.cleaning_fee_keeper === "mrg"
                ? body.cleaning_fee_keeper
                : undefined,
            commission_base_mode:
              body.commission_base_mode === "nightly" ||
              body.commission_base_mode === "nightly_minus_host_fee"
                ? body.commission_base_mode
                : undefined,
            hst_mode:
              body.hst_mode === "invoice" || body.hst_mode === "cohost"
                ? body.hst_mode
                : undefined,
            hst_bps: hstBps,
            rate_bps: rateBps,
          });
          return res.status(200).json({ property });
        }
        if (op === "update") {
          const id = str(body.id);
          if (!id) return res.status(400).json({ error: "id required." });
          let hstBps: number | undefined;
          if (typeof body.hst_bps === "number") hstBps = body.hst_bps;
          else if (typeof body.hst_percent === "number" || typeof body.hst_percent === "string") {
            hstBps = percentToRateBps(Number(body.hst_percent));
          }
          const keeper =
            body.cleaning_fee_keeper === "host" || body.cleaning_fee_keeper === "mrg"
              ? body.cleaning_fee_keeper
              : undefined;
          const baseMode =
            body.commission_base_mode === "nightly" ||
            body.commission_base_mode === "nightly_minus_host_fee"
              ? body.commission_base_mode
              : undefined;
          const hstMode =
            body.hst_mode === "invoice" || body.hst_mode === "cohost"
              ? body.hst_mode
              : undefined;
          const property = await updatePmProperty(id, {
            name: body.name != null ? str(body.name) : undefined,
            address: body.address != null ? str(body.address) : undefined,
            client_id: body.client_id != null ? str(body.client_id) : undefined,
            hospitable_property_id:
              body.hospitable_property_id != null
                ? str(body.hospitable_property_id)
                : undefined,
            active: typeof body.active === "boolean" ? body.active : undefined,
            cleaning_fee_keeper: keeper,
            commission_base_mode: baseMode,
            hst_mode: hstMode,
            hst_bps: hstBps,
            str_permit_number:
              body.str_permit_number != null ? str(body.str_permit_number) : undefined,
            str_municipality:
              body.str_municipality != null ? str(body.str_municipality) : undefined,
            str_permit_applied_on:
              body.str_permit_applied_on === null
                ? null
                : body.str_permit_applied_on != null
                  ? str(body.str_permit_applied_on) || null
                  : undefined,
            str_permit_issued_on:
              body.str_permit_issued_on === null
                ? null
                : body.str_permit_issued_on != null
                  ? str(body.str_permit_issued_on) || null
                  : undefined,
            str_day_cap:
              typeof body.str_day_cap === "number"
                ? body.str_day_cap
                : body.str_day_cap != null
                  ? Number(body.str_day_cap)
                  : undefined,
            mat_required:
              typeof body.mat_required === "boolean" ? body.mat_required : undefined,
          });
          return res.status(200).json({ property });
        }
        if (op === "mark_mat_filing") {
          const propertyId = str(body.property_id || body.id);
          if (!propertyId) return res.status(400).json({ error: "property_id required." });
          const year = Number(body.year);
          const quarter = Number(body.quarter);
          if (!Number.isFinite(year) || !Number.isFinite(quarter)) {
            return res.status(400).json({ error: "year and quarter required." });
          }
          const filed =
            body.filed === true || body.filed === 1 || body.filed === "1";
          await markMatFiling({
            property_id: propertyId,
            year,
            quarter,
            filed,
            filed_on:
              body.filed_on === null
                ? null
                : body.filed_on != null
                  ? str(body.filed_on) || null
                  : undefined,
            notes: body.notes != null ? str(body.notes) : undefined,
          });
          const property = await getPmPropertyDetail(propertyId);
          return res.status(200).json({ property });
        }
        if (op === "change_rate") {
          const propertyId = str(body.property_id || body.id);
          if (!propertyId) return res.status(400).json({ error: "property_id required." });
          let rateBps: number;
          if (typeof body.rate_bps === "number") rateBps = body.rate_bps;
          else if (typeof body.rate_percent === "number") {
            rateBps = percentToRateBps(body.rate_percent);
          } else if (typeof body.rate_percent === "string") {
            rateBps = percentToRateBps(Number(body.rate_percent));
          } else {
            return res.status(400).json({ error: "rate_percent required." });
          }
          const property = await changePmCommission({
            property_id: propertyId,
            rate_bps: rateBps,
            effective_from: str(body.effective_from),
            note: str(body.note),
          });
          return res.status(200).json({ property });
        }
        if (op === "link_hospitable") {
          const id = str(body.id);
          if (!id) return res.status(400).json({ error: "id required." });
          const hid = str(body.hospitable_property_id);
          if (hid) {
            const linked = await listLinkedHospitableIds();
            const existing = await getPmPropertyDetail(id);
            if (linked.has(hid) && existing?.hospitable_property_id !== hid) {
              return res.status(400).json({
                error: "That Hospitable unit is already linked to another property.",
              });
            }
          }
          const property = await updatePmProperty(id, {
            hospitable_property_id: hid,
          });
          return res.status(200).json({ property });
        }
        if (op === "upload_cover") {
          const id = str(body.id || body.property_id);
          if (!id) return res.status(400).json({ error: "id required." });
          const b64 = str(body.image_base64 || body.cover_base64);
          if (!b64) return res.status(400).json({ error: "image_base64 required." });
          let buffer: Buffer;
          try {
            buffer = Buffer.from(b64, "base64");
          } catch {
            return res.status(400).json({ error: "Invalid image_base64." });
          }
          const property = await uploadPropertyCover({
            property_id: id,
            filename: str(body.filename) || "cover.jpg",
            mime: str(body.mime) || "image/jpeg",
            buffer,
          });
          return res.status(200).json({ property });
        }
        if (op === "remove_cover") {
          const id = str(body.id || body.property_id);
          if (!id) return res.status(400).json({ error: "id required." });
          const property = await removePropertyCover(id);
          return res.status(200).json({ property });
        }
      }

      if (resource === "earnings") {
        if (op === "sync") {
          const yearMonth =
            str(body.month) && /^\d{4}-\d{2}$/.test(str(body.month))
              ? str(body.month)
              : previousYearMonth();
          const propertyId = str(body.property_id) || undefined;
          const lookback =
            body.lookback === true || body.lookback === 1 || body.lookback === "1";
          const result = await syncHospitableReservations(
            lookback
              ? { propertyId, lookbackMonths: AUTO_SYNC_LOOKBACK_MONTHS }
              : { yearMonth, propertyId },
          );
          let reviewsSynced = 0;
          try {
            const rev = await syncHospitableReviews(
              propertyId ? { propertyId } : undefined,
            );
            reviewsSynced = rev.synced;
          } catch {
            /* reviews optional until migration */
          }
          const statement = propertyId
            ? await buildMonthStatement(propertyId, yearMonth)
            : null;
          return res.status(200).json({
            ...result,
            reviews_synced: reviewsSynced,
            statement,
            month: yearMonth,
          });
        }
        if (op === "sync_reviews") {
          const propertyId = str(body.property_id) || undefined;
          const result = await syncHospitableReviews(
            propertyId ? { propertyId } : undefined,
          );
          return res.status(200).json(result);
        }
        if (op === "add_expense") {
          const amountCents =
            typeof body.amount_cents === "number"
              ? Math.round(body.amount_cents)
              : moneyToCents(body.amount);
          if (!Number.isFinite(amountCents)) {
            return res.status(400).json({ error: "amount required." });
          }
          let receipt:
            | { filename: string; mime: string; buffer: Buffer }
            | null = null;
          const receiptB64 = str(body.receipt_base64);
          if (receiptB64) {
            if (receiptB64.length > 14_000_000) {
              return res.status(400).json({ error: "Receipt too large (max ~10MB)." });
            }
            try {
              receipt = {
                filename: str(body.receipt_filename) || "receipt.pdf",
                mime: str(body.receipt_mime) || "application/pdf",
                buffer: Buffer.from(receiptB64, "base64"),
              };
            } catch {
              return res.status(400).json({ error: "Invalid receipt base64." });
            }
          }
          const expense = await createManualExpense({
            property_id: str(body.property_id),
            expense_date: str(body.expense_date),
            category: str(body.category) || "other",
            label: str(body.label) || str(body.note),
            amount_cents: amountCents,
            note: str(body.note),
            receipt,
          });
          return res.status(200).json({ expense });
        }
        if (op === "delete_expense") {
          const id = str(body.id);
          if (!id) return res.status(400).json({ error: "id required." });
          await deleteManualExpense(id);
          return res.status(200).json({ ok: true });
        }
      }

      if (resource === "contracts") {
        if (op === "create") {
          const filename = str(body.filename);
          const base64 = str(body.contentBase64);
          if (!filename || !base64) {
            return res.status(400).json({ error: "filename + contentBase64 required." });
          }
          if (base64.length > 14_000_000) {
            return res.status(400).json({ error: "File too large (max ~10MB)." });
          }
          let buffer: Buffer;
          try {
            buffer = Buffer.from(base64, "base64");
          } catch {
            return res.status(400).json({ error: "Invalid base64." });
          }
          const contract = await createContract({
            client_id: str(body.client_id) || null,
            property_id: str(body.property_id) || null,
            title: str(body.title) || filename,
            filename,
            mime: str(body.mime) || "application/pdf",
            buffer,
            signed_on: str(body.signed_on) || null,
            effective_from: str(body.effective_from) || null,
            effective_to: str(body.effective_to) || null,
            status:
              body.status === "draft" ||
              body.status === "expired" ||
              body.status === "awaiting_signature"
                ? body.status
                : "signed",
            note: str(body.note),
          });
          return res.status(200).json({ contract });
        }
        if (op === "delete") {
          const id = str(body.id);
          if (!id) return res.status(400).json({ error: "id required." });
          await deleteContract(id);
          return res.status(200).json({ ok: true });
        }
      }

      if (resource === "contract_templates") {
        if (op === "create") {
          const filename = str(body.filename);
          const base64 = str(body.contentBase64);
          if (!filename || !base64) {
            return res.status(400).json({ error: "filename + contentBase64 required." });
          }
          let buffer: Buffer;
          try {
            buffer = Buffer.from(base64, "base64");
          } catch {
            return res.status(400).json({ error: "Invalid base64." });
          }
          const template = await createContractTemplate({
            label: str(body.label) || filename,
            filename,
            mime: str(body.mime) || "application/pdf",
            buffer,
          });
          return res.status(200).json({ template });
        }
        if (op === "archive") {
          const id = str(body.id);
          if (!id) return res.status(400).json({ error: "id required." });
          await archiveContractTemplate(id);
          return res.status(200).json({ ok: true });
        }
        if (op === "delete") {
          const id = str(body.id);
          if (!id) return res.status(400).json({ error: "id required." });
          await deleteContractTemplate(id);
          return res.status(200).json({ ok: true });
        }
      }

      if (resource === "portal_invite") {
        if (op === "send") {
          const clientId = str(body.client_id);
          if (!clientId) return res.status(400).json({ error: "client_id required." });
          const client = await getPmClient(clientId);
          if (!client) return res.status(404).json({ error: "Client not found." });

          const email = str(body.email) || client.email;
          const name = str(body.name) || client.name;
          if (!email) return res.status(400).json({ error: "Email required." });

          if (str(body.email) && str(body.email) !== client.email) {
            await updatePmClient(clientId, { email: str(body.email) });
          }
          if (str(body.phone)) {
            await updatePmClient(clientId, { phone: str(body.phone) });
          }
          if (str(body.name) && str(body.name) !== client.name) {
            await updatePmClient(clientId, { name: str(body.name) });
          }

          const existingHost =
            body.existing_host === true || str(body.kind) === "existing";
          const replaceId = str(body.replace_contract_id);
          const existingPortal = await getPortalUserByClientId(clientId);
          const keepPortalLogin = Boolean(
            replaceId && existingPortal?.last_login_at && !existingHost,
          );

          let user = existingPortal;
          let tempPassword: string | undefined;
          if (!keepPortalLogin) {
            const invited = await createOrRefreshPortalInvite({
              pm_client_id: clientId,
              email,
              fullName: name,
              slug: str(body.slug) || undefined,
            });
            user = invited.user;
            tempPassword = invited.tempPassword;
          }
          if (!user) {
            return res.status(500).json({ error: "Could not load portal user." });
          }

          const props = await listPmProperties(clientId).catch(() => []);
          const propertyId = str(body.property_id) || props[0]?.id || null;
          const propertyLabel = props.find((p) => p.id === propertyId)
            ? `${props.find((p) => p.id === propertyId)!.name}`
            : props[0]?.name;

          if (existingHost) {
            await cancelAwaitingContracts(
              clientId,
              "Superseded — existing host access (no new signature)",
            );

            const signedName = str(body.signed_filename);
            const signedB64 = str(body.signed_contentBase64);
            if (signedName && signedB64) {
              await createContract({
                client_id: clientId,
                property_id: propertyId,
                title: str(body.signed_title) || "Management agreement",
                filename: signedName,
                mime: str(body.signed_mime) || "application/pdf",
                buffer: Buffer.from(signedB64, "base64"),
                signed_on: str(body.signed_on) || new Date().toISOString().slice(0, 10),
                status: "signed",
                note: "Uploaded signed copy for existing host",
              });
            }

            const mail = await sendOwnerInviteEmail({
              to: email,
              firstName: user.first_name || "there",
              propertyLabel,
              slug: user.slug,
              tempPassword,
              kind: "existing",
            });

            return res.status(200).json({
              ok: true,
              kind: "existing",
              portal_user: publicPortalUser(user),
              owner_url: ownerPortalUrl(user.slug),
              email_sent: mail.ok,
              email_error: mail.ok ? null : mail.message || "Email failed",
            });
          }

          const templateId = str(body.template_id);
          const oneOffName = str(body.filename);
          const oneOffB64 = str(body.contentBase64);
          let pdf: { buffer: Buffer; filename: string; mime: string; title: string; template_id: string | null };

          if (replaceId) {
            const prev = await getContract(replaceId);
            if (!prev) return res.status(404).json({ error: "Contract not found." });
            if (prev.client_id !== clientId) {
              return res.status(400).json({ error: "That agreement is not on this client." });
            }
            if (prev.status === "signed") {
              return res.status(400).json({
                error: "This agreement is already signed. Send a new one instead of editing it.",
              });
            }
            const src = await downloadContractSourceBuffer(replaceId);
            pdf = {
              buffer: src.buffer,
              filename: src.filename,
              mime: src.mime,
              title: src.title,
              template_id: src.template_id,
            };
          } else if (templateId) {
            const t = await downloadTemplateBuffer(templateId);
            pdf = {
              buffer: t.buffer,
              filename: t.filename,
              mime: t.mime,
              title: t.label,
              template_id: templateId,
            };
          } else if (oneOffName && oneOffB64) {
            pdf = {
              buffer: Buffer.from(oneOffB64, "base64"),
              filename: oneOffName,
              mime: str(body.mime) || "application/pdf",
              title: str(body.title) || oneOffName,
              template_id: null,
            };
          } else {
            return res.status(400).json({
              error: "Pick a contract template or upload a PDF for this deal.",
            });
          }

          const signFields = normalizeSignFields(body.sign_fields);
          if (!hasHostSignature(signFields)) {
            return res.status(400).json({
              error: "Place at least one Host signature box on the PDF before sending.",
            });
          }
          const ours = mrgFields(signFields).map((f) =>
            f.type === "date" && !f.value?.trim() ? { ...f, value: todayIsoDate() } : f,
          );
          const missingMrgSign = ours.some(
            (f) => f.type === "signature" && !f.signature_png,
          );
          if (missingMrgSign) {
            return res.status(400).json({
              error: "Sign the MRG signature boxes before sending.",
            });
          }

          if (body.save_as_template === true && !templateId && oneOffName && oneOffB64) {
            await createContractTemplate({
              label: str(body.template_label) || str(body.title) || oneOffName,
              filename: oneOffName,
              mime: str(body.mime) || "application/pdf",
              buffer: pdf.buffer,
            }).catch(() => undefined);
          }
          // Do not write this deal's boxes onto the shared template — every customer
          // starts from a blank PDF and gets their own field layout.

          let buffer = pdf.buffer;
          if (ours.length) {
            buffer = await stampSignedPdf({
              pdfBuffer: buffer,
              fields: ours,
              signerName: ours.find((f) => f.type === "name" && f.value)?.value || "Mandel Realty Group",
              signedOnLabel: todayIsoDate(),
            });
          }

          const contract = await assignAwaitingContract({
            client_id: clientId,
            property_id: propertyId,
            title: pdf.title,
            filename: pdf.filename,
            mime: pdf.mime,
            buffer,
            template_id: pdf.template_id,
            sign_fields: signFields,
            sourceBuffer: pdf.buffer,
          });

          const mail = await sendOwnerInviteEmail({
            to: email,
            firstName: user.first_name || "there",
            propertyLabel,
            slug: user.slug,
            tempPassword,
            kind: replaceId ? "revised" : "new",
          });

          return res.status(200).json({
            ok: true,
            portal_user: publicPortalUser(user),
            owner_url: ownerPortalUrl(user.slug),
            contracts_url: ownerPortalUrl(user.slug, "contracts"),
            contract,
            email_sent: mail.ok,
            email_error: mail.ok ? null : mail.message || "Email failed",
            temp_password_preview: process.env.NODE_ENV === "production" ? undefined : tempPassword,
          });
        }
      }

      if (resource === "settings") {
        if (op === "update") {
          let bps: number | undefined;
          if (typeof body.default_commission_bps === "number") {
            bps = body.default_commission_bps;
          } else if (
            typeof body.default_commission_percent === "number" ||
            typeof body.default_commission_percent === "string"
          ) {
            bps = percentToRateBps(Number(body.default_commission_percent));
          }
          let hstBps: number | undefined;
          if (typeof body.default_hst_bps === "number") {
            hstBps = body.default_hst_bps;
          } else if (
            typeof body.default_hst_percent === "number" ||
            typeof body.default_hst_percent === "string"
          ) {
            hstBps = percentToRateBps(Number(body.default_hst_percent));
          }
          const settings = await updatePmSettings({
            default_commission_bps: bps,
            default_hst_bps: hstBps,
          });
          return res.status(200).json({
            settings,
            hospitable_connected: await isHospitableConfigured(),
          });
        }
        if (op === "save_hospitable_pat") {
          const pat = str(body.hospitable_pat);
          if (!pat) return res.status(400).json({ error: "PAT is required." });
          await verifyHospitablePat(pat);
          const settings = await updatePmSettings({ hospitable_pat: pat });
          return res.status(200).json({
            settings,
            hospitable_connected: true,
          });
        }
        if (op === "clear_hospitable_pat") {
          const settings = await updatePmSettings({ hospitable_pat: "" });
          return res.status(200).json({
            settings,
            hospitable_connected: await isHospitableConfigured(),
          });
        }
      }

      if (resource === "tasks") {
        if (op === "create") {
          const assignees = asAssignees(body.assignees);
          const task = await createPmTask({
            title: str(body.title),
            detail: str(body.detail),
            status: asTaskStatus(body.status),
            priority: asTaskPriority(body.priority),
            assignees,
            assignee: assignees ? undefined : str(body.assignee),
            due_on: body.due_on == null || body.due_on === "" ? null : str(body.due_on),
            property_id:
              body.property_id == null || body.property_id === ""
                ? null
                : str(body.property_id),
            client_id:
              body.client_id == null || body.client_id === ""
                ? null
                : str(body.client_id),
            year_month: str(body.year_month),
            task_type: asTaskType(body.task_type),
            created_by: str(body.created_by),
            repeat_rule: asTaskRepeat(body.repeat_rule),
          });
          return res.status(200).json({ task });
        }
        if (op === "update") {
          const id = str(body.id);
          if (!id) return res.status(400).json({ error: "id required." });
          const patch: Parameters<typeof updatePmTask>[1] = {};
          if (body.title != null) patch.title = str(body.title);
          if (body.detail != null) patch.detail = str(body.detail);
          if (body.status != null) {
            const s = asTaskStatus(body.status);
            if (s) patch.status = s;
          }
          if (body.priority != null) {
            const p = asTaskPriority(body.priority);
            if (p) patch.priority = p;
          }
          if (body.assignees !== undefined) {
            patch.assignees = asAssignees(body.assignees) ?? [];
          } else if (body.assignee != null) {
            patch.assignee = str(body.assignee);
          }
          if (body.due_on !== undefined) {
            patch.due_on =
              body.due_on == null || body.due_on === "" ? null : str(body.due_on);
          }
          if (body.property_id !== undefined) {
            patch.property_id =
              body.property_id == null || body.property_id === ""
                ? null
                : str(body.property_id);
          }
          if (body.client_id !== undefined) {
            patch.client_id =
              body.client_id == null || body.client_id === ""
                ? null
                : str(body.client_id);
          }
          if (body.year_month != null) patch.year_month = str(body.year_month);
          if (body.task_type != null) {
            const t = asTaskType(body.task_type);
            if (t) patch.task_type = t;
          }
          if (body.repeat_rule != null) {
            const r = asTaskRepeat(body.repeat_rule);
            if (r) patch.repeat_rule = r;
          }
          const task = await updatePmTask(id, patch);
          return res.status(200).json({ task });
        }
        if (op === "delete") {
          const id = str(body.id);
          if (!id) return res.status(400).json({ error: "id required." });
          await deletePmTask(id);
          return res.status(200).json({ ok: true });
        }
      }

      if (resource === "team_members") {
        if (op === "create") {
          const member = await createPmTeamMember({ name: str(body.name) });
          return res.status(200).json({ member });
        }
        if (op === "delete") {
          const id = str(body.id);
          if (!id) return res.status(400).json({ error: "id required." });
          await deletePmTeamMember(id);
          return res.status(200).json({ ok: true });
        }
      }

      if (resource === "sops") {
        if (op === "upload_video") {
          const slug = str(body.slug);
          if (!slug) return res.status(400).json({ error: "slug required." });
          const videoB64 = str(body.video_base64);
          if (!videoB64) return res.status(400).json({ error: "video_base64 required." });
          const buffer = Buffer.from(videoB64, "base64");
          const mime = str(body.mime) || "video/webm";
          const videoUrl = await uploadSopVideo(slug, buffer, mime);
          return res.status(200).json({ ok: true, video_url: videoUrl });
        }
        if (op === "save") {
          const rawSop = (body.sop && typeof body.sop === "object") ? (body.sop as Record<string, unknown>) : body;
          const rawId = str(rawSop.id || body.id).trim();
          const sopId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId)
            ? rawId
            : undefined;
          const sop = await upsertSop({
            id: sopId,
            title: str(rawSop.title || body.title),
            slug: str(rawSop.slug || body.slug) || undefined,
            category: ((rawSop.category || body.category) as any) || "outreach",
            target_role: ((rawSop.target_role || body.target_role) as any) || "va",
            summary: str(rawSop.summary || body.summary) || "",
            estimated_minutes: Number(rawSop.estimated_minutes || body.estimated_minutes) || 15,
            steps: Array.isArray(rawSop.steps)
              ? (rawSop.steps as any)
              : Array.isArray(body.steps)
              ? (body.steps as any)
              : [],
            video_url: str(rawSop.video_url || body.video_url) || undefined,
            author: str(rawSop.author || body.author) || "MRG Admin",
            is_published:
              typeof rawSop.is_published === "boolean"
                ? rawSop.is_published
                : body.is_published !== false,
          });
          return res.status(200).json({ sop });
        }
        if (op === "delete") {
          const id = str(body.id) || str(body.slug);
          if (!id) return res.status(400).json({ error: "id required." });
          await deleteSop(id);
          return res.status(200).json({ ok: true });
        }
      }

      if (resource === "company_subscriptions") {
        if (op === "upsert") {
          const amountCents =
            typeof body.amount_cents === "number"
              ? Math.round(body.amount_cents)
              : moneyToCents(body.amount);
          if (!Number.isFinite(amountCents)) {
            return res.status(400).json({ error: "amount required." });
          }
          const subscription = await upsertCompanySubscription({
            id: str(body.id) || undefined,
            name: str(body.name),
            category: str(body.category),
            amount_cents: amountCents,
            cadence: str(body.cadence),
            active: typeof body.active === "boolean" ? body.active : undefined,
            start_year_month: str(body.start_year_month),
          });
          return res.status(200).json({ subscription });
        }
        if (op === "delete") {
          const id = str(body.id);
          if (!id) return res.status(400).json({ error: "id required." });
          await deleteCompanySubscription(id);
          return res.status(200).json({ ok: true });
        }
      }

      if (resource === "company_expenses") {
        if (op === "create") {
          const amountCents =
            typeof body.amount_cents === "number"
              ? Math.round(body.amount_cents)
              : moneyToCents(body.amount);
          if (!Number.isFinite(amountCents)) {
            return res.status(400).json({ error: "amount required." });
          }
          const expense = await createCompanyExpense({
            year_month: str(body.year_month || body.month),
            expense_date: str(body.expense_date) || undefined,
            category: str(body.category),
            label: str(body.label),
            amount_cents: amountCents,
            note: str(body.note),
            override_subscription_id: str(body.override_subscription_id) || null,
          });
          return res.status(200).json({ expense });
        }
        if (op === "delete") {
          const id = str(body.id);
          if (!id) return res.status(400).json({ error: "id required." });
          await deleteCompanyExpense(id);
          return res.status(200).json({ ok: true });
        }
      }

      return res.status(400).json({ error: "Unknown op." });
    }

    return res.status(405).json({ error: "Method not allowed." });
  } catch (err) {
    return res.status(400).json({ error: apiErrorMessage(err) });
  }
}
