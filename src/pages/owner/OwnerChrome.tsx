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
