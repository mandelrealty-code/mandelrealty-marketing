import { getAuditSubmitHeaders, getAuditSubmitUrl } from "./audit-api";

export type AuditLeadPayload = {
  name: string;
  email: string;
  phone: string;
  address: string;
  earnings: string;
  contactConsent: boolean;
  marketingOptIn: boolean;
};

const FALLBACK_ERROR =
  "The free revenue audit is currently not available. Please call or email us directly.";

function sanitizeError(message?: string): string {
  if (!message) return FALLBACK_ERROR;
  const lower = message.toLowerCase();
  if (
    lower.includes("domain") ||
    lower.includes("verified") ||
    lower.includes("resend") ||
    lower.includes("https://")
  ) {
    return FALLBACK_ERROR;
  }
  return message;
}

export async function submitAuditLead(payload: AuditLeadPayload): Promise<void> {
  const response = await fetch(getAuditSubmitUrl(), {
    method: "POST",
    headers: getAuditSubmitHeaders(),
    body: JSON.stringify({ ...payload, _gotcha: "" }),
  });

  const data = (await response.json().catch(() => ({}))) as { error?: string };

  if (!response.ok) {
    throw new Error(sanitizeError(data.error));
  }
}
