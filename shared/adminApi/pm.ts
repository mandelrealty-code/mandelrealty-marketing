import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getSessionFromRequest,
  isAdminConfigured,
  verifyAdminSessionToken,
} from "../adminAuth.js";
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

async function settingsPayload(extra: Record<string, unknown> = {}) {
  const settings = await getPmSettings();
  return {
    settings,
    hospitable_connected: await isHospitableConfigured(),
    ...extra,
  };
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
              return res
                .status(400)
                .json({ error: "That Hospitable unit is already linked to another property." });
            }
          }
          const property = await updatePmProperty(id, {
            hospitable_property_id: hid,
          });
          return res.status(200).json({ property });
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
          // Env fallback may still count as connected
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
    const message = err instanceof Error ? err.message : "Request failed.";
    return res.status(400).json({ error: message });
  }
}
