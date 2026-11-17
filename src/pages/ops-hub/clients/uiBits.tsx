import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Icon } from "./icons";

const AVC = ["255", "300", "155", "355", "65", "185", "275", "25", "210"];

export function hashIdx(s: string): number {
  let h = 0;
  for (const ch of String(s || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % AVC.length;
}

export function initials(name: string): string {
  const p = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return ((p[0] ? p[0][0] : "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() || "?";
}

export function Avatar({
  name,
  seed,
  className = "",
}: {
  name: string;
  seed?: string;
  className?: string;
}) {
  const hue = AVC[hashIdx(seed || name)];
  return (
    <span className={`av ${className}`.trim()} style={{ background: `oklch(0.5 0.11 ${hue})` }} aria-hidden>
      {initials(name)}
    </span>
  );
}

export function tone(h: number, c: number) {
  return {
    bg: `oklch(0.6 ${c} ${h} / 0.15)`,
    t: `oklch(0.45 ${c * 0.9} ${h})`,
  };
}

export function Chip({
  children,
  h,
  c,
}: {
  children: ReactNode;
  h: number;
  c: number;
}) {
  const t = tone(h, c);
  return (
    <span className="chip" style={{ background: t.bg, color: t.t }}>
      {children}
    </span>
  );
}

export function StatusChip({ active }: { active: boolean }) {
  return active ? <Chip h={155} c={0.13}>Active</Chip> : <Chip h={270} c={0.02}>Paused</Chip>;
}

export function PortalStatusChip({ label, h, c }: { label: string; h: number; c: number }) {
  return <Chip h={h} c={c}>{label}</Chip>;
}

export function ErrorBanner({
  title,
  detail,
  onRetry,
  onDismiss,
}: {
  title: string;
  detail?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  return (
    <div className="errbanner">
      <Icon name="alert" className="i sm" />
      <span>
        <b>{title}</b>
        {detail ? ` ${detail}` : null}
      </span>
      {onRetry ? (
        <button type="button" className="btn sm" onClick={onRetry}>
          Retry
        </button>
      ) : null}
      {onDismiss ? (
        <button type="button" className="iconbtn" style={{ width: 32, height: 32 }} onClick={onDismiss} aria-label="Dismiss">
          <Icon name="x" className="i sm" />
        </button>
      ) : null}
    </div>
  );
}

export function Toast({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="toast" role="status">
      <Icon name="check" className="i sm" />
      {message}
    </div>
  );
}

export function ConfirmModal({
  phone,
  title,
  body,
  confirmLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  phone?: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className={`scrim${phone ? " bottom" : ""}`}
      style={{ position: "fixed" }}
      onClick={onCancel}
    >
      {phone ? (
        <div className="sheet frost" onClick={(e) => e.stopPropagation()}>
          <h2 style={{ fontSize: 18, fontWeight: 650 }}>{title}</h2>
          <p className="lede" style={{ fontSize: "var(--t-sm)", margin: "6px 0 16px" }}>
            {body}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button type="button" className="btn danger" style={{ height: 48 }} disabled={busy} onClick={onConfirm}>
              {confirmLabel}
            </button>
            <button type="button" className="btn" style={{ height: 48 }} disabled={busy} onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="modal frost" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
          <h2>{title}</h2>
          <p className="lede">{body}</p>
          <div className="mfoot">
            <button type="button" className="btn" disabled={busy} onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="btn danger" disabled={busy} onClick={onConfirm}>
              <Icon name="trash" className="i sm" />
              {confirmLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function formatHeadDate(d = new Date()): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function unitsLabel(n: number): string {
  return `${n} ${n === 1 ? "unit" : "units"}`;
}

export function moneyExact(cents: number | null | undefined, currency = "CAD"): string {
  if (cents == null) return "—";
  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: currency || "CAD",
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

export function moneyCompact(cents: number | null | undefined, currency = "CAD"): string {
  if (cents == null) return "—";
  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: currency || "CAD",
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `$${Math.round(cents / 100).toLocaleString("en-CA")}`;
  }
}

export function defaultMonth(): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthTitle(yearMonth: string, short = false): string {
  const [ys, ms] = yearMonth.split("-");
  const d = new Date(Date.UTC(Number(ys), Number(ms) - 1, 1));
  if (Number.isNaN(d.getTime())) return yearMonth;
  return d.toLocaleDateString("en-US", {
    month: short ? "short" : "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function shiftYearMonth(yearMonth: string, delta: number): string {
  const [ys, ms] = yearMonth.split("-");
  const y = Number(ys);
  const m = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return yearMonth;
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Same year-month string API as clients/ui MonthPicker, styled as design `.mp` + `.yg`. */
export function MonthPicker({
  value,
  onChange,
  disabled,
  phone,
}: {
  value: string;
  onChange: (yearMonth: string) => void;
  disabled?: boolean;
  phone?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [ys, ms] = value.split("-");
  const year = Number(ys) || new Date().getUTCFullYear();
  const month = Number(ms) || 1;
  const [panelYear, setPanelYear] = useState(year);

  useEffect(() => {
    if (open) setPanelYear(year);
  }, [open, year]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const now = new Date();
  const curY = now.getUTCFullYear();
  const curM = now.getUTCMonth() + 1;

  const pick = (m: number) => {
    onChange(`${panelYear}-${String(m).padStart(2, "0")}`);
    setOpen(false);
  };

  const prev = () => onChange(shiftYearMonth(value, -1));
  const next = () => {
    const n = shiftYearMonth(value, 1);
    const [ny, nm] = n.split("-").map(Number);
    if (ny > curY || (ny === curY && nm > curM)) return;
    onChange(n);
  };
  const nextDisabled = (() => {
    const n = shiftYearMonth(value, 1);
    const [ny, nm] = n.split("-").map(Number);
    return ny > curY || (ny === curY && nm > curM);
  })();

  const yearGrid = (
    <div
      className="yg frost"
      id={listId}
      style={
        phone
          ? ({ position: "relative", width: "100%", borderRadius: "20px 20px 0 0", padding: "16px 16px 28px" } as CSSProperties)
          : ({ top: "100%", left: 0, marginTop: 6 } as CSSProperties)
      }
    >
      <div className="yh">
        <button type="button" className="iconbtn" onClick={() => setPanelYear((y) => y - 1)} aria-label="Previous year">
          <Icon name="back" className="i sm" />
        </button>
        <b>{panelYear}</b>
        <button
          type="button"
          className="iconbtn"
          disabled={panelYear >= curY}
          onClick={() => setPanelYear((y) => Math.min(curY, y + 1))}
          aria-label="Next year"
        >
          <Icon name="next" className="i sm" />
        </button>
      </div>
      <div className="grid">
        {MONTH_SHORT.map((label, i) => {
          const m = i + 1;
          const future = panelYear > curY || (panelYear === curY && m > curM);
          const sel = panelYear === year && m === month;
          const cur = panelYear === curY && m === curM;
          return (
            <button
              key={label}
              type="button"
              disabled={future}
              className={sel ? "sel" : cur ? "cur" : future ? "dis" : undefined}
              onClick={() => pick(m)}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className="mp" style={{ position: "relative" }}>
      <button type="button" className="iconbtn bd" disabled={disabled} onClick={prev} aria-label="Previous month">
        <Icon name="back" className="i sm" />
      </button>
      <button
        type="button"
        className="btn"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="cal" className="i sm" />
        {monthTitle(value, phone)}
        <Icon name="chev" className="i sm" />
      </button>
      <button
        type="button"
        className="iconbtn bd"
        disabled={disabled || nextDisabled}
        onClick={next}
        aria-label="Next month"
      >
        <Icon name="next" className="i sm" />
      </button>
      {open && !phone ? yearGrid : null}
      {open && phone ? (
        <div className="scrim bottom" style={{ position: "fixed" }} onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()}>{yearGrid}</div>
        </div>
      ) : null}
    </div>
  );
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export function useIsPhone(breakpoint = 767): boolean {
  const [phone, setPhone] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(`(max-width: ${breakpoint}px)`).matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = () => setPhone(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [breakpoint]);
  return phone;
}
