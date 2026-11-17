import type { ReactNode } from "react";
import type { PropertyRow } from "../../clients/api";
import { Icon } from "../clients/icons";
import { Chip } from "../clients/uiBits";

export function isLinked(p: Pick<PropertyRow, "hospitable_property_id">): boolean {
  return Boolean(p.hospitable_property_id);
}

export function isActive(p: Pick<PropertyRow, "active">): boolean {
  return p.active !== false;
}

export function pctLabel(bps: number): string {
  const pct = bps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2).replace(/0+$/, "")}%`;
}

/** Short deal label for the list: `20% · HST invoice`, or null when no commission is set. */
export function dealPill(p: Pick<PropertyRow, "current_rate_bps" | "hst_mode">): string | null {
  if (p.current_rate_bps == null) return null;
  const mode = p.hst_mode === "invoice" ? "invoice" : "cohost";
  return `${pctLabel(p.current_rate_bps)} · HST ${mode}`;
}

export function DealPill({ p }: { p: Pick<PropertyRow, "current_rate_bps" | "hst_mode"> }) {
  const label = dealPill(p);
  return label ? <span className="deal">{label}</span> : <span className="gapchip">No billing terms</span>;
}

export function LinkedChip({ linked }: { linked: boolean }) {
  return linked ? (
    <Chip h={185} c={0.11}>
      Linked
    </Chip>
  ) : (
    <Chip h={65} c={0.14}>
      Not linked
    </Chip>
  );
}

export function ActiveChip({ active }: { active: boolean }) {
  return active ? (
    <Chip h={155} c={0.13}>
      Active
    </Chip>
  ) : (
    <Chip h={270} c={0.02}>
      Paused
    </Chip>
  );
}

export function CoverThumb({
  url,
  width,
  height,
  radius = 8,
}: {
  url?: string | null;
  width: number | string;
  height: number | string;
  radius?: number;
}) {
  if (url) {
    return (
      <span className="cov" style={{ width, height, borderRadius: radius }}>
        <img src={url} alt="" loading="lazy" />
      </span>
    );
  }
  return (
    <span className="cov none" style={{ width, height, borderRadius: radius }}>
      <Icon name="img" className="i sm" />
    </span>
  );
}

/** Design chips (`.chipseg`, `.pfilters`, `.cchips`) are styled as spans. */
export function SpanBtn({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      aria-pressed={on}
      className={on ? "on" : undefined}
      style={{ cursor: "pointer" }}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {children}
    </span>
  );
}

export function copyText(
  value: string,
  onOk: () => void,
  onFail: (msg: string) => void,
) {
  if (!value) return;
  void navigator.clipboard
    .writeText(value)
    .then(onOk)
    .catch(() => onFail("Could not copy. Select the id and copy it by hand."));
}

export function errMsg(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}
