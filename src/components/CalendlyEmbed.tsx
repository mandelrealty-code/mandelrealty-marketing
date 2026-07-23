import { useMemo } from "react";
import { CALENDLY_URL, buildCalendlyEmbedUrl } from "../lib/constants";

type Props = {
  name?: string;
  email?: string;
  phone?: string;
  className?: string;
};

/**
 * Branded Calendly shell — dark/gold chrome + Calendly embed color params
 * so the picker reads as part of the MRG site, not a stock white widget.
 */
export function CalendlyEmbed({ name, email, phone, className = "" }: Props) {
  const src = useMemo(() => {
    const url = buildCalendlyEmbedUrl({ name, email, phone });
    return url || CALENDLY_URL;
  }, [name, email, phone]);

  if (!src) return null;

  return (
    <div
      className={`overflow-hidden rounded-2xl bg-mrg-bg ring-1 ring-white/10 ${className}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/8 bg-mrg-surface px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <img src="/mrg-logo-white.png" alt="" aria-hidden className="h-5 w-auto opacity-90" />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-mrg-gold">
              Mandel Realty Group
            </p>
            <p className="truncate text-sm text-mrg-text">15-minute call</p>
          </div>
        </div>
        <p className="shrink-0 text-[11px] text-mrg-muted">Pick a time</p>
      </div>

      <div className="relative bg-[#0a0a0a]">
        {/* Soft brand wash behind the iframe */}
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_40%_at_50%_0%,rgba(245,197,24,0.08),transparent)]"
          aria-hidden
        />
        <iframe
          title="Book a call with Mandel Realty Group"
          src={src}
          className="relative z-[1] block h-[620px] w-full border-0 sm:h-[640px]"
          loading="lazy"
        />
      </div>

      <div className="border-t border-white/8 bg-mrg-surface px-4 py-2.5 text-center text-[11px] text-mrg-muted">
        Times shown in your local timezone · 24-hour notice required
      </div>
    </div>
  );
}
