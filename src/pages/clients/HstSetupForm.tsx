import { FieldLabel } from "./ui";

export type HstMode = "cohost" | "invoice";

export function hstSummaryLabel(
  mode: HstMode,
  bps: number,
  commissionBps?: number | null,
): string {
  const pct = bps / 100;
  const pctLabel = Number.isInteger(pct) ? `${pct}%` : `${pct}%`;
  if (mode === "invoice") {
    return `Monthly invoice · ${pctLabel} HST on MRG fee`;
  }
  const commission =
    commissionBps != null && Number.isFinite(commissionBps)
      ? commissionBps
      : null;
  if (commission != null) {
    const total = (commission + bps) / 100;
    const totalLabel = Number.isInteger(total) ? `${total}%` : `${total}%`;
    const mgmt = commission / 100;
    const mgmtLabel = Number.isInteger(mgmt) ? `${mgmt}%` : `${mgmt}%`;
    return `Adds ${pctLabel} on each stay · total take ${totalLabel} (${mgmtLabel} + ${pctLabel} HST)`;
  }
  return `Adds ${pctLabel} HST on each stay (on top of commission)`;
}

export function HstSetupForm({
  mode,
  ratePercent,
  onModeChange,
  onRateChange,
  subtitle,
}: {
  mode: HstMode;
  ratePercent: string;
  onModeChange: (mode: HstMode) => void;
  onRateChange: (value: string) => void;
  subtitle?: string;
}) {
  const setMode = (next: HstMode) => {
    onModeChange(next);
    // Suggest defaults when switching (only if empty or previous default)
    const n = Number(ratePercent);
    if (next === "invoice" && (!Number.isFinite(n) || n === 3 || n === 0)) {
      onRateChange("13");
    } else if (next === "cohost" && (!Number.isFinite(n) || n === 13)) {
      onRateChange("3");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h3 className="text-xl font-bold tracking-tight text-[#f5f5f5] text-pretty">
          How do you collect HST for this unit?
        </h3>
        {subtitle ? <p className="text-[13px] text-[#6f6a65]">{subtitle}</p> : null}
      </div>

      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          onClick={() => setMode("cohost")}
          className={`flex gap-3 rounded-[11px] border p-3.5 text-left ${
            mode === "cohost"
              ? "border-[#c4a35a] bg-[#1c1c1c]"
              : "border-white/10 bg-[#1c1c1c]"
          }`}
        >
          <span
            className={`mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2 ${
              mode === "cohost" ? "border-[#c4a35a]" : "border-[#3a3a3a]"
            }`}
          >
            {mode === "cohost" ? (
              <span className="h-2 w-2 rounded-full bg-[#c4a35a]" />
            ) : null}
          </span>
          <span className="flex min-w-0 flex-col gap-1">
            <span
              className={`text-[15px] font-semibold ${
                mode === "cohost" ? "text-[#f5f5f5]" : "text-[#9a9590]"
              }`}
            >
              Built into cohost payouts
            </span>
            <span
              className={`text-[13px] text-pretty ${
                mode === "cohost" ? "text-[#9a9590]" : "text-[#6f6a65]"
              }`}
            >
              Added on top of commission on each stay (e.g. 20% + 3% = 23% total
              take on base).
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMode("invoice")}
          className={`flex gap-3 rounded-[11px] border p-3.5 text-left ${
            mode === "invoice"
              ? "border-[#c4a35a] bg-[#1c1c1c]"
              : "border-white/10 bg-[#1c1c1c]"
          }`}
        >
          <span
            className={`mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2 ${
              mode === "invoice" ? "border-[#c4a35a]" : "border-[#3a3a3a]"
            }`}
          >
            {mode === "invoice" ? (
              <span className="h-2 w-2 rounded-full bg-[#c4a35a]" />
            ) : null}
          </span>
          <span className="flex min-w-0 flex-col gap-1">
            <span
              className={`text-[15px] font-semibold ${
                mode === "invoice" ? "text-[#f5f5f5]" : "text-[#9a9590]"
              }`}
            >
              Bill monthly (QuickBooks)
            </span>
            <span
              className={`text-[13px] text-pretty ${
                mode === "invoice" ? "text-[#9a9590]" : "text-[#6f6a65]"
              }`}
            >
              Invoice HST at month end on your management fee (e.g. 13% of the
              20% MRG fee) — not on booking revenue.
            </span>
          </span>
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel>HST rate</FieldLabel>
        <div className="relative">
          <input
            type="number"
            min={0}
            max={20}
            step={0.5}
            value={ratePercent}
            onChange={(e) => onRateChange(e.target.value)}
            className="w-full rounded-[9px] border border-[#c4a35a]/55 bg-[#1c1c1c] px-3.5 py-3 text-xl font-bold text-[#f5f5f5] outline-none"
          />
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[15px] text-[#9a9590]">
            %
          </span>
        </div>
        <p className="text-[13px] text-[#6f6a65]">
          {mode === "invoice"
            ? "Suggested. Invoiced at month end on the MRG management fee."
            : "Taken with the management fee on each stay."}
        </p>
      </div>
    </div>
  );
}
