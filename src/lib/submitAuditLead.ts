export type AuditLeadPayload = {
  name: string;
  email: string;
  phone: string;
  address: string;
  earnings: string;
};

export async function submitAuditLead(payload: AuditLeadPayload): Promise<void> {
  const response = await fetch("/api/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, _gotcha: "" }),
  });

  const data = (await response.json().catch(() => ({}))) as { error?: string };

  if (!response.ok) {
    throw new Error(data.error ?? "Could not submit your request. Please call us instead.");
  }
}
