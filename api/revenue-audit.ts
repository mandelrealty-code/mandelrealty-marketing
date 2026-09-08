import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  estimateByAddress,
  lookupListingAudit,
  unlockCodeValid,
} from "../shared/airroi.js";

function readBody(req: VercelRequest): Record<string, unknown> {
  if (req.body && typeof req.body === "object") return req.body as Record<string, unknown>;
  return {};
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = readBody(req);
  const op = String(body.op ?? "lookup").trim().toLowerCase();

  try {
    if (op === "unlock") {
      const code = String(body.code ?? "");
      if (!unlockCodeValid(code)) {
        return res.status(400).json({ error: "That code did not match." });
      }
      return res.status(200).json({ ok: true, unlocked: true });
    }

    if (!process.env.AIRROI_API_KEY?.trim()) {
      return res.status(503).json({
        error: "Live market data is temporarily unavailable. Enter your monthly revenue to continue, or try again later.",
      });
    }

    if (op === "estimate") {
      const result = await estimateByAddress({
        address: String(body.address ?? ""),
        bedrooms: Number(body.bedrooms ?? 2),
        bathrooms: Number(body.bathrooms ?? 1),
        guests: body.guests != null ? Number(body.guests) : undefined,
      });
      return res.status(200).json({ ok: true, ...result });
    }

    // default: lookup live listing
    const listing = String(body.listingUrl ?? body.url ?? body.listingId ?? "");
    const result = await lookupListingAudit(listing);
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load market data.";
    const status =
      err && typeof err === "object" && "status" in err && typeof (err as { status: unknown }).status === "number"
        ? (err as { status: number }).status
        : 500;
    console.error("[revenue-audit]", message);
    return res.status(status >= 400 && status < 600 ? status : 500).json({
      error: message,
    });
  }
}
