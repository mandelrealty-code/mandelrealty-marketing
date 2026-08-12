import type { ReactNode } from "react";
import { hstSummaryLabel, type HstMode } from "./HstSetupForm";
import { rateLabel, takeRateLabel } from "./api";
import { FieldLabel, SegmentedControl } from "./ui";

export type CommissionBaseMode = "nightly" | "nightly_minus_host_fee";
export type CleaningKeeper = "mrg" | "host";

export type BillingTermsValue = {
  commissionPercent: string;
  baseMode: CommissionBaseMode;
  cleaningKeeper: CleaningKeeper;
  hstMode: HstMode;
  hstPercent: string;
};

export function defaultBillingTerms(input?: {
  commissionPercent?: number;
  hstPercent?: number;
  hstMode?: HstMode;
}): BillingTermsValue {
  const hstMode = input?.hstMode === "invoice" ? "invoice" : "cohost";
  return {
    commissionPercent: String(input?.commissionPercent ?? 20),
    baseMode: hstMode === "invoice" ? "nightly" : "nightly_minus_host_fee",
    cleaningKeeper: "mrg",
    hstMode,
    hstPercent: String(
      input?.hstPercent ?? (hstMode === "invoice" ? 13 : 3),
    ),
  };
}

/** One-line deal for earnings / month close / property list. */
export function dealSummaryLabel(input: {
  commissionBps: number | null | undefined;
  baseMode?: CommissionBaseMode | string | null;
  cleaningKeeper?: CleaningKeeper | string | null;
  hstMode?: HstMode | string | null;
  hstBps?: number | null;
}): string {
  const baseMode =
    input.baseMode === "nightly" ? "nightly" : "nightly_minus_host_fee";
  const cleaning =
    input.cleaningKeeper === "host" ? "host" : "mrg";
  const hstMode = input.hstMode === "invoice" ? "invoice" : "cohost";
  const hstBps = Number.isFinite(input.hstBps) ? Number(input.hstBps) : 300;
  const commission = Number.isFinite(input.commissionBps)
    ? Number(input.commissionBps)
    : null;

  const parts: string[] = [
    baseMode === "nightly" ? "Nightly" : "Nightly − fee",
  ];

  if (hstMode === "invoice") {
    parts.push(rateLabel(commission));
    parts.push(`HST invoice ${rateLabel(hstBps)}`);
  } else {
    parts.push(`${takeRateLabel(commission, "cohost", hstBps)} take`);
  }

  parts.push(cleaning === "host" ? "Host cleaning" : "MRG cleaning");
  return parts.join(" · ");
}

export function BillingTermsForm({
  value,
  onChange,
  subtitle,
  smartDefaults = false,
  commissionLocked = false,
  onChangeCommission,
  compact = false,
  footer,
}: {
  value: BillingTermsValue;
  onChange: (next: BillingTermsValue) => void;
  subtitle?: string;
  /** When HST mode flips, suggest fee base + HST % defaults. */
  smartDefaults?: boolean;
  /** Property detail: commission is versioned via Change rate. */
  commissionLocked?: boolean;
  onChangeCommission?: () => void;
  compact?: boolean;
  footer?: ReactNode;
}) {
  const patch = (partial: Partial<BillingTermsValue>) =>
    onChange({ ...value, ...partial });

  const setHstMode = (next: HstMode) => {
    const n = Number(value.hstPercent);
    let hstPercent = value.hstPercent;
    let baseMode = value.baseMode;
    if (smartDefaults) {
      if (next === "invoice") {
        if (!Number.isFinite(n) || n === 3 || n === 0) hstPercent = "13";
        baseMode = "nightly";
      } else {
        if (!Number.isFinite(n) || n === 13) hstPercent = "3";
        baseMode = "nightly_minus_host_fee";
      }
    } else if (next === "invoice" && (!Number.isFinite(n) || n === 3 || n === 0)) {
      hstPercent = "13";
    } else if (next === "cohost" && (!Number.isFinite(n) || n === 13)) {
      hstPercent = "3";
    }
    patch({ hstMode: next, hstPercent, baseMode });
  };

  const commissionBps = Math.round(Number(value.commissionPercent) * 100);
  const hstBps = Math.round(Number(value.hstPercent) * 100);
  const preview = dealSummaryLabel({
    commissionBps: Number.isFinite(commissionBps) ? commissionBps : null,
    baseMode: value.baseMode,
    cleaningKeeper: value.cleaningKeeper,
    hstMode: value.hstMode,
    hstBps: Number.isFinite(hstBps) ? hstBps : 300,
  });

  return (
    <div className={`flex flex-col ${compact ? "gap-3.5" : "gap-4"}`}>
      {!compact ? (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-xl font-bold tracking-tight text-[#f5f5f5] text-pretty">
            How we bill this unit
          </h3>
          {subtitle ? (
            <p className="text-[13px] text-[#6f6a65]">{subtitle}</p>
          ) : (
            <p className="text-[13px] text-[#6f6a65] text-pretty">
              Each property can be different — set the deal once; earnings and
              month close follow it.
            </p>
          )}
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <FieldLabel>Commission</FieldLabel>
        {commissionLocked ? (
          <div className="flex items-center justify-between gap-3 rounded-[9px] border border-white/10 bg-[#1c1c1c] px-3.5 py-3">
            <span className="text-[17px] font-bold tabular-nums text-[#f5f5f5]">
              {rateLabel(Number.isFinite(commissionBps) ? commissionBps : null)}
            </span>
            {onChangeCommission ? (
              <button
                type="button"
                onClick={onChangeCommission}
                className="text-[13px] font-semibold text-[#c4a35a]"
              >
                Change
              </button>
            ) : null}
          </div>
        ) : (
          <div className="relative">
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={value.commissionPercent}
              onChange={(e) => patch({ commissionPercent: e.target.value })}
              className="w-full rounded-[9px] border border-[#c4a35a]/55 bg-[#1c1c1c] px-3.5 py-3 text-xl font-bold text-[#f5f5f5] outline-none"
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[15px] text-[#9a9590]">
              %
            </span>
          </div>
        )}
        <p className="text-[13px] text-[#6f6a65]">
          Management fee on the fee base below.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel>Fee base</FieldLabel>
        <SegmentedControl<"nightly" | "nightly_minus_host_fee">
          value={value.baseMode}
          onChange={(baseMode) => patch({ baseMode })}
          options={[
            { value: "nightly", label: "Nightly" },
            { value: "nightly_minus_host_fee", label: "Nightly − fee" },
          ]}
        />
        <p className="text-[13px] text-[#6f6a65] text-pretty">
          {value.baseMode === "nightly"
            ? "Room fee × commission % — host service fee not deducted (bill monthly)."
            : "Room fee minus Airbnb host fee (3% or 15%), then × commission %."}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel>Cleaning fee</FieldLabel>
        <SegmentedControl<"mrg" | "host">
          value={value.cleaningKeeper}
          onChange={(cleaningKeeper) => patch({ cleaningKeeper })}
          options={[
            { value: "mrg", label: "MRG keeps" },
            { value: "host", label: "Host keeps" },
          ]}
        />
        <p className="text-[13px] text-[#6f6a65] text-pretty">
          {value.cleaningKeeper === "host"
            ? "Cleaning stays with the host; they pay cleaners."
            : "Cleaning stays with MRG; we pay cleaners."}
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        <FieldLabel>HST</FieldLabel>
        <button
          type="button"
          onClick={() => setHstMode("cohost")}
          className={`flex gap-3 rounded-[11px] border p-3.5 text-left ${
            value.hstMode === "cohost"
              ? "border-[#c4a35a] bg-[#1c1c1c]"
              : "border-white/10 bg-[#1c1c1c]"
          }`}
        >
          <span
            className={`mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2 ${
              value.hstMode === "cohost" ? "border-[#c4a35a]" : "border-[#3a3a3a]"
            }`}
          >
            {value.hstMode === "cohost" ? (
              <span className="h-2 w-2 rounded-full bg-[#c4a35a]" />
            ) : null}
          </span>
          <span className="flex min-w-0 flex-col gap-1">
            <span
              className={`text-[15px] font-semibold ${
                value.hstMode === "cohost" ? "text-[#f5f5f5]" : "text-[#9a9590]"
              }`}
            >
              Built into cohost take
            </span>
            <span className="text-[13px] text-[#6f6a65] text-pretty">
              Added on top of commission each stay (e.g. 20% + 3% = 23%).
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setHstMode("invoice")}
          className={`flex gap-3 rounded-[11px] border p-3.5 text-left ${
            value.hstMode === "invoice"
              ? "border-[#c4a35a] bg-[#1c1c1c]"
              : "border-white/10 bg-[#1c1c1c]"
          }`}
        >
          <span
            className={`mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2 ${
              value.hstMode === "invoice" ? "border-[#c4a35a]" : "border-[#3a3a3a]"
            }`}
          >
            {value.hstMode === "invoice" ? (
              <span className="h-2 w-2 rounded-full bg-[#c4a35a]" />
            ) : null}
          </span>
          <span className="flex min-w-0 flex-col gap-1">
            <span
              className={`text-[15px] font-semibold ${
                value.hstMode === "invoice" ? "text-[#f5f5f5]" : "text-[#9a9590]"
              }`}
            >
              Bill monthly (QuickBooks)
            </span>
            <span className="text-[13px] text-[#6f6a65] text-pretty">
              HST on the MRG fee only — not on booking revenue.
            </span>
          </span>
        </button>
        <div className="relative">
          <input
            type="number"
            min={0}
            max={20}
            step={0.5}
            value={value.hstPercent}
            onChange={(e) => patch({ hstPercent: e.target.value })}
            className="w-full rounded-[9px] border border-[#c4a35a]/55 bg-[#1c1c1c] px-3.5 py-3 text-xl font-bold text-[#f5f5f5] outline-none"
          />
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[15px] text-[#9a9590]">
            %
          </span>
        </div>
        <p className="text-[13px] text-[#6f6a65]">
          {hstSummaryLabel(
            value.hstMode,
            Number.isFinite(hstBps) ? hstBps : 300,
            Number.isFinite(commissionBps) ? commissionBps : null,
          )}
        </p>
      </div>

      <div className="rounded-[11px] border border-white/10 bg-[#141414] px-3.5 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6f6a65]">
          Deal preview
        </p>
        <p className="mt-1 text-[14px] font-semibold text-[#dcc084] text-pretty">
          {preview}
        </p>
      </div>
      {footer}
    </div>
  );
}
