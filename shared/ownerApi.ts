import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  clearOwnerSessionCookie,
  cookieShouldBeSecure,
  createOwnerSessionToken,
  getOwnerSessionFromRequest,
  ownerSessionCookie,
  verifyOwnerPreviewToken,
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
import { buildOwnerDashboard } from "./pm/ownerDashboard.js";
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
import { normalizeSignFields } from "./pm/signFields.js";

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

function previewFromReq(req: VercelRequest, body: Record<string, unknown> = {}): string {
  const q = str(req.query.preview);
  if (q) return q;
  return str(body.preview);
}

async function requireOwner(
  req: VercelRequest,
  res: VercelResponse,
  opts?: { allowPreview?: boolean; body?: Record<string, unknown> },
) {
  const preview = verifyOwnerPreviewToken(previewFromReq(req, opts?.body));
  if (preview && opts?.allowPreview) {
    const user = await getPortalUserBySlug(preview.slug);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return null;
    }
    return user;
  }
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
  const dashboard = await buildOwnerDashboard(user.pm_client_id).catch(() => null);
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
    dashboard,
  };
}

/** Public login chrome only — no PII, contracts, or financials. */
async function ownerBootstrapPublic(slug: string) {
  const user = await getPortalUserBySlug(slug);
  if (!user) return null;
  const props = await listPmProperties(user.pm_client_id).catch(() => []);
  const primary = props[0] ?? null;
  const awaiting = await getAwaitingContractForClient(user.pm_client_id);
  return {
    user: {
      slug: user.slug,
      first_name: user.first_name,
    },
    client: null,
    property: primary
      ? {
          id: "",
          name: primary.name,
          address: "",
          cover_image_url: primary.cover_image_url ?? null,
        }
      : null,
    awaiting_contract: awaiting
      ? { id: "", title: awaiting.title, filename: "", status: awaiting.status }
      : null,
    signed_contracts: [] as Array<{
      id: string;
      title: string;
      filename: string;
      signed_on: string | null;
      signed_at: string | null;
      signature_name: string;
    }>,
    dashboard: null,
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

        const token = getOwnerSessionFromRequest(req.headers.cookie);
        const session = verifyOwnerSessionToken(token);
        const preview = verifyOwnerPreviewToken(str(req.query.preview));
        const previewOk = Boolean(preview && preview.slug === slug.trim().toLowerCase());

        let authedUserId: string | null = null;
        if (previewOk) {
          const previewUser = await getPortalUserBySlug(slug);
          if (previewUser) authedUserId = previewUser.id;
        } else if (session) {
          const sessionUser = await getPortalUserById(session.userId);
          if (sessionUser && sessionUser.slug === slug.trim().toLowerCase()) {
            authedUserId = sessionUser.id;
          }
        }

        if (authedUserId) {
          const payload = await ownerBootstrap(slug);
          if (!payload) return res.status(404).json({ error: "Owner portal not found." });
          return res.status(200).json({
            ...payload,
            session: {
              authenticated: true,
              preview: previewOk,
              must_change_password: previewOk
                ? false
                : payload.user.must_change_password,
            },
          });
        }

        const pub = await ownerBootstrapPublic(slug);
        if (!pub) return res.status(404).json({ error: "Owner portal not found." });
        return res.status(200).json({
          ...pub,
          session: { authenticated: false, preview: false, must_change_password: false },
        });
      }

      if (op === "me") {
        const user = await requireOwner(req, res, { allowPreview: true });
        if (!user) return;
        return res.status(200).json({ user: publicPortalUser(user) });
      }

      if (op === "contract_url") {
        const user = await requireOwner(req, res, { allowPreview: true });
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

      if (op === "ask_history") {
        const user = await requireOwner(req, res, { allowPreview: true });
        if (!user) return;
        const { listAskMessages, isAskTableMissing } = await import("./pm/askMrgStore.js");
        try {
          const messages = await listAskMessages(user.id);
          return res.status(200).json({
            messages: messages.map((m) => ({
              id: m.id,
              role: m.role,
              body: m.body,
              created_at: m.created_at,
            })),
            persist: true,
          });
        } catch (e) {
          if (isAskTableMissing(e)) {
            return res.status(200).json({ messages: [], persist: false });
          }
          throw e;
        }
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
      if (verifyOwnerPreviewToken(previewFromReq(req, body))) {
        return res.status(403).json({ error: "Preview only — password is off." });
      }
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
      if (verifyOwnerPreviewToken(previewFromReq(req, body))) {
        return res.status(403).json({ error: "Preview only — signing is off." });
      }
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
        fields: Array.isArray(body.fields) ? normalizeSignFields(body.fields) : undefined,
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

      try {
        const { createOnboardingTasks } = await import("./pm/onboardingTasks.js");
        await createOnboardingTasks({
          clientId: user.pm_client_id,
          clientName: client?.name || user.first_name || "host",
          propertyId: props[0]?.id ?? null,
        });
      } catch {
        // Signing succeeded even if OPS tasks fail
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

    if (op === "ask") {
      if (verifyOwnerPreviewToken(previewFromReq(req, body))) {
        return res.status(403).json({ error: "Preview only — Ask MRG sending is off." });
      }
      const user = await requireOwner(req, res);
      if (!user) return;
      if (user.must_change_password) {
        return res.status(400).json({ error: "Set your password first." });
      }
      const message = str(body.message);
      if (!message) return res.status(400).json({ error: "message required." });
      const { answerAskMrg } = await import("./pm/askMrg.js");
      const result = await answerAskMrg({ user, message });
      return res.status(200).json(result);
    }

    return res.status(404).json({ error: "Unknown op." });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Owner API error.";
    if (/portal_ask_messages/i.test(msg)) {
      return res.status(503).json({
        error: `${msg} Run supabase/portal_ask_mrg_v1.sql in Supabase.`,
      });
    }
    if (/portal_users|pm_contract|schema|column|relation/i.test(msg)) {
      return res.status(503).json({
        error: `${msg} Run supabase/portal_owner_v1.sql in Supabase.`,
      });
    }
    return res.status(500).json({ error: msg });
  }
}
