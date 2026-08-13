export type SignFieldType = "signature" | "name" | "date";

export type SignField = {
  id: string;
  type: SignFieldType;
  /** 1-based page index */
  page: number;
  /** Fractions of page size, origin top-left */
  x: number;
  y: number;
  w: number;
  h: number;
};

export function newFieldId(): string {
  return `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function defaultFieldSize(type: SignFieldType): { w: number; h: number } {
  if (type === "signature") return { w: 0.32, h: 0.07 };
  if (type === "date") return { w: 0.18, h: 0.045 };
  return { w: 0.28, h: 0.045 };
}

export function normalizeSignFields(raw: unknown): SignField[] {
  if (!Array.isArray(raw)) return [];
  const out: SignField[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const type = r.type;
    if (type !== "signature" && type !== "name" && type !== "date") continue;
    const page = Number(r.page);
    const x = Number(r.x);
    const y = Number(r.y);
    const w = Number(r.w);
    const h = Number(r.h);
    if (!Number.isFinite(page) || page < 1) continue;
    if (![x, y, w, h].every((n) => Number.isFinite(n))) continue;
    out.push({
      id: typeof r.id === "string" && r.id ? r.id : newFieldId(),
      type,
      page: Math.floor(page),
      x: Math.min(1, Math.max(0, x)),
      y: Math.min(1, Math.max(0, y)),
      w: Math.min(1, Math.max(0.04, w)),
      h: Math.min(1, Math.max(0.02, h)),
    });
  }
  return out;
}

export function hasSignatureField(fields: SignField[]): boolean {
  return fields.some((f) => f.type === "signature");
}
