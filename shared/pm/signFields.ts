export type SignFieldType = "signature" | "name" | "date" | "text" | "checkbox";
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
  if (type === "signature") return { w: 0.36, h: 0.08 };
  if (type === "date") return { w: 0.3, h: 0.055 };
  if (type === "text") return { w: 0.32, h: 0.05 };
  if (type === "checkbox") return { w: 0.032, h: 0.032 };
  return { w: 0.32, h: 0.05 };
}

export function minFieldSize(type: SignFieldType): { w: number; h: number } {
  if (type === "checkbox") return { w: 0.012, h: 0.012 };
  if (type === "date") return { w: 0.08, h: 0.018 };
  if (type === "signature") return { w: 0.08, h: 0.022 };
  return { w: 0.06, h: 0.018 };
}

export function fieldLabel(type: SignFieldType): string {
  if (type === "signature") return "Sign here";
  if (type === "name") return "Printed name";
  if (type === "date") return "Date";
  if (type === "checkbox") return "Check";
  return "Text";
}

export function isCheckboxChecked(value: string | undefined): boolean {
  const v = (value || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "checked" || v === "x" || v === "yes";
}

function asType(v: unknown): SignFieldType | null {
  if (v === "signature" || v === "name" || v === "date" || v === "text" || v === "checkbox") {
    return v;
  }
  return null;
}

function asParty(v: unknown): SignParty {
  return String(v || "").trim().toLowerCase() === "mrg" ? "mrg" : "host";
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
    const min = minFieldSize(type);
    const boxW = Math.min(1, Math.max(min.w, w));
    const boxH = Math.min(1, Math.max(min.h, h));
    out.push({
      id: typeof r.id === "string" && r.id ? r.id : newFieldId(),
      type,
      party: type === "checkbox" ? "mrg" : asParty(r.party),
      page: Math.floor(page),
      x: Math.min(1 - boxW, Math.max(0, x)),
      y: Math.min(1 - boxH, Math.max(0, y)),
      w: boxW,
      h: boxH,
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

/** Host may change only their own name/text/signature — never geometry, MRG, or dates. */
export function mergeHostFieldValues(stored: SignField[], incoming: SignField[]): SignField[] {
  const byId = new Map(incoming.map((f) => [f.id, f]));
  const today = todayIsoDate();
  return stored.map((f) => {
    if (f.party === "mrg") return f;
    if (f.type === "date") return { ...f, value: today };
    if (f.type === "checkbox") return f;
    const next = byId.get(f.id);
    if (!next) {
      if (f.type === "name" || f.type === "text") return f;
      return f;
    }
    if (f.type === "signature") {
      return {
        ...f,
        value: next.value || f.value,
        signature_png: next.signature_png || f.signature_png,
      };
    }
    if (f.type === "name" || f.type === "text") {
      return { ...f, value: next.value ?? f.value };
    }
    return f;
  });
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

export function firstNameOf(full: string | null | undefined): string {
  const t = (full || "").trim();
  if (!t) return "";
  return t.split(/\s+/)[0] || "";
}
