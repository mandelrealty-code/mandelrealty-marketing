import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";

export function MrgMark({ size = 22 }: { size?: number }) {
  return (
    <div
      className="grid shrink-0 place-items-center rounded-md bg-[#f5f5f5] font-bold tracking-wide text-[#0a0a0a]"
      style={{ width: size, height: size, fontSize: Math.max(8, size * 0.38) }}
      aria-hidden
    >
      MRG
    </div>
  );
}

export function ModeSwitcher({
  mode,
  onChange,
}: {
  mode: "crm" | "clients";
  onChange: (mode: "crm" | "clients") => void;
}) {
  return (
    <div className="flex gap-0.5 rounded-lg border border-white/8 bg-[#1a1a1a] p-0.5">
      <button
        type="button"
        onClick={() => onChange("crm")}
        className={`rounded-md px-3 py-1 text-xs font-semibold ${
          mode === "crm"
            ? "bg-[#c4a35a] text-[#0a0a0a]"
            : "text-[#9a9590] hover:text-[#f5f5f5]"
        }`}
      >
        CRM
      </button>
      <button
        type="button"
        onClick={() => onChange("clients")}
        className={`rounded-md px-3 py-1 text-xs font-semibold ${
          mode === "clients"
            ? "bg-[#c4a35a] text-[#0a0a0a]"
            : "text-[#9a9590] hover:text-[#f5f5f5]"
        }`}
      >
        Clients
      </button>
    </div>
  );
}

export function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
        active ? "bg-[#c4a35a]" : "bg-[#3a3a3a]"
      }`}
    />
  );
}

export function FieldLabel({
  children,
  optional,
}: {
  children: ReactNode;
  optional?: boolean;
}) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6f6a65]">
      {children}
      {optional ? (
        <span className="ml-1 font-medium normal-case tracking-normal">optional</span>
      ) : null}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-[9px] border border-white/10 bg-[#1c1c1c] px-3.5 py-3 text-[15px] text-[#f5f5f5] outline-none placeholder:text-[#6f6a65] focus:border-[#c4a35a]/55 ${
        props.className ?? ""
      }`}
    />
  );
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-[52px] w-full resize-none rounded-[9px] border border-white/10 bg-[#1c1c1c] px-3.5 py-3 text-[15px] text-[#f5f5f5] outline-none placeholder:text-[#6f6a65] focus:border-[#c4a35a]/55 ${
        props.className ?? ""
      }`}
    />
  );
}

export function Sheet({
  title,
  onCancel,
  children,
  desktop,
}: {
  title: string;
  onCancel: () => void;
  children: ReactNode;
  desktop?: boolean;
}) {
  if (desktop) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/66 p-4">
        <div className="flex max-h-[min(92vh,880px)] w-full max-w-[460px] flex-col overflow-hidden rounded-[14px] border border-white/10 bg-[#141414]">
          <div className="flex shrink-0 items-center justify-between gap-3 px-6 pb-3 pt-6">
            <h2 className="text-[17px] font-bold text-[#f5f5f5]">{title}</h2>
            <button
              type="button"
              onClick={onCancel}
              className="text-sm text-[#9a9590] hover:text-[#f5f5f5]"
            >
              Cancel
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6">
            {children}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/66">
      <button type="button" className="flex-1" aria-label="Dismiss" onClick={onCancel} />
      <div className="flex max-h-[min(92vh,880px)] flex-col overflow-hidden rounded-t-2xl border-t border-white/10 bg-[#141414]">
        <div className="shrink-0 px-4 pt-2.5">
          <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-white/14" />
          <div className="mb-4 flex items-center justify-between">
            <button type="button" onClick={onCancel} className="text-[13px] text-[#9a9590]">
              Cancel
            </button>
            <h2 className="text-[15px] font-bold text-[#f5f5f5]">{title}</h2>
            <span className="w-11" />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  );
}

export function GoldButton({
  children,
  size = "default",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { size?: "default" | "sm" }) {
  const sizing =
    size === "sm"
      ? "rounded-md px-3 py-1.5 text-[13px] font-semibold"
      : "rounded-[9px] px-4 py-3.5 text-[15px] font-bold";
  return (
    <button
      {...props}
      className={`bg-[#c4a35a] text-center text-[#0a0a0a] hover:bg-[#dcc084] disabled:opacity-60 ${sizing} ${className}`}
    >
      {children}
    </button>
  );
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

function shiftYearMonth(yearMonth: string, delta: number): string {
  const [ys, ms] = yearMonth.split("-");
  const y = Number(ys);
  const m = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return yearMonth;
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function labelYearMonth(yearMonth: string): string {
  const [ys, ms] = yearMonth.split("-");
  const y = Number(ys);
  const m = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return yearMonth;
  return `${MONTH_SHORT[m - 1]} ${y}`;
}

/** Branded YYYY-MM picker (prev / label / next + month grid). */
export function MonthPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (yearMonth: string) => void;
  disabled?: boolean;
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

  const pick = (m: number) => {
    onChange(`${panelYear}-${String(m).padStart(2, "0")}`);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="flex items-center overflow-hidden rounded-md border border-white/10 bg-[#1c1c1c]">
        <button
          type="button"
          disabled={disabled}
          aria-label="Previous month"
          onClick={() => onChange(shiftYearMonth(value, -1))}
          className="px-2 py-1.5 text-[13px] text-[#9a9590] hover:bg-white/5 hover:text-[#f5f5f5] disabled:opacity-50"
        >
          ‹
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((o) => !o)}
          className="min-w-[5.75rem] px-1.5 py-1.5 text-center text-[13px] font-semibold tabular-nums text-[#f5f5f5] hover:bg-white/5 disabled:opacity-50"
        >
          {labelYearMonth(value)}
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-label="Next month"
          onClick={() => onChange(shiftYearMonth(value, 1))}
          className="px-2 py-1.5 text-[13px] text-[#9a9590] hover:bg-white/5 hover:text-[#f5f5f5] disabled:opacity-50"
        >
          ›
        </button>
      </div>

      {open ? (
        <div
          id={listId}
          role="dialog"
          aria-label="Choose month"
          className="absolute right-0 z-30 mt-1.5 w-[220px] rounded-lg border border-white/10 bg-[#141414] p-3 shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
        >
          <div className="mb-2.5 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous year"
              onClick={() => setPanelYear((y) => y - 1)}
              className="rounded px-2 py-1 text-[13px] text-[#9a9590] hover:bg-white/5 hover:text-[#f5f5f5]"
            >
              ‹
            </button>
            <span className="text-[13px] font-semibold tabular-nums text-[#f5f5f5]">
              {panelYear}
            </span>
            <button
              type="button"
              aria-label="Next year"
              onClick={() => setPanelYear((y) => y + 1)}
              className="rounded px-2 py-1 text-[13px] text-[#9a9590] hover:bg-white/5 hover:text-[#f5f5f5]"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MONTH_SHORT.map((label, i) => {
              const m = i + 1;
              const selected = panelYear === year && m === month;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => pick(m)}
                  className={`rounded-md py-1.5 text-[12px] font-semibold ${
                    selected
                      ? "bg-[#c4a35a] text-[#0a0a0a]"
                      : "text-[#9a9590] hover:bg-white/5 hover:text-[#f5f5f5]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Compact two-option segmented control (Active/Paused, MRG/Host). */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-0.5 rounded-[9px] border border-white/10 bg-[#1a1a1a] p-0.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`flex-1 rounded-[7px] py-2 text-center text-[13px] ${
              active
                ? "bg-[#c4a35a] font-semibold text-[#0a0a0a]"
                : "font-medium text-[#9a9590] hover:text-[#f5f5f5]"
            } disabled:opacity-50`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
