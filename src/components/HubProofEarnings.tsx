import { EarningsComparisonChart } from "./EarningsComparisonChart";
import { DashboardScreenshotThumbs } from "./DashboardScreenshotThumbs";
import { EARNINGS_SUMMARY } from "../lib/constants";

const DASHBOARD_SHOTS = [
  {
    src: "/proof/2025-comparison-full.png",
    thumb: "/proof/2025-comparison.png",
    label: "2025 · before MRG",
    alt: "Full Airbnb earnings comparison for 2025 before Mandel Realty Group",
  },
  {
    src: "/proof/2026-comparison-full.png",
    thumb: "/proof/2026-comparison.png",
    label: "2026 · with MRG",
    alt: "Full Airbnb earnings comparison for 2026 with Mandel Realty Group",
  },
] as const;

/** Light-theme earnings proof — gold on hub; blue / green / orange / yellow on plan LPs. */
export function HubProofEarnings({
  accent = "gold",
}: {
  accent?: "gold" | "blue" | "green" | "orange" | "yellow";
}) {
  const mayAug = EARNINGS_SUMMARY.mayAug2026.toLocaleString();
  const year2025 = EARNINGS_SUMMARY.year2025.toLocaleString();
  const chartVariant =
    accent === "blue"
      ? "lightBlue"
      : accent === "green"
        ? "lightGreen"
        : accent === "orange"
          ? "lightOrange"
          : accent === "yellow"
            ? "lightYellow"
            : "light";
  const rootCls =
    accent === "blue"
      ? "mrg-hub-proof-earnings mrg-hub-proof-earnings--blue"
      : accent === "green"
        ? "mrg-hub-proof-earnings mrg-hub-proof-earnings--green"
        : accent === "orange"
          ? "mrg-hub-proof-earnings mrg-hub-proof-earnings--orange"
          : accent === "yellow"
            ? "mrg-hub-proof-earnings mrg-hub-proof-earnings--yellow"
            : "mrg-hub-proof-earnings";

  return (
    <div className={rootCls}>
      <div className="mrg-hub-proof-card">
        <EarningsComparisonChart variant={chartVariant} />
        <div className="mrg-hub-proof-thumbs">
          <DashboardScreenshotThumbs variant={chartVariant} shots={[...DASHBOARD_SHOTS]} />
        </div>
      </div>
      <p className="mrg-hub-proof-callout">
        Just <strong>4 months</strong> of 2026 ({`$${mayAug}`}) already beat the host&apos;s{" "}
        <strong>entire 2025</strong> ({`$${year2025}`}). Same unit, same platform.
      </p>
      <p className="mrg-hub-proof-note">
        Real client result, pulled from their own Airbnb dashboard. Results vary by unit and
        market.
      </p>
    </div>
  );
}
