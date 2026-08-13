import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  clearOwnerSessionCookie,
  cookieShouldBeSecure,
  createOwnerSessionToken,
  getOwnerSessionFromRequest,
  ownerSessionCookie,
  verifyOwnerSessionToken,
  verifyPassword,
} from "./portalAuth.js";
import {
  getAwaitingContractForClient,
  getContractDownloadUrl,
  listSignedContractsForClient,
  markContractSigned,
  downloadContractBuffer,
} from "./pm/contractStore.js";
import { listPmProperties } from "./pm/propertyStore.js";
import { buildMonthPortfolio } from "./pm/statementMath.js";
import { getPmClient } from "./pm/clientStore.js";
import {
  getPortalUserById,
  getPortalUserBySlug,
  publicPortalUser,
  setPortalPassword,
  touchPortalLogin,
} from "./pm/portalUserStore.js";
import { sendSignedAgreementEmail } from "./ownerEmails.js";
import { isSupabaseConfigured } from "./supabase.js";

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

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function opOf(req: VercelRequest, body: Record<string, unknown>): string {
  if (typeof body.op === "string" && body.op.trim()) return body.op.trim();
  if (typeof req.query.op === "string" && req.query.op.trim()) return req.query.op.trim();
  return "";
}

async function requireOwner(req: VercelRequest, res: VercelResponse) {
  const token = getOwnerSessionFromRequest(req.headers.cookie);
  const session = verifyOwnerSessionToken(token);
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  const user = await getPortalUserById(session.userId);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return user;
}

async function ownerBootstrap(slug: string) {
  const user = await getPortalUserBySlug(slug);
  if (!user) return null;
  const client = await getPmClient(user.pm_client_id);
  const props = await listPmProperties(user.pm_client_id).catch(() => []);
  const primary = props[0] ?? null;
  const awaiting = await getAwaitingContractForClient(user.pm_client_id);
  const signed = await listSignedContractsForClient(user.pm_client_id);
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  let earnings: {
    year_month: string;
    net_to_host_cents: number;
    reservation_count: number;
    linked: boolean;
  } | null = null;
  try {
    const portfolio = await buildMonthPortfolio(yearMonth, {
      clientId: user.pm_client_id,
    });
    if (portfolio.linked_count > 0) {
      earnings = {
        year_month: portfolio.year_month,
        net_to_host_cents: portfolio.net_to_host_cents,
        reservation_count: portfolio.reservation_count,
        linked: true,
      };
    }
  } catch {
    earnings = null;
  }
  return {
    user: publicPortalUser(user),
    client: client
      ? { id: client.id, name: client.name, email: client.email, phone: client.phone }
      : null,
    property: primary
      ? {
          id: primary.id,
          name: primary.name,
          address: primary.address,
          cover_image_url: primary.cover_image_url ?? null,
        }
      : null,
    awaiting_contract: awaiting
      ? {
          id: awaiting.id,
          title: awaiting.title,
          filename: awaiting.filename,
          status: awaiting.status,
          sign_fields: awaiting.sign_fields ?? [],
        }
      : null,
    signed_contracts: signed.map((c) => ({
      id: c.id,
      title: c.title,
      filename: c.filename,
      signed_on: c.signed_on,
      signed_at: c.signed_at,
      signature_name: c.signature_name || "",
    })),
    earnings,
  };
}

export default async function handleOwner(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: "Supabase is not configured." });
  }

  const body = readBody(req);
  const op = opOf(req, body);
  const secure = cookieShouldBeSecure(req);

  try {
    if (req.method === "GET") {
      if (op === "bootstrap" || !op) {
        const slug =
          str(req.query.slug) ||
          (typeof req.query.slug === "string" ? req.query.slug : "");
        if (!slug) return res.status(400).json({ error: "slug required." });
        const payload = await ownerBootstrap(slug);
        if (!payload) return res.status(404).json({ error: "Owner portal not found." });

        const token = getOwnerSessionFromRequest(req.headers.cookie);
        const session = verifyOwnerSessionToken(token);
        const authed =
          session && session.userId === payload.user.id
            ? payload.user
            : null;

        return res.status(200).json({
          ...payload,
          session: authed
            ? {
                authenticated: true,
                must_change_password: payload.user.must_change_password,
              }
            : { authenticated: false, must_change_password: false },
        });
      }

      if (op === "me") {
        const user = await requireOwner(req, res);
        if (!user) return;
        return res.status(200).json({ user: publicPortalUser(user) });
      }

      if (op === "contract_url") {
        const user = await requireOwner(req, res);
        if (!user) return;
        const id = str(req.query.id);
        if (!id) return res.status(400).json({ error: "id required." });
        const awaiting = await getAwaitingContractForClient(user.pm_client_id);
        const signed = await listSignedContractsForClient(user.pm_client_id);
        const allowed =
          awaiting?.id === id || signed.some((c) => c.id === id);
        if (!allowed) return res.status(403).json({ error: "Not allowed." });
        const url = await getContractDownloadUrl(id);
        return res.status(200).json({ url });
      }

      return res.status(404).json({ error: "Unknown op." });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed." });
    }

    if (op === "login") {
      const slug = str(body.slug);
      const email = str(body.email).toLowerCase();
      const password = typeof body.password === "string" ? body.password : "";
      if (!slug || !email || !password) {
        return res.status(400).json({ error: "slug, email, and password required." });
      }
      const user = await getPortalUserBySlug(slug);
      if (!user || user.email.toLowerCase() !== email) {
        return res.status(401).json({ error: "Invalid email or password." });
      }
      if (!verifyPassword(password, user.password_hash)) {
        return res.status(401).json({ error: "Invalid email or password." });
      }
      await touchPortalLogin(user.id);
      const token = createOwnerSessionToken(user.id);
      res.setHeader("Set-Cookie", ownerSessionCookie(token, { secure }));
      const payload = await ownerBootstrap(slug);
      return res.status(200).json({
        ok: true,
        user: publicPortalUser(user),
        must_change_password: user.must_change_password,
        bootstrap: payload,
      });
    }

    if (op === "logout") {
      res.setHeader("Set-Cookie", clearOwnerSessionCookie({ secure }));
      return res.status(200).json({ ok: true });
    }

    if (op === "set_password") {
      const user = await requireOwner(req, res);
      if (!user) return;
      const password = typeof body.password === "string" ? body.password : "";
      const confirm = typeof body.confirm === "string" ? body.confirm : password;
      if (password !== confirm) {
        return res.status(400).json({ error: "Passwords do not match." });
      }
      const updated = await setPortalPassword(user.id, password);
      return res.status(200).json({ ok: true, user: publicPortalUser(updated) });
    }

    if (op === "sign") {
      const user = await requireOwner(req, res);
      if (!user) return;
      if (user.must_change_password) {
        return res.status(400).json({ error: "Set your password before signing." });
      }
      const contractId = str(body.contract_id);
      const signatureName = str(body.signature_name);
      const signatureImage =
        typeof body.signature_image_base64 === "string"
          ? body.signature_image_base64
          : "";
      if (!contractId || !signatureName) {
        return res.status(400).json({ error: "contract_id and signature_name required." });
      }
      const awaiting = await getAwaitingContractForClient(user.pm_client_id);
      if (!awaiting || awaiting.id !== contractId) {
        return res.status(400).json({ error: "No agreement waiting for signature." });
      }

      const signed = await markContractSigned({
        id: contractId,
        signature_name: signatureName,
        signature_image_base64: signatureImage || null,
      });

      const client = await getPmClient(user.pm_client_id);
      const props = await listPmProperties(user.pm_client_id).catch(() => []);
      const propertyLabel = props[0]
        ? `${props[0].name}${props[0].address ? ` · ${props[0].address}` : ""}`
        : undefined;

      try {
        const file = await downloadContractBuffer(signed.id);
        await sendSignedAgreementEmail({
          to: user.email,
          firstName: user.first_name || "there",
          propertyLabel,
          slug: user.slug,
          filename: file.filename,
          pdfBase64: file.buffer.toString("base64"),
          signedOnLabel: signed.signed_on || new Date().toISOString().slice(0, 10),
        });
      } catch {
        // Signing succeeded even if email fails
      }

      // Mark client active if paused
      if (client && client.status !== "active") {
        const { updatePmClient } = await import("./pm/clientStore.js");
        await updatePmClient(client.id, { status: "active" }).catch(() => undefined);
      }

      // If linked lead, mark won + pause AI
      if (client?.lead_id) {
        try {
          const { updateLeadCrm } = await import("./leadStore.js");
          const { cancelLeadFollowups } = await import("./followUpStore.js");
          await updateLeadCrm(client.lead_id, {
            status: "won",
            aiPaused: true,
            whatsNext: "Owner signed portal agreement",
          });
          await cancelLeadFollowups(client.lead_id).catch(() => undefined);
        } catch {
          // non-fatal
        }
      }

      const payload = await ownerBootstrap(user.slug);
      return res.status(200).json({ ok: true, contract: signed, bootstrap: payload });
    }

    return res.status(404).json({ error: "Unknown op." });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Owner API error.";
    if (/portal_users|pm_contract|schema|column|relation/i.test(msg)) {
      return res.status(503).json({
        error: `${msg} Run supabase/portal_owner_v1.sql in Supabase.`,
      });
    }
    return res.status(500).json({ error: msg });
  }
}
