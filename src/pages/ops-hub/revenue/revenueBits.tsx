import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { CompanyCategory } from "../../clients/CompanyPnl";
import type { PortfolioUnit } from "../../clients/monthCloseText";
import { Icon } from "../clients/icons";
import { tone } from "../clients/uiBits";
import { pctLabel } from "../properties/propertyBits";

/* ---------------- icons not in the shared set ---------------- */

const EXTRA: Record<string, string> = {
  sync: '<path d="M20 11a8 8 0 0 0-14.9-3.6M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.9 3.6M20 20v-4h-4"/>',
  csv: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 11v6M9 14l3 3 3-3"/>',
  pl: '<path d="M4 19h16"/><path d="M7 15V9M12 15V5M17 15v-3"/>',
  sub: '<path d="M4 7h16M4 12h16M4 17h10"/><circle cx="18" cy="17" r="2"/>',
};

export function RIcon({ name, className = "i" }: { name: string; className?: string }) {
  const extra = EXTRA[name];
  if (!extra) return <Icon name={name} className={className} />;
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: extra }} />;
}

export function Spinner({ light, size }: { light?: boolean; size?: number }) {
  return (
    <i
      className="spin"
      style={{
        ...(light ? { borderColor: "rgb(255 255 255 / .3)", borderTopColor: "#fff" } : {}),
        ...(size ? { width: size, height: size } : {}),
      }}
    />
  );
}

/* ---------------- month close logic (mirrors MonthClosePanel) ---------------- */

export type SyncFilter = "all" | "stale" | "unlinked" | "ready";
export type SyncProgress = { total: number; done: number; currentName: string } | null;
export type SyncFailure = { property_id: string; name: string; error: string };

export function needsAttention(unit: PortfolioUnit): boolean {
  return unit.sync_status === "stale" || unit.sync_status === "empty";
}

export function isReady(unit: PortfolioUnit): boolean {
  return unit.sync_status === "fresh";
}

/** Short deal for the UI (`20% · HST invoice`). CSV keeps the long `takeLabel`. */
export function shortDeal(unit: PortfolioUnit): string | null {
  if (unit.rate_bps == null) return null;
  return `${pctLabel(unit.rate_bps)} · HST ${unit.hst_mode === "invoice" ? "invoice" : "cohost"}`;
}

export function DealShort({ unit }: { unit: PortfolioUnit }) {
  const label = shortDeal(unit);
  return label ? <span className="deal">{label}</span> : <span className="gapchip">No billing terms</span>;
}

export function monthOnly(yearMonth: string, title: string): string {
  return title.replace(/ \d{4}$/, "") || yearMonth;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function relAgo(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return shortDate(iso);
}

export type SyncKind = "synced" | "stale" | "failed" | "unlinked" | "syncing" | "queued";

export type SyncContext = {
  failures: SyncFailure[];
  rowBusyId: string | null;
  currentId: string | null;
  queuedIds: Set<string>;
  doneIds: Set<string>;
};

export function syncState(unit: PortfolioUnit, ctx: SyncContext): { kind: SyncKind; meta: string } {
  if (unit.sync_status === "unlinked") return { kind: "unlinked", meta: "" };
  if (ctx.rowBusyId === unit.property_id || ctx.currentId === unit.property_id) return { kind: "syncing", meta: "" };
  if (ctx.queuedIds.has(unit.property_id)) return { kind: "queued", meta: "" };
  const fail = ctx.failures.find((f) => f.property_id === unit.property_id);
  if (fail) return { kind: "failed", meta: fail.error };
  if (ctx.doneIds.has(unit.property_id)) return { kind: "synced", meta: "just now" };
  if (unit.sync_status === "empty") return { kind: "stale", meta: "$0 financials" };
  if (unit.sync_status === "stale") {
    return { kind: "stale", meta: unit.last_synced_at ? `Last sync ${shortDate(unit.last_synced_at)}` : "Never synced" };
  }
  return { kind: "synced", meta: relAgo(unit.last_synced_at) };
}

const SYN: Record<Exclude<SyncKind, "syncing">, [string, number, number]> = {
  synced: ["Synced", 155, 0.13],
  stale: ["Stale", 65, 0.14],
  failed: ["Failed", 25, 0.18],
  unlinked: ["Unlinked", 270, 0.02],
  queued: ["Queued", 270, 0.02],
};

export function SyncChip({ kind, meta, row }: { kind: SyncKind; meta?: string; row?: boolean }) {
  let chip: ReactNode;
  if (kind === "syncing") {
    const t = tone(255, 0.14);
    chip = (
      <span className="chip" style={{ background: t.bg, color: t.t }}>
        <i className="spin" style={{ width: 10, height: 10, borderWidth: 1.5 }} />
        Syncing
      </span>
    );
  } else {
    const [label, h, c] = SYN[kind];
    const t = tone(h, c);
    chip = (
      <span className="chip" style={{ background: t.bg, color: t.t }}>
        {label}
      </span>
    );
  }
  return (
    <span className="syn" style={row ? { flexDirection: "row" } : undefined}>
      {chip}
      {meta && !row ? <span className="meta">{meta}</span> : null}
    </span>
  );
}

/* ---------------- clipboard ---------------- */

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Pressed copy button shows `Copied` for ~2s. */
export function useCopied(ms = 2000) {
  const [key, setKey] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );
  const mark = useCallback(
    (k: string) => {
      setKey(k);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setKey(null), ms);
    },
    [ms],
  );
  return { copiedKey: key, markCopied: mark };
}

export function CopyBtn({
  label,
  copied,
  sm = true,
  style,
  disabled,
  onClick,
}: {
  label: string;
  copied: boolean;
  sm?: boolean;
  style?: CSSProperties;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`btn${sm ? " sm" : ""}${copied ? " copied" : ""}`}
      style={style}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <Icon name={copied ? "check" : "copy"} className="i xs" />
      {copied ? "Copied" : label}
    </button>
  );
}

/* ---------------- money input ---------------- */

export function parseDollars(raw: string): number | null {
  const s = String(raw).replace(/[^0-9.-]/g, "");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function dollarsInputValue(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function defaultExpenseDate(yearMonth: string): string {
  const today = new Date();
  const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  if (ym === yearMonth) {
    return `${ym}-${String(today.getDate()).padStart(2, "0")}`;
  }
  const [ys, ms] = yearMonth.split("-");
  const last = new Date(Date.UTC(Number(ys), Number(ms), 0));
  return last.toISOString().slice(0, 10);
}

export const CATEGORIES: { id: CompanyCategory; label: string }[] = [
  { id: "software", label: "Software" },
  { id: "ads", label: "Ads" },
  { id: "insurance", label: "Insurance" },
  { id: "contractor", label: "Contractor" },
  { id: "other", label: "Other" },
];

export function categoryLabel(c: CompanyCategory): string {
  return CATEGORIES.find((x) => x.id === c)?.label ?? "Other";
}

export function errMsg(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

/* ---------------- sheet frame (design side-sheet / bottom sheet) ---------------- */

export function SheetFrame({
  phone,
  busy,
  width = 500,
  onClose,
  children,
}: {
  phone?: boolean;
  busy?: boolean;
  width?: number;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  return (
    <div
      className={`scrim${phone ? " bottom" : ""}`}
      style={{ position: "fixed", justifyContent: phone ? undefined : "flex-end" }}
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className={`${phone ? "sheet" : "side-sheet"} frost`}
        style={
          phone
            ? { maxHeight: "90dvh", overflow: "auto", display: "flex", flexDirection: "column" }
            : { width }
        }
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function SheetHead({
  title,
  lede,
  phone,
  onClose,
}: {
  title: string;
  lede?: string;
  phone?: boolean;
  onClose: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2 style={{ fontSize: phone ? 18 : 20, fontWeight: 650 }}>{title}</h2>
        {lede ? (
          <p className="lede" style={{ fontSize: "var(--t-sm)", margin: "4px 0 0" }}>
            {lede}
          </p>
        ) : null}
      </div>
      <button type="button" className="iconbtn" aria-label="Close" onClick={onClose}>
        <Icon name="x" />
      </button>
    </div>
  );
}

export function Field({
  label,
  opt,
  hint,
  full,
  children,
}: {
  label: string;
  opt?: boolean;
  hint?: ReactNode;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`field${full ? " full" : ""}`}>
      <label>
        {label}
        {opt ? <em> (optional)</em> : null}
      </label>
      {children}
      {hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}

export const btnH = (phone: boolean | undefined, primary = false) =>
  phone ? { height: primary ? 48 : 44 } : undefined;

export function footStyle(phone?: boolean, between = false): CSSProperties {
  return phone
    ? { flexDirection: "column-reverse", gap: 8, marginTop: 16 }
    : {
        marginTop: "auto",
        paddingTop: 16,
        borderTop: "1px solid var(--line-2)",
        ...(between ? { justifyContent: "space-between" } : {}),
      };
}
