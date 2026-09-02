import type { VercelRequest, VercelResponse } from "@vercel/node";
import handleKnowledge from "../shared/adminApi/knowledge.js";
import handleLeads from "../shared/adminApi/leads.js";
import handlePm from "../shared/adminApi/pm.js";
import handleSession from "../shared/adminApi/session.js";
import handleSettings from "../shared/adminApi/settings.js";
import { rejectIfNotAdminHost } from "../shared/adminHost.js";

/**
 * Single admin serverless function (Hobby plan ≤12 functions).
 * Paths are rewritten in vercel.json:
 *   /api/admin/leads|settings|knowledge|session|pm → /api/admin?section=…
 * Bound to admin hostname only — never on marketing www (VA / public).
 */

function sectionOf(req: VercelRequest): string {
  const q = req.query.section;
  if (typeof q === "string" && q.trim()) return q.trim().toLowerCase();

  const url = String(req.url || "");
  if (url.includes("knowledge")) return "knowledge";
  if (url.includes("settings")) return "settings";
  if (url.includes("session") || url.includes("login") || url.includes("logout")) {
    return "session";
  }
  if (url.includes("/pm") || url.includes("section=pm")) return "pm";
  if (url.includes("leads")) return "leads";

  // Clients app hits /api/admin/pm?resource=… — after rewrite section=pm is preferred
  const resource = req.query.resource;
  if (typeof resource === "string" && resource.trim()) return "pm";

  return "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (rejectIfNotAdminHost(req, res)) return;

  const section = sectionOf(req);
  switch (section) {
    case "session":
      return handleSession(req, res);
    case "leads":
      return handleLeads(req, res);
    case "settings":
      return handleSettings(req, res);
    case "knowledge":
      return handleKnowledge(req, res);
    case "pm":
      return handlePm(req, res);
    default:
      return res.status(404).json({ error: "Unknown admin section." });
  }
}
