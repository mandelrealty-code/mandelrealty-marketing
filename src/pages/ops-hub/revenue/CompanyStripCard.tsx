import type { CompanyMonthPnl } from "../../clients/CompanyPnl";
import { moneyExact } from "../../clients/monthCloseText";
import { Icon } from "../clients/icons";
import { RIcon } from "./revenueBits";

export function CompanyStripCard({
  company,
  currency,
  loading,
  onOpenPnl,
  onAddAdsCost,
  onOpenSubscriptions,
}: {
  company: CompanyMonthPnl;
  currency: string;
  loading: boolean;
  onOpenPnl: () => void;
  onAddAdsCost: () => void;
  onOpenSubscriptions: () => void;
}) {
  const stats: Array<{ label: string; icon: string; cents: number; link: boolean }> = [
    { label: "Net earnings (company)", icon: "chart", cents: company.net_earnings_cents, link: true },
    { label: "MRG fees", icon: "brief", cents: company.management_fees_cents, link: false },
    { label: "Company costs", icon: "receipt", cents: company.costs_cents, link: true },
    { label: "HST to remit", icon: "hst", cents: company.hst_to_remit_cents, link: false },
  ];

  const showPrompts =
    !loading && (!company.has_ads_line || !company.has_software_line) && company.management_fees_cents > 0;

  return (
    <>
      <div className="card cstrip">
        {stats.map((s) => {
          const inner = (
            <>
              <span className="ic">
                <RIcon name={s.icon} className="i sm" />
              </span>
              <div>
                {loading ? (
                  <span className="skel" style={{ width: 90, height: 18, margin: "3px 0 6px" }} />
                ) : (
                  <b className="num">{moneyExact(s.cents, currency)}</b>
                )}
                <span className="l">{s.label}</span>
              </div>
            </>
          );
          return s.link ? (
            <button key={s.label} type="button" className="stat lk" onClick={onOpenPnl}>
              {inner}
            </button>
          ) : (
            <div key={s.label} className="stat" style={{ cursor: "default" }}>
              {inner}
            </div>
          );
        })}
        <span className="bd">
          <button
            type="button"
            className="lnk"
            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            onClick={onOpenPnl}
          >
            <RIcon name="pl" className="i xs" />
            Breakdown
            <Icon name="arrow" className="i xs" />
          </button>
        </span>
      </div>
      {showPrompts ? (
        <div className="prompts">
          {!company.has_ads_line ? (
            <span className="prompt">
              <Icon name="alert" className="i xs" />
              Meta ads $0
              <button type="button" className="btn" onClick={onAddAdsCost}>
                Add cost
              </button>
            </span>
          ) : null}
          {!company.has_software_line ? (
            <span className="prompt">
              <Icon name="alert" className="i xs" />
              No subscriptions
              <button type="button" className="btn" onClick={onOpenSubscriptions}>
                Add subscriptions
              </button>
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
