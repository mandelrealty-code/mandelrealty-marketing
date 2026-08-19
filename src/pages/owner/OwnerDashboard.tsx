import type {
  OwnerDashboardPayload,
  OwnerSetupStep,
  OwnerSparkPoint,
} from "../../../shared/pm/ownerDashboardTypes";
import { AskMrgPanel } from "./AskMrgPanel";
import { moneyCad, MrgMark, PortalHeroPlaceholder, PreviewBanner } from "./OwnerChrome";

function stayRange(checkIn: string, checkOut: string): string {
  const fmt = (iso: string) => {
    if (!iso) return "—";
    const d = new Date(`${iso}T12:00:00Z`);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  };
  return `${fmt(checkIn)} → ${fmt(checkOut)}`;
}

function Sparkline({ points }: { points: OwnerSparkPoint[] }) {
  const vals = points.map((p) => p.net_to_host_cents);
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals, 0);
  const span = Math.max(max - min, 1);
  const w = 320;
  const h = 56;
  const coords = points.map((p, i) => {
    const x = points.length === 1 ? w : (i / (points.length - 1)) * w;
    const y = h - 8 - ((p.net_to_host_cents - min) / span) * (h - 16);
    return `${x},${y}`;
  });
  const last = coords[coords.length - 1]?.split(",") ?? ["320", "10"];
  return (
    <div className="flex flex-1 flex-col gap-2.5 pb-1.5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6f6a65]">
        Net · last 6 months
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-14 w-full overflow-visible">
        <polyline
          points={coords.join(" ")}
          fill="none"
          stroke="#c4a35a"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={last[0]} cy={last[1]} r="3" fill="#dcc084" />
      </svg>
      <div className="flex justify-between text-[11px] tracking-[0.1em] text-[#4a4744]">
        {points.map((p) => (
          <span key={p.year_month}>{p.label}</span>
        ))}
      </div>
    </div>
  );
}

function SetupList({ steps }: { steps: OwnerSetupStep[] }) {
  return (
    <div className="flex flex-col">
      {steps.map((step) => {
        const done = step.state === "done";
        const active = step.state === "in_progress";
        return (
          <div
            key={step.id}
            className="flex items-center gap-3.5 border-b border-white/8 py-3.5 text-[15px]"
          >
            <span
              className={`flex h-4 w-4 flex-none items-center justify-center border ${
                done || active ? "border-[#4ea882]" : "border-white/20"
              }`}
            >
              {done || active ? <span className="block h-1.5 w-1.5 bg-[#4ea882]" /> : null}
            </span>
            <span className={`flex-1 ${done || active ? "text-[#f5f5f5]" : "text-[#9a9590]"}`}>
              {step.label}
            </span>
            {step.status_label ? (
              <span
                className={`text-[12.5px] ${
                  done || active ? "text-[#4ea882]" : "text-[#6f6a65]"
                }`}
              >
                {step.status_label}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function OwnerDashboard({
  firstName,
  clientName,
  propertyLabel,
  cover,
  signedOn,
  portalSigned,
  dashboard,
  awaiting,
  preview,
  onDocuments,
  onSign,
}: {
  firstName: string;
  clientName?: string;
  propertyLabel: string;
  cover: string | null | undefined;
  signedOn?: string | null;
  /** Host signed the agreement in-portal (New — sign contract), not an uploaded existing copy. */
  portalSigned?: boolean;
  dashboard: OwnerDashboardPayload | null;
  awaiting: boolean;
  preview?: boolean;
  onDocuments: () => void;
  onSign: () => void;
}) {
  const earnings = dashboard?.earnings ?? null;
  const listingReady = Boolean(
    dashboard?.linked && dashboard?.synced && dashboard?.kb_ready,
  );
  const showAllSetHold = Boolean(portalSigned) && !listingReady;
  const live = Boolean(dashboard?.linked && earnings) && !showAllSetHold;
  const setup = dashboard?.setup ?? [];
  const showAskMrg = live;

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a0a] text-[#f5f5f5]">
      {preview ? <PreviewBanner /> : null}
      <div className="flex min-h-0 min-w-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-white/9 bg-[#0c0c0c] px-5 py-4 lg:px-9">
        <div className="flex items-center gap-8">
          <MrgMark />
          <nav className="hidden gap-7 text-sm lg:flex">
            <span className="border-b border-[#c4a35a] pb-0.5 font-semibold">Overview</span>
            <button type="button" className="text-[#9a9590]" onClick={onDocuments}>
              Documents
            </button>
          </nav>
        </div>
        <nav className="flex gap-5 text-sm lg:hidden">
          <span className="border-b border-[#c4a35a] pb-0.5 font-semibold">Home</span>
          <button type="button" className="text-[#9a9590]" onClick={onDocuments}>
            Documents
          </button>
        </nav>
        <span className="text-sm text-[#9a9590]">{clientName}</span>
      </header>

      <div className="relative h-[180px] w-full overflow-hidden lg:h-[248px]">
        {cover ? (
          <img src={cover} alt="" className="h-full w-full object-cover" />
        ) : (
          <PortalHeroPlaceholder compact />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0a0a0a]/90 via-[#0a0a0a]/55 to-transparent lg:via-[#0a0a0a]/70" />
        <div className="absolute bottom-6 left-5 hidden flex-col gap-1.5 lg:left-9 lg:flex">
          <div className="text-[28px] font-semibold tracking-tight lg:text-[34px]">
            {propertyLabel}
          </div>
          <div className="text-[13px] text-[#cfc9c2]">
            {clientName ? `${clientName} · ` : null}
            <span className="text-[#c4a35a]">Managed by Mandel Realty</span>
          </div>
        </div>
      </div>

      {live && earnings ? (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-8 pb-28 lg:px-9 lg:py-8 lg:pb-8">
          <div className="flex items-baseline justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6f6a65]">
              This month
            </div>
            <div className="text-[13px] text-[#9a9590]">{earnings.month_title}</div>
          </div>

          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:gap-11">
            <div className="flex flex-col gap-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6f6a65]">
                Net to host
              </div>
              <div className="text-[52px] font-semibold leading-none tracking-tight tabular-nums lg:text-[62px]">
                {moneyCad(earnings.net_to_host_cents)}
              </div>
              {earnings.mom_bps != null ? (
                <div
                  className={`text-[13px] font-semibold tabular-nums ${
                    earnings.mom_bps >= 0 ? "text-[#4ea882]" : "text-[#cf7f7b]"
                  }`}
                >
                  {earnings.mom_bps >= 0 ? "↑" : "↓"}{" "}
                  {Math.abs(earnings.mom_bps / 100).toFixed(1)}% vs last month
                </div>
              ) : (
                <div className="text-[13px] text-[#9a9590]">
                  {earnings.reservation_count} booking
                  {earnings.reservation_count === 1 ? "" : "s"} this month
                </div>
              )}
            </div>
            {earnings.sparkline.length ? <Sparkline points={earnings.sparkline} /> : null}
          </div>

          <div className="grid grid-cols-2 gap-px bg-white/9 lg:grid-cols-4">
            {[
              {
                label: "Bookings",
                value: String(earnings.reservation_count),
                hint: `${earnings.nights_booked} night${earnings.nights_booked === 1 ? "" : "s"}`,
              },
              {
                label: "Occupancy",
                value: `${Math.round(earnings.occupancy_bps / 100)}%`,
                hint: "of available nights",
              },
              {
                label: `Projected ${earnings.projected_year}`,
                value: earnings.projected_year_cents != null
                  ? moneyCad(earnings.projected_year_cents)
                  : "—",
                hint: "net, full year",
              },
              {
                label: "Next payout",
                value: earnings.next_payout?.label ?? "—",
                hint: earnings.next_payout ? "EFT · direct deposit" : "after month close",
              },
            ].map((tile) => (
              <div key={tile.label} className="bg-[#0a0a0a] px-5 py-5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6f6a65]">
                  {tile.label}
                </div>
                <div className="mt-1.5 text-[26px] font-semibold tabular-nums">{tile.value}</div>
                <div className="mt-1 text-[12px] text-[#9a9590]">{tile.hint}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-11 lg:grid-cols-[1.5fr_1fr]">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6f6a65]">
                Upcoming stays
              </div>
              <div className="mt-4 flex flex-col">
                {earnings.upcoming.map((stay) => (
                  <div
                    key={`${stay.check_in}-${stay.check_out}`}
                    className="flex items-baseline justify-between border-b border-white/8 py-3.5"
                  >
                    <div>
                      <div className="text-[15px] font-medium">
                        {stayRange(stay.check_in, stay.check_out)}
                      </div>
                      <div className="mt-1 text-[12px] text-[#6f6a65]">
                        {stay.nights} night{stay.nights === 1 ? "" : "s"}
                        {stay.channel ? ` · ${stay.channel}` : ""}
                      </div>
                    </div>
                    {stay.amount_cents > 0 ? (
                      <div className="text-[15px] font-semibold tabular-nums">
                        {moneyCad(stay.amount_cents)}
                      </div>
                    ) : null}
                  </div>
                ))}
                {!earnings.upcoming.length ? (
                  <p className="py-4 text-sm text-[#9a9590]">No upcoming stays on the books yet.</p>
                ) : null}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6f6a65]">
                Statement
              </div>
              {earnings.prior_month ? (
                <div className="mt-4 border-l border-[#c4a35a] py-1 pl-4">
                  <div className="text-[16px] font-medium">
                    {earnings.prior_month.month_title.replace(/ \d{4}$/, "")} statement ready
                  </div>
                  <div className="mt-1 text-[13px] text-[#9a9590]">
                    {moneyCad(earnings.prior_month.net_to_host_cents)} net · in Documents
                  </div>
                  <button
                    type="button"
                    className="mt-3 text-[14px] font-semibold text-[#c4a35a]"
                    onClick={onDocuments}
                  >
                    View documents →
                  </button>
                </div>
              ) : (
                <p className="mt-4 text-sm text-[#9a9590]">
                  Monthly statements appear in Documents after month close.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div
          className={`mx-auto grid w-full max-w-6xl gap-12 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:px-9 lg:py-10 ${
            showAskMrg ? "pb-28 lg:pb-10" : "pb-10"
          }`}
        >
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#4ea882]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#4ea882]">
                {signedOn
                  ? `Agreement signed · ${signedOn}`
                  : awaiting
                    ? "Agreement ready to sign"
                    : "Portal ready"}
              </span>
            </div>
            <h1 className="text-[30px] font-semibold leading-tight tracking-tight lg:text-[42px]">
              {showAllSetHold ? "You’re all set!" : `You’re in, ${firstName}`}
            </h1>
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#6f6a65]">
              {propertyLabel}
            </p>
            <p className="max-w-[46ch] text-[15px] leading-relaxed text-[#9a9590] lg:text-base">
              {showAllSetHold
                ? "MRG is currently getting your property ready. You’ll be notified when your portal is ready."
                : "Our team is finishing setup — full earnings appear here once your listing is connected."}
            </p>
            {awaiting && !showAllSetHold ? (
              <button
                type="button"
                className="self-start text-[15px] font-semibold text-[#c4a35a]"
                onClick={onSign}
              >
                Sign your agreement →
              </button>
            ) : (
              <button
                type="button"
                className="self-start text-[15px] font-semibold text-[#c4a35a]"
                onClick={onDocuments}
              >
                View signed agreement →
              </button>
            )}
          </div>
          <div className="flex flex-col gap-4 lg:pt-8">
            <div className="flex items-center gap-3.5">
              <div className="text-[15px] font-semibold text-[#dcc084]">Setting up your listing</div>
              <div className="h-px flex-1 bg-white/10" />
            </div>
            <SetupList steps={setup.length ? setup : [
              { id: "airbnb", label: "Connect Airbnb", state: "in_progress", status_label: "In progress" },
              { id: "calendar", label: "Link your calendar", state: "next", status_label: "Next" },
              { id: "earnings", label: "Earnings unlock when live", state: "pending", status_label: "" },
            ]} />
            <p className="text-[13px] leading-relaxed text-[#6f6a65]">
              {showAllSetHold
                ? "We’ll email you as soon as everything is live."
                : "You’ll get an email the day your listing goes live."}
            </p>
          </div>
        </div>
      )}
      </div>
      {showAskMrg ? (
        <AskMrgPanel propertyLabel={propertyLabel} dashboard={dashboard} preview={preview} />
      ) : null}
      </div>
    </div>
  );
}
