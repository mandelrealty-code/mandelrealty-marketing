import { useEffect, useState, type ReactNode } from "react";
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

/** Display-only: "1,100SqFt." → "1,100 SqFt." */
export function formatListingName(name: string): string {
  return String(name || "").replace(/(\d)\s*[Ss]q\.?\s*[Ff]t\.?/g, "$1 SqFt.");
}

type DealSource = Pick<PropertyRow, "current_rate_bps" | "hst_mode"> & {
  current_term?: { rate_bps: number } | null;
};

/** Short deal label for the list: `20% · HST invoice`, or null when no commission is set. */
export function dealPill(p: DealSource): string | null {
  const rate = p.current_rate_bps ?? p.current_term?.rate_bps ?? null;
  if (rate == null) return null;
  const mode = p.hst_mode === "invoice" ? "invoice" : "cohost";
  return `${pctLabel(rate)} · HST ${mode}`;
}

export function DealPill({ p }: { p: DealSource }) {
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
  hero,
}: {
  url?: string | null;
  width: number | string;
  height: number | string;
  radius?: number;
  /** Larger empty-state copy for the property detail cover card. */
  hero?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [url]);
  const showImg = Boolean(url) && !failed;

  if (showImg) {
    return (
      <span className={`cov${loaded ? "" : " pending"}`} style={{ width, height, borderRadius: radius }}>
        <img
          src={url!}
          alt=""
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
        {!loaded ? (
          <span className="cov-ph" aria-hidden>
            <Icon name="img" className="i sm" />
          </span>
        ) : null}
      </span>
    );
  }

  if (hero) {
    return (
      <span
        className="cov none"
        style={{
          width,
          height,
          borderRadius: radius,
          flexDirection: "column",
          gap: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="img" />
        <b style={{ fontSize: "var(--t-sm)", color: "var(--ink)" }}>No cover photo</b>
        <span className="meta">Shows on the property list</span>
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
