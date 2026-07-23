import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import type { IncomingMessage } from "node:http";
import { loadEnv } from "vite";
import { defineConfig, type Plugin } from "vite";
import {
  AUDIT_UNAVAILABLE_MESSAGE,
  LEAD_INBOX,
  buildCustomerConfirmationHtml,
  buildCustomerSubject,
  buildLeadNotificationHtml,
  buildLeadSubject,
  sendResendEmail,
  toPublicAuditError,
} from "./shared/auditEmails.js";
import { parseLeadRequestBody } from "./shared/parseLeadRequest.js";

function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve((raw ? JSON.parse(raw) : {}) as Record<string, unknown>);
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function auditDevApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: "audit-dev-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== "/api/audit" || req.method !== "POST") {
          next();
          return;
        }

        const apiKey = env.RESEND_API_KEY;
        const json = (status: number, body: object) => {
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(body));
        };

        if (!apiKey) {
          json(503, { error: AUDIT_UNAVAILABLE_MESSAGE });
          return;
        }

        try {
          const body = await readJsonBody(req);
          const { lead, contactConsent, isHoneypot, missingRequired } =
            parseLeadRequestBody(body);

          if (isHoneypot) {
            json(200, { ok: true });
            return;
          }

          if (missingRequired) {
            json(400, { error: "Please fill in all required fields." });
            return;
          }

          if (!contactConsent) {
            json(400, {
              error: "Please confirm we can contact you about your custom earnings estimate.",
            });
            return;
          }

          const from =
            env.RESEND_FROM?.trim() || "Mandel Realty Group <onboarding@resend.dev>";

          const leadResult = await sendResendEmail({
            apiKey,
            from,
            to: [LEAD_INBOX],
            replyTo: lead.email,
            subject: buildLeadSubject(lead),
            html: buildLeadNotificationHtml(lead),
          });

          if (!leadResult.ok) {
            console.error("[audit-dev] lead email failed", leadResult.message);
            json(500, { error: toPublicAuditError(leadResult.message) });
            return;
          }

          const customerResult = await sendResendEmail({
            apiKey,
            from,
            to: [lead.email],
            replyTo: LEAD_INBOX,
            subject: buildCustomerSubject(),
            html: buildCustomerConfirmationHtml(lead),
          });

          if (!customerResult.ok) {
            console.error("[audit-dev] customer confirmation failed", customerResult.message);
          }

          json(200, { ok: true });
        } catch (err) {
          console.error("[audit-dev] unexpected error", err);
          json(500, { error: AUDIT_UNAVAILABLE_MESSAGE });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), tailwindcss(), auditDevApiPlugin(env)],
  };
});
