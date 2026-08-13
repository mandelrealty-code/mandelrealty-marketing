export type SignFieldType = "signature" | "name" | "date" | "text";
export type SignParty = "host" | "mrg";

export type SignField = {
  id: string;
  type: SignFieldType;
  /** host = client fills in portal; mrg = we fill before sending */
  party: SignParty;
  /** 1-based page index */
  page: number;
  /** Fractions of page size, origin top-left */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Typed name / date / text */
  value?: string;
  /** data:image/png;base64,… — MRG signature drawn before send */
  signature_png?: string;
};

export function newFieldId(): string {
  return `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function defaultFieldSize(type: SignFieldType): { w: number; h: number } {
  if (type === "signature") return { w: 0.32, h: 0.07 };
  if (type === "date") return { w: 0.18, h: 0.045 };
  if (type === "text") return { w: 0.28, h: 0.042 };
  return { w: 0.28, h: 0.045 };
}

export function fieldLabel(type: SignFieldType): string {
  if (type === "signature") return "Sign here";
  if (type === "name") return "Printed name";
  if (type === "date") return "Date";
  return "Text";
}

function asType(v: unknown): SignFieldType | null {
  if (v === "signature" || v === "name" || v === "date" || v === "text") return v;
  return null;
}

function asParty(v: unknown): SignParty {
  return v === "mrg" ? "mrg" : "host";
}

export function normalizeSignFields(raw: unknown): SignField[] {
  if (!Array.isArray(raw)) return [];
  const out: SignField[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const type = asType(r.type);
    if (!type) continue;
    const page = Number(r.page);
    const x = Number(r.x);
    const y = Number(r.y);
    const w = Number(r.w);
    const h = Number(r.h);
    if (!Number.isFinite(page) || page < 1) continue;
    if (![x, y, w, h].every((n) => Number.isFinite(n))) continue;
    const value = typeof r.value === "string" ? r.value : "";
    const png = typeof r.signature_png === "string" ? r.signature_png : "";
    out.push({
      id: typeof r.id === "string" && r.id ? r.id : newFieldId(),
      type,
      party: asParty(r.party),
      page: Math.floor(page),
      x: Math.min(1, Math.max(0, x)),
      y: Math.min(1, Math.max(0, y)),
      w: Math.min(1, Math.max(0.03, w)),
      h: Math.min(1, Math.max(0.015, h)),
      ...(value ? { value } : {}),
      ...(png ? { signature_png: png } : {}),
    });
  }
  return out;
}

export function hasSignatureField(fields: SignField[]): boolean {
  return fields.some((f) => f.type === "signature");
}

export function hasHostSignature(fields: SignField[]): boolean {
  return fields.some((f) => f.type === "signature" && f.party !== "mrg");
}

export function hostFields(fields: SignField[]): SignField[] {
  return fields.filter((f) => f.party !== "mrg");
}

export function mrgFields(fields: SignField[]): SignField[] {
  return fields.filter((f) => f.party === "mrg");
}

/** Positions only — do not persist drawn signatures on the template. */
export function fieldsForTemplate(fields: SignField[]): SignField[] {
  return normalizeSignFields(fields).map((f) => ({
    id: f.id,
    type: f.type,
    party: f.party,
    page: f.page,
    x: f.x,
    y: f.y,
    w: f.w,
    h: f.h,
  }));
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}
