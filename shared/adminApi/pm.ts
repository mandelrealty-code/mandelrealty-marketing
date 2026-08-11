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
  previousYearMonth,
  syncHospitableReservations,
} from "../pm/reservationStore.js";
import {
  buildMonthStatement,
  createManualExpense,
  deleteManualExpense,
} from "../pm/statementMath.js";
import {
  changePmCommission,
  createPmProperty,
  getPmPropertyDetail,
  importHospitableProperty,
  listLinkedHospitableIds,
  listPmProperties,
  updatePmProperty,
} from "../pm/propertyStore.js";
import { percentToRateBps } from "../pm/types.js";
import { isSupabaseConfigured } from "../supabase.js";

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
    if (/pm_reservations|pm_manual_expenses|pm_contracts/i.test(m) && /does not exist|schema cache/i.test(m)) {
      return "Earnings tables missing. Run supabase/pm_earnings_contracts_v1.sql in Supabase, then retry.";
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
      if (resource === "earnings") {
        const propertyId =
          typeof req.query.property_id === "string" ? req.query.property_id.trim() : "";
        const yearMonth =
          typeof req.query.month === "string" && /^\d{4}-\d{2}$/.test(req.query.month)
            ? req.query.month
            : previousYearMonth();
        if (!propertyId) return res.status(400).json({ error: "property_id required." });
        const statement = await buildMonthStatement(propertyId, yearMonth);
        return res.status(200).json({ statement });
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
          const property = await createPmProperty({
            client_id: str(body.client_id),
            name: str(body.name),
            address: str(body.address),
            hospitable_property_id: str(body.hospitable_property_id),
          });
          return res.status(200).json({ property });
        }
        if (op === "import_hospitable") {
          const property = await importHospitableProperty({
            client_id: str(body.client_id),
            hospitable_property_id: str(body.hospitable_property_id),
            name: str(body.name),
            address: str(body.address),
          });
          return res.status(200).json({ property });
        }
        if (op === "update") {
          const id = str(body.id);
          if (!id) return res.status(400).json({ error: "id required." });
          const property = await updatePmProperty(id, {
            name: body.name != null ? str(body.name) : undefined,
            address: body.address != null ? str(body.address) : undefined,
            client_id: body.client_id != null ? str(body.client_id) : undefined,
            hospitable_property_id:
              body.hospitable_property_id != null
                ? str(body.hospitable_property_id)
                : undefined,
            active: typeof body.active === "boolean" ? body.active : undefined,
          });
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
      }

      if (resource === "earnings") {
        if (op === "sync") {
          const yearMonth =
            str(body.month) && /^\d{4}-\d{2}$/.test(str(body.month))
              ? str(body.month)
              : previousYearMonth();
          const propertyId = str(body.property_id) || undefined;
          const result = await syncHospitableReservations({
            yearMonth,
            propertyId,
          });
          const statement = propertyId
            ? await buildMonthStatement(propertyId, yearMonth)
            : null;
          return res.status(200).json({ ...result, statement, month: yearMonth });
        }
        if (op === "add_expense") {
          const amountCents =
            typeof body.amount_cents === "number"
              ? Math.round(body.amount_cents)
              : moneyToCents(body.amount);
          if (!Number.isFinite(amountCents)) {
            return res.status(400).json({ error: "amount required." });
          }
          const expense = await createManualExpense({
            property_id: str(body.property_id),
            expense_date: str(body.expense_date),
            category: str(body.category) || "other",
            label: str(body.label),
            amount_cents: amountCents,
            note: str(body.note),
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
          const settings = await updatePmSettings({
            default_commission_bps: bps,
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

      return res.status(400).json({ error: "Unknown op." });
    }

    return res.status(405).json({ error: "Method not allowed." });
  } catch (err) {
    return res.status(400).json({ error: apiErrorMessage(err) });
  }
}
