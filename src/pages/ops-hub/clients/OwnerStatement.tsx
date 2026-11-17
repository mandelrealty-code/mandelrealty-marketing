import { useCallback, useEffect, useRef, useState } from "react";
import { pmGet } from "../../clients/api";
import { LOGO } from "./logo";
import { Icon } from "./icons";
import { MonthPicker, moneyExact } from "./uiBits";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Open a letter-sized print window (same behaviour as OwnerStatementPanel). */
export function openOwnerStatementPdf(opts: {
  source: HTMLElement;
  title: string;
  onBlocked: () => void;
}): void {
  const { source, title, onBlocked } = opts;
  const win = window.open("", "_blank");
  if (!win) {
    onBlocked();
    return;
  }

  const styleTags = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((el) => el.outerHTML)
    .join("\n");

  win.document.open();
  win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<base href="${escapeHtml(window.location.origin)}/" />
<title>${escapeHtml(title)}</title>
${styleTags}
<style>
  @page { size: letter portrait; margin: 0.5in; }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
    color: #18181b !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    font-family: Inter, system-ui, sans-serif !important;
  }
  .owner-statement-print { max-width: 7.6in; margin: 0 auto; }
  .no-print { display: none !important; }
  .paper {
    width: auto !important;
    margin: 0 !important;
    box-shadow: none !important;
    border-radius: 0 !important;
  }
</style>
</head>
<body>
<div class="owner-statement-print">${source.innerHTML}</div>
<script>
(async function () {
  var imgs = Array.prototype.slice.call(document.images || []);
  await Promise.all(imgs.map(function (img) {
    if (img.complete) return Promise.resolve();
    return new Promise(function (resolve) {
      img.onload = img.onerror = resolve;
    });
  }));
  document.title = ${JSON.stringify(title)};
  setTimeout(function () {
    window.focus();
    window.print();
  }, 300);
})();
</script>
</body>
</html>`);
  win.document.close();
}

type OwnerStatement = {
  statement_id: string;
  year_month: string;
  month_title: string;
  currency: string;
  client_name: string;
  mrg_commission_cents: number;
  hst_invoice_cents: number;
  hst_cents: number;
  expense_cents: number;
  net_to_host_cents: number;
  units: Array<{
    property_id: string;
    property_name: string;
    statement: {
      hst_mode: "cohost" | "invoice";
      mrg_commission_cents: number;
      hst_cents: number;
      expense_cents: number;
      net_to_host_cents: number;
    };
  }>;
  stays: Array<{
    label: string;
    meta: string;
    check_in: string | null;
    check_out: string | null;
    nights: number;
    platform_id: string;
    airbnb_payout_cents: number;
    property_name: string;
  }>;
  expenses: Array<{
    id: string;
    expense_date: string;
    label: string;
    amount_cents: number;
    property_name: string;
  }>;
};

function stayDates(s: OwnerStatement["stays"][number]): string {
  if (s.check_in && s.check_out) {
    const a = new Date(`${s.check_in.slice(0, 10)}T12:00:00`);
    const b = new Date(`${s.check_out.slice(0, 10)}T12:00:00`);
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (!Number.isNaN(a.getTime()) && !Number.isNaN(b.getTime())) {
      return `${fmt(a)} to ${fmt(b)}`;
    }
  }
  return s.meta || "";
}

export function OwnerStatementView({
  clientId,
  clientName,
  initialMonth,
  phone,
  onBack,
  onError,
}: {
  clientId: string;
  clientName: string;
  initialMonth: string;
  phone?: boolean;
  onBack: () => void;
  onError: (msg: string) => void;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [statement, setStatement] = useState<OwnerStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    onError("");
    try {
      const data = await pmGet<{ statement: OwnerStatement }>("owner_statement", {
        month,
        client_id: clientId,
      });
      setStatement(data.statement);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not load owner statement.");
      setStatement(null);
    } finally {
      setLoading(false);
    }
  }, [month, clientId, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const currency = statement?.currency || "CAD";

  const downloadPdf = () => {
    if (!statement || !printRef.current) return;
    const title = `MRG Owner Statement — ${statement.client_name} — ${statement.month_title}`;
    openOwnerStatementPdf({
      source: printRef.current,
      title,
      onBlocked: () => {
        onError(
          "Allow pop-ups for this site, then click Download PDF again. In the print dialog choose “Save as PDF” and turn on background graphics.",
        );
      },
    });
  };

  const paper = statement ? (
    <div className="paper" ref={printRef}>
      <div className="ph1">
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <img src={LOGO} alt="" style={{ width: phone ? 28 : 34, height: phone ? 28 : 34 }} />
          <div>
            <b style={{ fontSize: phone ? 14 : 16 }}>Owner statement</b>
            <div className="meta">Mandel Realty Group</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <b>{statement.client_name}</b>
          <div className="meta">{statement.month_title}</div>
        </div>
      </div>

      <h4>Stays</h4>
      <table>
        <thead>
          <tr>
            <th>{phone ? "Unit, dates" : "Unit"}</th>
            {phone ? null : (
              <>
                <th>Dates</th>
                <th>Nights</th>
                <th>Guest</th>
              </>
            )}
            <th className="r">Payout</th>
          </tr>
        </thead>
        <tbody>
          {statement.stays.map((s, i) => (
            <tr key={`${s.platform_id}-${i}`}>
              {phone ? (
                <td>
                  {s.property_name}
                  <div className="meta">
                    {stayDates(s)} · {s.nights} nights
                  </div>
                </td>
              ) : (
                <>
                  <td>{s.property_name}</td>
                  <td>{stayDates(s)}</td>
                  <td>{s.nights}</td>
                  <td>{s.label || "—"}</td>
                </>
              )}
              <td className="r num">{moneyExact(s.airbnb_payout_cents, currency)}</td>
            </tr>
          ))}
          <tr className="tot">
            {phone ? (
              <>
                <td>Total payout</td>
                <td className="r num">
                  {moneyExact(
                    statement.stays.reduce((n, s) => n + (s.airbnb_payout_cents || 0), 0),
                    currency,
                  )}
                </td>
              </>
            ) : (
              <>
                <td>Total payout</td>
                <td />
                <td />
                <td />
                <td className="r num">
                  {moneyExact(
                    statement.stays.reduce((n, s) => n + (s.airbnb_payout_cents || 0), 0),
                    currency,
                  )}
                </td>
              </>
            )}
          </tr>
        </tbody>
      </table>

      <h4>Fees</h4>
      <table>
        <tbody>
          {statement.units.map((u) => (
            <tr key={u.property_id}>
              <td>MRG fee, {u.property_name}</td>
              <td className="r num">{moneyExact(u.statement.mrg_commission_cents, currency)}</td>
            </tr>
          ))}
          <tr className="tot">
            <td>Total fees</td>
            <td className="r num">{moneyExact(statement.mrg_commission_cents, currency)}</td>
          </tr>
        </tbody>
      </table>

      <h4>HST</h4>
      <table>
        <tbody>
          {statement.units.map((u) => (
            <tr key={`hst-${u.property_id}`}>
              <td>
                {u.statement.hst_mode === "invoice"
                  ? `HST on MRG fee, ${u.property_name}`
                  : `${u.property_name}: HST not on invoice`}
              </td>
              <td className="r num">
                {moneyExact(
                  u.statement.hst_mode === "invoice" ? u.statement.hst_cents : 0,
                  currency,
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4>Expenses</h4>
      <table>
        <tbody>
          {statement.expenses.length === 0 ? (
            <tr>
              <td>No expenses</td>
              <td className="r num">{moneyExact(0, currency)}</td>
            </tr>
          ) : (
            statement.expenses.map((e) => (
              <tr key={e.id}>
                <td>
                  {e.label}
                  {e.property_name ? `, ${e.property_name}` : ""}
                </td>
                <td className="r num">{moneyExact(e.amount_cents, currency)}</td>
              </tr>
            ))
          )}
          <tr className="tot">
            <td>Total expenses</td>
            <td className="r num">{moneyExact(statement.expense_cents, currency)}</td>
          </tr>
        </tbody>
      </table>

      <div className="net">
        <span>Net to host</span>
        <span className="num">{moneyExact(statement.net_to_host_cents, currency)}</span>
      </div>
    </div>
  ) : null;

  return (
    <div className="stmt" style={phone ? { position: "fixed", inset: 0, zIndex: 50, height: "100dvh" } : { position: "fixed", inset: 0, zIndex: 50 }}>
      <div className="stmtbar no-print" style={phone ? { padding: "8px 10px", gap: 6 } : undefined}>
        {phone ? (
          <button type="button" className="iconbtn" onClick={onBack} aria-label="Back">
            <Icon name="back" />
          </button>
        ) : (
          <button type="button" className="btn" onClick={onBack}>
            <Icon name="back" className="i sm" />
            Back
          </button>
        )}
        <b style={{ color: "var(--ink)", fontSize: phone ? undefined : "var(--t-md)", flex: phone ? 1 : undefined }}>
          {phone ? "Owner statement" : `Owner statement · ${clientName}`}
        </b>
        {phone ? null : <span style={{ flex: 1 }} />}
        {phone ? null : <MonthPicker value={month} onChange={setMonth} disabled={loading} />}
        <button
          type="button"
          className="btn primary"
          style={phone ? { height: 40 } : undefined}
          disabled={loading || !statement}
          onClick={downloadPdf}
        >
          <Icon name="down" className="i sm" />
          Download PDF
        </button>
      </div>
      {phone ? (
        <div className="no-print" style={{ padding: "10px 12px 0", display: "flex", justifyContent: "center" }}>
          <MonthPicker value={month} onChange={setMonth} disabled={loading} phone />
        </div>
      ) : null}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: phone ? "10px 12px" : undefined }}>
        {loading ? <p className="meta" style={{ textAlign: "center", padding: 40 }}>Building statement…</p> : null}
        {!loading && !statement ? (
          <p className="meta" style={{ textAlign: "center", padding: 40 }}>No statement data.</p>
        ) : null}
        {paper}
      </div>
    </div>
  );
}
