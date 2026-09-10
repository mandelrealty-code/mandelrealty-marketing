import { useId } from "react";
import { EARNINGS_BY_MONTH, EARNINGS_SUMMARY } from "../lib/constants";

const W = 560;
const H = 220;
const PAD = { top: 16, right: 12, bottom: 36, left: 44 };
const innerW = W - PAD.left - PAD.right;
const innerH = H - PAD.top - PAD.bottom;
const maxY = 12000;

const THEMES = {
  dark: {
    muted: "text-mrg-muted",
    strong: "text-mrg-text",
    goldText: "text-mrg-gold",
    legend2025: "bg-white/35",
    legend2026: "bg-mrg-gold",
    grid: "rgba(255,255,255,0.06)",
    axis: "rgba(154,154,154,0.9)",
    bar2025: "rgba(255,255,255,0.28)",
    bar2026Pre: "rgba(245,197,24,0.35)",
    goldTop: "#f5c518",
    goldBottom: "#f5c518",
    goldBottomOpacity: "0.55",
  },
  light: {
    muted: "text-[#717171]",
    strong: "text-[#222222]",
    goldText: "text-[#8a6f2e]",
    legend2025: "bg-[#222222]/30",
    legend2026: "bg-[#c4a35a]",
    grid: "rgba(34,34,34,0.08)",
    axis: "rgba(113,113,113,0.95)",
    bar2025: "rgba(34,34,34,0.22)",
    bar2026Pre: "rgba(196,163,90,0.38)",
    goldTop: "#c4a35a",
    goldBottom: "#a8883f",
    goldBottomOpacity: "1",
  },
  lightBlue: {
    muted: "text-[#717171]",
    strong: "text-[#222222]",
    goldText: "text-[#1b4fd6]",
    legend2025: "bg-[#222222]/30",
    legend2026: "bg-[#2F6BFF]",
    grid: "rgba(34,34,34,0.08)",
    axis: "rgba(113,113,113,0.95)",
    bar2025: "rgba(34,34,34,0.22)",
    bar2026Pre: "rgba(47,107,255,0.35)",
    goldTop: "#2F6BFF",
    goldBottom: "#1b4fd6",
    goldBottomOpacity: "1",
  },
  lightGreen: {
    muted: "text-[#717171]",
    strong: "text-[#222222]",
    goldText: "text-[#0d8f53]",
    legend2025: "bg-[#222222]/30",
    legend2026: "bg-[#12B76A]",
    grid: "rgba(34,34,34,0.08)",
    axis: "rgba(113,113,113,0.95)",
    bar2025: "rgba(34,34,34,0.22)",
    bar2026Pre: "rgba(18,183,106,0.35)",
    goldTop: "#12B76A",
    goldBottom: "#0d8f53",
    goldBottomOpacity: "1",
  },
  lightOrange: {
    muted: "text-[#717171]",
    strong: "text-[#222222]",
    goldText: "text-[#d63a10]",
    legend2025: "bg-[#222222]/30",
    legend2026: "bg-[#FF4716]",
    grid: "rgba(34,34,34,0.08)",
    axis: "rgba(113,113,113,0.95)",
    bar2025: "rgba(34,34,34,0.22)",
    bar2026Pre: "rgba(255,71,22,0.35)",
    goldTop: "#FF4716",
    goldBottom: "#d63a10",
    goldBottomOpacity: "1",
  },
  lightYellow: {
    muted: "text-[#717171]",
    strong: "text-[#222222]",
    goldText: "text-[#8a6d05]",
    legend2025: "bg-[#222222]/30",
    legend2026: "bg-[#F5C518]",
    grid: "rgba(34,34,34,0.08)",
    axis: "rgba(113,113,113,0.95)",
    bar2025: "rgba(34,34,34,0.22)",
    bar2026Pre: "rgba(245,197,24,0.35)",
    goldTop: "#F5C518",
    goldBottom: "#d4a60f",
    goldBottomOpacity: "1",
  },
} as const;

function yScale(v: number) {
  return PAD.top + innerH - (v / maxY) * innerH;
}

/**
 * Clean dual-series bar chart — marketing visual, not a cropped dashboard.
 */
export function EarningsComparisonChart({
  className = "",
  variant = "dark",
}: {
  className?: string;
  variant?: "dark" | "light" | "lightBlue" | "lightGreen" | "lightOrange" | "lightYellow";
}) {
  const gid = useId().replace(/:/g, "");
  const groupW = innerW / EARNINGS_BY_MONTH.length;
  const barW = Math.max(4, groupW * 0.32);
  const t = THEMES[variant];

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${t.muted}`}>
          {EARNINGS_SUMMARY.note}
        </p>
        <div className={`flex items-center gap-4 text-xs ${t.muted}`}>
          <span className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-sm ${t.legend2025}`} aria-hidden />
            2025
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-sm ${t.legend2026}`} aria-hidden />
            2026 · MRG from {EARNINGS_SUMMARY.mrgStart}
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 h-auto w-full"
        role="img"
        aria-label="Monthly Airbnb earnings 2025 versus 2026 for the same Toronto unit"
      >
        <defs>
          <linearGradient id={`${gid}-gold`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.goldTop} stopOpacity="1" />
            <stop
              offset="100%"
              stopColor={t.goldBottom}
              stopOpacity={t.goldBottomOpacity}
            />
          </linearGradient>
        </defs>

        {[0, 3000, 6000, 9000, 12000].map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={yScale(tick)}
              y2={yScale(tick)}
              stroke={t.grid}
              strokeWidth="1"
            />
            <text
              x={PAD.left - 8}
              y={yScale(tick) + 3}
              textAnchor="end"
              fill={t.axis}
              fontSize="9"
              fontFamily="system-ui, sans-serif"
            >
              {tick === 0 ? "0" : `${tick / 1000}k`}
            </text>
          </g>
        ))}

        {EARNINGS_BY_MONTH.map((row, i) => {
          const cx = PAD.left + i * groupW + groupW / 2;
          const h25 = (row.y2025 / maxY) * innerH;
          const y2026 = row.y2026 ?? 0;
          const h26 = row.y2026 == null ? 0 : (y2026 / maxY) * innerH;
          const isMrg = i >= 4; // May onward

          return (
            <g key={row.month}>
              <rect
                x={cx - barW - 1.5}
                y={yScale(row.y2025)}
                width={barW}
                height={Math.max(h25, row.y2025 > 0 ? 2 : 0)}
                rx="2"
                fill={t.bar2025}
              />
              {row.y2026 != null && (
                <rect
                  x={cx + 1.5}
                  y={yScale(y2026)}
                  width={barW}
                  height={Math.max(h26, y2026 > 0 ? 2 : 0)}
                  rx="2"
                  fill={isMrg ? `url(#${gid}-gold)` : t.bar2026Pre}
                />
              )}
              <text
                x={cx}
                y={H - 12}
                textAnchor="middle"
                fill={t.axis}
                fontSize="9"
                fontFamily="system-ui, sans-serif"
              >
                {row.month}
              </text>
            </g>
          );
        })}
      </svg>

      <div className={`mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs ${t.muted}`}>
        <span>
          2025 total:{" "}
          <strong className={t.strong}>${EARNINGS_SUMMARY.year2025.toLocaleString()}</strong>
        </span>
        <span>
          May–Aug 2026:{" "}
          <strong className={t.goldText}>
            ${EARNINGS_SUMMARY.mayAug2026.toLocaleString()}
          </strong>
        </span>
      </div>
    </div>
  );
}
