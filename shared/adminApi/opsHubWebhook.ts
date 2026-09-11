import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  ensureSupplyReorderTask,
  ensureTurnoverQaTask,
} from "../pm/opsWorkflows.js";
import { resolveByHospitablePropertyId } from "../pm/propertyIdentity.js";
import { isSupabaseConfigured } from "../supabase.js";

/**
 * Cleaner Hub → Admin OPS events.
 * Served via /api/admin?section=ops_hub (Hobby: no extra serverless function).
 * Public path kept by vercel rewrite: POST /api/webhooks/ops-hub
 *
 * Auth: Bearer <CLEANER_HUB_SYNC_KEY or OPS_HUB_WEBHOOK_SECRET> or x-api-key
 */
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

function authorized(req: VercelRequest): boolean {
  const secret =
    process.env.OPS_HUB_WEBHOOK_SECRET?.trim() ||
    process.env.CLEANER_HUB_SYNC_KEY?.trim() ||
    "";
  if (!secret) return false;
  const header = String(req.headers.authorization ?? "");
  if (header === `Bearer ${secret}`) return true;
  const key = String(req.headers["x-api-key"] ?? "").trim();
  if (key === secret) return true;
  const q = typeof req.query.secret === "string" ? req.query.secret : "";
  return q === secret;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

export default async function handleOpsHubWebhook(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!authorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: "Supabase is not configured." });
  }

  const body = readBody(req);
  const event = str(body.event);
  const hospitablePropertyId = str(
    body.hospitable_property_id || body.hospitablePropertyId,
  );
  if (!event) {
    return res.status(400).json({ error: "event required." });
  }
  if (!hospitablePropertyId) {
    return res.status(400).json({ error: "hospitable_property_id required." });
  }

  const identity = await resolveByHospitablePropertyId(hospitablePropertyId);
  if (!identity) {
    return res.status(404).json({
      error:
        "No Admin property linked to that Hospitable UUID. Import/link in Admin OPS first.",
      hospitable_property_id: hospitablePropertyId,
    });
  }

  const cleaningTaskId = str(body.cleaning_task_id || body.cleaningTaskId);
  const detail = str(body.detail);

  if (event === "inventory_low_stock" || event === "supply_reorder") {
    const itemsRaw = Array.isArray(body.items) ? body.items : [];
    const singleName = str(body.item_name || body.itemName);
    const lines: Array<{ item_name: string; detail: string }> = [];
    if (itemsRaw.length) {
      for (const row of itemsRaw) {
        if (!row || typeof row !== "object") continue;
        const r = row as Record<string, unknown>;
        const name = str(r.item_name || r.itemName || r.name);
        if (!name) continue;
        lines.push({
          item_name: name,
          detail: str(r.detail) || detail,
        });
      }
    } else if (singleName) {
      lines.push({ item_name: singleName, detail });
    }
    if (!lines.length) {
      return res.status(400).json({ error: "items or item_name required." });
    }

    const tasks = [];
    for (const line of lines) {
      const task = await ensureSupplyReorderTask({
        propertyId: identity.adminPropertyId,
        itemName: line.item_name,
        detail:
          line.detail ||
          `Low stock reported from Cleaner Hub${cleaningTaskId ? ` (task ${cleaningTaskId.slice(0, 8)})` : ""}.`,
      });
      tasks.push({ id: task.id, title: task.title });
    }
    return res.status(200).json({
      ok: true,
      event,
      admin_property_id: identity.adminPropertyId,
      tasks,
    });
  }

  if (event === "cleaning_complete" || event === "turnover_complete") {
    const task = await ensureTurnoverQaTask({
      propertyId: identity.adminPropertyId,
      cleaningTaskId: cleaningTaskId || undefined,
      detail:
        detail ||
        `Cleaning completed in Cleaner Hub for ${identity.name}. Review photos and inventory.`,
    });
    return res.status(200).json({
      ok: true,
      event,
      admin_property_id: identity.adminPropertyId,
      task: { id: task.id, title: task.title },
    });
  }

  return res.status(400).json({
    error: `Unknown event: ${event}. Use inventory_low_stock or cleaning_complete.`,
  });
}
