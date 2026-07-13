export function getAuditSubmitUrl(): string {
  const override = import.meta.env.VITE_AUDIT_API_URL?.trim();
  if (override) return override;
  return "/api/audit";
}

export function getAuditSubmitHeaders(): Record<string, string> {
  return { "Content-Type": "application/json" };
}
