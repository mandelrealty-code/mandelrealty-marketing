/**
 * Public magic-link signing API (token = auth). No admin session required.
 * Mounted at /api/sign → /api/admin?section=sign
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { completeMagicSign, loadMagicSignPayload } from "../pm/crmLeadContract.js";

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function tokenOf(req: VercelRequest, body: Record<string, unknown>): string {
  return str(req.query.token) || str(body.token);
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

export default async function handleSign(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  const method = (req.method || "GET").toUpperCase();

  if (method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  try {
    if (method === "GET") {
      const token = tokenOf(req, {});
      if (!token) return res.status(400).json({ error: "invalid_token" });
      const payload = await loadMagicSignPayload(token);
      if (!payload.ok) return res.status(400).json({ error: payload.error });
      return res.status(200).json({
        contract: payload.contract,
        clientName: payload.clientName,
        planName: payload.planName,
        propertyLabel: payload.propertyLabel,
        pdf_url: payload.pdf_url,
      });
    }

    if (method === "POST") {
      const body = readBody(req);
      const token = tokenOf(req, body);
      if (!token) return res.status(400).json({ error: "invalid_token" });
      const result = await completeMagicSign({
        token,
        signature_data_url: str(body.signature_data_url),
        signed_name: str(body.signed_name),
      });
      if (!result.ok) {
        const code =
          result.error === "invalid_token" ||
          result.error === "already_signed" ||
          result.error === "expired"
            ? 400
            : 400;
        return res.status(code).json({ error: result.error });
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed." });
  } catch (e) {
    console.error("[sign]", e);
    return res.status(500).json({
      error: e instanceof Error ? e.message : "Signing failed.",
    });
  }
}
