import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import type { IncomingMessage } from "node:http";
import { loadEnv } from "vite";
import { defineConfig, type Plugin } from "vite";

function readJsonBody(req: IncomingMessage): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve((raw ? JSON.parse(raw) : {}) as Record<string, string>);
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
          json(503, {
            error:
              "Email service is not configured yet. Add RESEND_API_KEY to .env.local and restart the dev server.",
          });
          return;
        }

        try {
          const body = await readJsonBody(req);
          const { name, email, phone, address, earnings, _gotcha } = body;

          if (_gotcha) {
            json(200, { ok: true });
            return;
          }

          if (!name?.trim() || !email?.trim() || !phone?.trim() || !address?.trim()) {
            json(400, { error: "Please fill in all required fields." });
            return;
          }

          const from =
            env.RESEND_FROM?.trim() || "Mandel Realty Group <onboarding@resend.dev>";
          const html = `
            <h2>New Revenue Audit Request</h2>
            <p><strong>Name:</strong> ${escapeHtml(name.trim())}</p>
            <p><strong>Email:</strong> ${escapeHtml(email.trim())}</p>
            <p><strong>Phone:</strong> ${escapeHtml(phone.trim())}</p>
            <p><strong>Property:</strong> ${escapeHtml(address.trim())}</p>
            <p><strong>Rough monthly earnings:</strong> ${escapeHtml(earnings?.trim() || "Not provided")}</p>
            <hr />
            <p style="color:#666;font-size:12px;">Submitted from mandelrealtygroup.com audit form</p>
          `;

          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from,
              to: ["info@mandelrealtygroup.com"],
              reply_to: email.trim(),
              subject: `Revenue Audit Request — ${name.trim()}`,
              html,
            }),
          });

          const emailData = (await emailResponse.json()) as { message?: string };

          if (!emailResponse.ok) {
            json(500, { error: emailData.message ?? "Failed to send email." });
            return;
          }

          json(200, { ok: true });
        } catch {
          json(500, { error: "Failed to send email." });
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
