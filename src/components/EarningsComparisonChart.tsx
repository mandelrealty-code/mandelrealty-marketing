import { useId } from "react";
import { EARNINGS_BY_MONTH, EARNINGS_SUMMARY } from "../lib/constants";

const W = 560;
const H = 220;
const PAD = { top: 16, right: 12, bottom: 36, left: 44 };
const innerW = W - PAD.left - PAD.right;
const innerH = H - PAD.top - PAD.bottom;
const maxY = 12000;

function yScale(v: number) {
  return PAD.top + innerH - (v / maxY) * innerH;
}

/**
 * Clean dual-series bar chart — marketing visual, not a cropped dashboard.
 */
export function EarningsComparisonChart({ className = "" }: { className?: string }) {
  const gid = useId().replace(/:/g, "");
  const groupW = innerW / EARNINGS_BY_MONTH.length;
  const barW = Math.max(4, groupW * 0.32);

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mrg-muted">
          {EARNINGS_SUMMARY.note}
        </p>
        <div className="flex items-center gap-4 text-xs text-mrg-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-white/35" aria-hidden />
            2025
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-mrg-gold" aria-hidden />
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
            <stop offset="0%" stopColor="#f5c518" stopOpacity="1" />
            <stop offset="100%" stopColor="#f5c518" stopOpacity="0.55" />
          </linearGradient>
        </defs>

        {/* Grid */}
        {[0, 3000, 6000, 9000, 12000].map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={yScale(tick)}
              y2={yScale(tick)}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 8}
              y={yScale(tick) + 3}
              textAnchor="end"
              fill="rgba(154,154,154,0.9)"
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
                fill="rgba(255,255,255,0.28)"
              />
              {row.y2026 != null && (
                <rect
                  x={cx + 1.5}
                  y={yScale(y2026)}
                  width={barW}
                  height={Math.max(h26, y2026 > 0 ? 2 : 0)}
                  rx="2"
                  fill={isMrg ? `url(#${gid}-gold)` : "rgba(245,197,24,0.35)"}
                />
              )}
              <text
                x={cx}
                y={H - 12}
                textAnchor="middle"
                fill="rgba(154,154,154,0.95)"
                fontSize="9"
                fontFamily="system-ui, sans-serif"
              >
                {row.month}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-mrg-muted">
        <span>
          2025 total:{" "}
          <strong className="text-mrg-text">${EARNINGS_SUMMARY.year2025.toLocaleString()}</strong>
        </span>
        <span>
          May–Aug 2026:{" "}
          <strong className="text-mrg-gold">
            ${EARNINGS_SUMMARY.mayAug2026.toLocaleString()}
          </strong>
        </span>
      </div>
    </div>
  );
}
