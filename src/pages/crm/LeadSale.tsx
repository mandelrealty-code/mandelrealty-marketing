import { useEffect, useState } from "react";

/**
 * The sale and onboarding details on a CRM lead: plan, who booked and closed it, the contract, and where the lead is in
 * onboarding. Matches the dark CRM detail panel it sits in. Nothing here sends anything.
 */

export type LeadOnboarding = { unitId: string; address: string; stage: string; step: number; total: number; live: boolean } | null;

export type SaleLead = {
  id: string;
  status: string;
  plan?: string;
  booked_by?: string;
  closed_by?: string;
  contract_status?: "" | "signed" | "sent" | "not_sent" | "cancelled";
  referred_by?: string;
  source?: string;
  onboarding?: LeadOnboarding;
};

export const PLAN_OPTIONS = ["Standard", "Full Service", "Growth", "Essentials"];
export const CONTRACT_OPTIONS: { value: "" | "signed" | "sent" | "not_sent" | "cancelled"; label: string }[] = [
  { value: "", label: "Not recorded" },
  { value: "signed", label: "Signed" },
  { value: "sent", label: "Sent, awaiting signature" },
  { value: "not_sent", label: "Not sent" },
  { value: "cancelled", label: "Cancelled" },
];

const LABEL = "text-[10.5px] font-medium uppercase tracking-[0.1em] text-[#7d7873]";
const INPUT = "h-9 w-full min-w-0 rounded-lg border border-white/10 bg-[#121212] px-2.5 text-[13px] text-[#e6e2dc] outline-none focus:border-[#c4a35a]/40";

export function onboardingLine(o: LeadOnboarding): string {
  if (!o) return "";
  return o.live ? "Live" : `${o.stage}, step ${o.step} of ${o.total}`;
}

export function LeadSaleBlock({ lead, saving, onPatch, onStart, onOpenUnit, compact = false }: {
  lead: SaleLead;
  saving: boolean;
  onPatch: (body: Record<string, unknown>) => Promise<unknown> | void;
  onStart: (lead: SaleLead) => void;
  onOpenUnit: (unitId: string) => void;
  compact?: boolean;
}) {
  const [booked, setBooked] = useState(lead.booked_by || "");
  const [closed, setClosed] = useState(lead.closed_by || "");
  useEffect(() => { setBooked(lead.booked_by || ""); setClosed(lead.closed_by || ""); }, [lead.id, lead.booked_by, lead.closed_by]);
  const canStart = lead.status === "won" && !lead.onboarding;
  const gap = <span className="text-[12px] font-semibold text-[#d9ac63]">Not recorded</span>;
  const wrap = compact
    ? "mb-5 flex flex-col gap-3 rounded-[14px] border border-white/8 bg-[#1a1a1a] px-3.5 py-3.5"
    : "flex flex-col gap-3 border-b border-white/8 px-5 py-4";
  return (
    <div className={wrap}>
      <p className={compact ? LABEL : "text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7d7873]"}>Sale and onboarding</p>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Plan</span>
          <select value={lead.plan || ""} disabled={saving} onChange={(e) => void onPatch({ plan: e.target.value })} className={INPUT}>
            <option value="">Not recorded</option>
            {PLAN_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Contract</span>
          <select value={lead.contract_status || ""} disabled={saving} onChange={(e) => void onPatch({ contractStatus: e.target.value })} className={INPUT}>
            {CONTRACT_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Booked by</span>
          <input value={booked} disabled={saving} placeholder="Who booked the call" onChange={(e) => setBooked(e.target.value)} onBlur={() => { if (booked.trim() !== (lead.booked_by || "")) void onPatch({ bookedBy: booked.trim() }); }} className={INPUT} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Closed by</span>
          <input value={closed} disabled={saving} placeholder="Who closed the sale" onChange={(e) => setClosed(e.target.value)} onBlur={() => { if (closed.trim() !== (lead.closed_by || "")) void onPatch({ closedBy: closed.trim() }); }} className={INPUT} />
        </label>
      </div>
      {lead.source === "Referral" ? (
        <p className="text-[12px] text-[#9a9590]">Referred by <span className="text-[#e6e2dc]">{lead.referred_by || "not recorded"}</span></p>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={LABEL}>Onboarding</p>
          {lead.onboarding ? (
            <button type="button" onClick={() => onOpenUnit(lead.onboarding!.unitId)} className="mt-1 text-left text-[13px] font-semibold text-[#8fd0b9] hover:underline">
              {onboardingLine(lead.onboarding)} · {lead.onboarding.address} →
            </button>
          ) : (
            <p className="mt-1 text-[13px] text-[#9a9590]">{lead.status === "won" ? "Not started" : "Starts once the lead is Won"}</p>
          )}
        </div>
        {canStart ? (
          <button type="button" onClick={() => onStart(lead)} className="h-9 shrink-0 rounded-lg bg-[#c4a35a] px-3.5 text-[13px] font-bold text-[#0a0a0a] hover:bg-[#dcc084]">
            Start onboarding
          </button>
        ) : null}
      </div>
      {!lead.plan || !lead.contract_status ? (
        <p className="text-[12px] text-[#9a9590]">{gap} fields are flagged again when onboarding starts, so nothing is left blank by accident.</p>
      ) : null}
    </div>
  );
}
