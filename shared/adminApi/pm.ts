import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getSessionFromRequest,
  isAdminConfigured,
  verifyAdminSessionToken,
} from "../adminAuth.js";
import {
  createContract,
  deleteContract,
  getContractDownloadUrl,
  listContracts,
} from "../pm/contractStore.js";
import {
  createPmClient,
  getHospitablePat,
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
    if (/pm_reservations|pm_manual_expenses|pm_contracts|pm_tasks|cleaning_fee_keeper|hst_bps|default_hst_bps|commission_base_mode|hst_mode/i.test(m) && /does not exist|schema cache|column/i.test(m)) {
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
        return res.status(200).json({ portfolio });
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
        const url = await getContractDownloadUrl(id);
        return res.status(200).json({ url });
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
              body.status === "draft" || body.status === "expired"
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
          const task = await createPmTask({
            title: str(body.title),
            detail: str(body.detail),
            status: asTaskStatus(body.status),
            priority: asTaskPriority(body.priority),
            assignee: str(body.assignee),
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
          if (body.assignee != null) patch.assignee = str(body.assignee);
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

      return res.status(400).json({ error: "Unknown op." });
    }

    return res.status(405).json({ error: "Method not allowed." });
  } catch (err) {
    return res.status(400).json({ error: apiErrorMessage(err) });
  }
}
