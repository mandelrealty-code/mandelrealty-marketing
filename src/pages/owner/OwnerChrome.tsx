const OCCUPANCY = [
  1, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 0, 0, 1, 1,
  1, 1, 1, 1, 1, 0, 1, 1,
];

/** Generic STR / earnings art — never a unit photo. */
export function PortalHeroPlaceholder({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className="relative h-full min-h-full w-full overflow-hidden bg-[#14110c]"
      aria-hidden
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_28%_38%,rgba(196,163,90,0.22),transparent_58%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_92%_88%,rgba(196,163,90,0.1),transparent_42%)]" />
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(#c4a35a 1px, transparent 1px), linear-gradient(90deg, #c4a35a 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      {compact ? (
        <div className="absolute right-6 top-1/2 w-[min(420px,58%)] -translate-y-1/2 opacity-80 lg:right-12">
          <div className="grid grid-cols-7 gap-1.5">
            {OCCUPANCY.map((on, i) => (
              <div
                key={i}
                className={`h-5 rounded-[2px] lg:h-7 ${
                  on ? "bg-[#c4a35a]" : "bg-white/[0.08]"
                }`}
              />
            ))}
          </div>
        </div>
      ) : (
      <div className="relative flex h-full flex-col justify-end gap-6 p-6 lg:justify-center lg:gap-10 lg:p-12">
        <p className="hidden text-[11px] font-semibold uppercase tracking-[0.22em] text-[#c4a35a]/75 lg:block">
          Airbnb · short-term rentals
        </p>

        <div className="max-w-[380px]">
          <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6f6a65]">
            Occupancy
          </p>
          <div className="grid grid-cols-7 gap-1.5">
            {OCCUPANCY.map((on, i) => (
              <div
                key={i}
                className={`h-6 rounded-[2px] lg:h-8 ${
                  on ? "bg-[#c4a35a]" : "bg-white/[0.07]"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="hidden max-w-[380px] border border-white/10 bg-[#0a0a0a]/60 px-5 py-4 backdrop-blur-[2px] lg:block">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6f6a65]">
              Host payout
            </span>
            <span className="text-[12px] font-semibold text-[#4ea882]">↑ earnings</span>
          </div>
          <svg
            viewBox="0 0 240 56"
            className="mt-3 h-12 w-full"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="mrg-hero-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#c4a35a" />
                <stop offset="1" stopColor="#c4a35a" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0 56 L0 48 C30 46 50 40 70 36 S110 38 130 22 S180 18 210 10 L240 6 V56 Z"
              fill="url(#mrg-hero-fill)"
              opacity="0.28"
            />
            <path
              d="M0 48 C30 46 50 40 70 36 S110 38 130 22 S180 18 210 10 L240 6"
              fill="none"
              stroke="#c4a35a"
              strokeWidth="2"
            />
          </svg>
          <p className="mt-1 text-[13px] leading-snug text-[#9a9590]">
            Nights, occupancy, and payouts — once your listing is live
          </p>
        </div>

        <div className="lg:hidden">
          <p className="text-[13px] font-semibold tracking-tight text-[#e8e0d2]">
            Airbnb & short-term rentals
          </p>
          <p className="mt-0.5 text-[12px] text-[#9a9590]">Host earnings in one place</p>
        </div>
      </div>
      )}
    </div>
  );
}

export function PreviewBanner() {
  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-[#c4a35a] px-4 py-2.5 text-[13px] font-semibold text-[#0a0a0a]">
      <span>Preview — this is what the host sees. They never see this bar.</span>
      <button
        type="button"
        onClick={() => window.close()}
        className="shrink-0 underline decoration-[#0a0a0a]/40 underline-offset-2"
      >
        Close
      </button>
    </div>
  );
}

export function MrgMark() {
  return (
    <div className="flex items-center gap-2.5">
      <img
        src="/mrg-logo.png"
        alt="Mandel Realty Group"
        className="h-8 w-8 rounded-[3px] object-contain"
      />
      <div className="text-[15px] font-bold tracking-[0.18em] text-[#c4a35a]">MRG</div>
    </div>
  );
}

export function moneyCad(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-CA")}`;
}
