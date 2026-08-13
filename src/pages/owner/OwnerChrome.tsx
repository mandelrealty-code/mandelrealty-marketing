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
