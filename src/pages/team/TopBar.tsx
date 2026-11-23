import type { StaffType } from "../../../shared/pm/teamStore";
import type { ClockTimer } from "./useClockTimer";

function roleLabel(staffType: StaffType | string): string {
  if (staffType === "va") return "Back Office";
  if (staffType === "onboarder") return "Onboarder";
  if (staffType === "booker") return "Booker";
  if (staffType === "operations") return "Operations";
  return staffType || "Team";
}

function MrgPortalLogo() {
  return (
    <svg
      width={28}
      height={28}
      viewBox="162 162 700 700"
      aria-label="MRG"
      role="img"
    >
      <rect x="162" y="162" width="700" height="700" fill="#fff" />
      <rect
        x="182"
        y="182"
        width="660"
        height="660"
        fill="none"
        stroke="#1a1a1a"
        strokeWidth="40"
      />
      <path
        fill="#1a1a1a"
        d="M307 325L600 568V712H558V585L347 415V712H307Z M423 535L464 568V712H423Z M717 300V712H676V395L566 490L535 463Z"
      />
    </svg>
  );
}

type Props = {
  name: string;
  staffType: StaffType | string;
  clockTimer: ClockTimer;
  /** VA only — opens Ask Shane flow */
  onAskShane?: () => void;
};

export function TopBar({ name, staffType, clockTimer, onAskShane }: Props) {
  const { isClockedIn, isPaused, elapsedLabel, clockIn, clockOut } = clockTimer;
  const showAsk = staffType === "va" && onAskShane;

  const sbarClass = !isClockedIn
    ? "out"
    : isPaused
      ? "paused"
      : "in";

  return (
    <header id="top" className="mrg-portal-top">
      <div className="tb">
        <MrgPortalLogo />
        {showAsk ? (
          <div className="nmw">
            <span className="nm">
              {name} — {roleLabel(staffType)}
            </span>
            <button type="button" className="askl" onClick={onAskShane}>
              Ask Shane
            </button>
          </div>
        ) : (
          <b className="nm">
            {name} — {roleLabel(staffType)}
          </b>
        )}
        <div className="r">
          {!isClockedIn ? (
            <button type="button" className="clk" onClick={() => clockIn()}>
              Clock in
            </button>
          ) : (
            <button
              type="button"
              className={`clk on${isPaused ? " p" : ""}`}
              aria-label="Clocked in. Tap to clock out"
              onClick={() => clockOut()}
            >
              <i className="dot" />
              <span>{isPaused ? "Paused" : elapsedLabel}</span>
            </button>
          )}
        </div>
      </div>
      <div className={`sbar ${sbarClass}`} />
      <style>{TOP_BAR_CSS}</style>
    </header>
  );
}

const TOP_BAR_CSS = `
.mrg-portal-top{position:sticky;top:0;z-index:20;background:#fff}
.mrg-portal-top .tb{display:flex;align-items:center;gap:10px;height:64px;padding:0 12px 0 16px;border-bottom:1px solid rgb(0 0 0 / .06)}
.mrg-portal-top .nm{flex:1;text-align:center;font-size:15px;font-weight:700;color:oklch(0.21 0.006 285)}
.mrg-portal-top .nmw{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;min-width:0}
.mrg-portal-top .nmw .nm{flex:none;font-size:14px;line-height:1.2}
.mrg-portal-top .askl{border:0;background:none;padding:0;font-size:12px;font-weight:600;color:oklch(0.42 0.09 185);cursor:pointer;min-height:28px}
.mrg-portal-top .askl:hover{text-decoration:underline}
.mrg-portal-top .r{display:flex;align-items:center;gap:8px;flex:none}
.mrg-portal-top .clk{position:relative;width:80px;height:40px;border-radius:99px;border:0;background:#18181b;color:#fff;font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:5px;cursor:pointer;font-family:inherit}
.mrg-portal-top .clk::after{content:"";position:absolute;inset:-8px -4px}
.mrg-portal-top .clk.on{width:auto;min-width:80px;padding:0 12px;background:#fff;color:oklch(0.21 0.006 285);border:1px solid rgb(0 0 0 / .11);font-variant-numeric:tabular-nums}
.mrg-portal-top .clk .dot{width:8px;height:8px;border-radius:50%;background:oklch(0.6 0.13 155);display:inline-block}
.mrg-portal-top .clk.p .dot{background:oklch(0.6 0.14 65)}
.mrg-portal-top .clk.p{color:oklch(0.47 0.12 60)}
.mrg-portal-top .sbar{height:3px}
.mrg-portal-top .sbar.in{background:oklch(0.6 0.13 155)}
.mrg-portal-top .sbar.paused{background:oklch(0.6 0.14 65)}
.mrg-portal-top .sbar.out{height:0}
`;
