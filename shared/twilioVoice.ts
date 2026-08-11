/**
 * Public base URL for Twilio voice webhooks (must be reachable by Twilio).
 */
export function twilioWebhookBaseUrl(): string {
  const explicit =
    process.env.PUBLIC_BASE_URL?.trim() ||
    process.env.TWILIO_WEBHOOK_BASE_URL?.trim() ||
    "";
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) {
    return vercel.startsWith("http") ? vercel.replace(/\/$/, "") : `https://${vercel}`;
  }

  return "https://www.mandelrealtygroup.com";
}

export function twilioBasicAuth(accountSid: string, authToken: string): string {
  return Buffer.from(`${accountSid}:${authToken}`).toString("base64");
}

export async function createTwilioCall(input: {
  accountSid: string;
  authToken: string;
  to: string;
  from: string;
  url: string;
  statusCallback?: string;
}): Promise<{ ok: boolean; sid?: string; error?: string }> {
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(input.accountSid)}/Calls.json`;
  const body = new URLSearchParams({
    To: input.to,
    From: input.from,
    Url: input.url,
    Method: "POST",
  });
  if (input.statusCallback) {
    body.set("StatusCallback", input.statusCallback);
    body.set("StatusCallbackMethod", "POST");
    body.set("StatusCallbackEvent", "initiated ringing answered completed");
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${twilioBasicAuth(input.accountSid, input.authToken)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const data = (await res.json().catch(() => ({}))) as {
      sid?: string;
      message?: string;
      error_message?: string;
    };
    if (!res.ok) {
      return {
        ok: false,
        error: data.message || data.error_message || `Twilio HTTP ${res.status}`,
      };
    }
    return { ok: true, sid: data.sid };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Twilio call failed",
    };
  }
}

export function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function twimlResponse(inner: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`;
}
