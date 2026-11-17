/**
 * Fixture check: CSV + HST clipboard builders (shared by MonthClosePanel and Revenue hub).
 * Run via: npx tsx scripts/revenue-month-close-fixture.ts
 */
import {
  MONTH_CLOSE_CSV_HEADER,
  buildInvoiceGroups,
  clientSummaryText,
  monthCloseCsvString,
  monthSummaryText,
  type MonthPortfolio,
  type PortfolioUnit,
} from "../src/pages/clients/monthCloseText.ts";

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

const unit: PortfolioUnit = {
  property_id: "p1",
  property_name: "Unit A",
  client_id: "c1",
  client_name: "Client One",
  linked: true,
  rate_bps: 2000,
  commission_base_mode: "nightly",
  cleaning_fee_keeper: "host",
  hst_mode: "invoice",
  hst_bps: 500,
  sync_status: "fresh",
  last_synced_at: "2026-10-01T00:00:00Z",
  reservation_count: 2,
  net_to_host_cents: 400000,
  mrg_commission_cents: 100000,
  mrg_take_cents: 100000,
  nightly_total_cents: 500000,
  hst_invoice_cents: 5000,
  expense_cents: 15000,
  currency: "CAD",
};
const unit2: PortfolioUnit = {
  ...unit,
  property_id: "p2",
  property_name: "Unit B",
  linked: false,
  sync_status: "unlinked",
  hst_mode: "cohost",
  hst_invoice_cents: null,
  net_to_host_cents: null,
  mrg_commission_cents: null,
  mrg_take_cents: null,
  nightly_total_cents: null,
  expense_cents: null,
  reservation_count: 0,
};
const portfolio: MonthPortfolio = {
  year_month: "2026-10",
  currency: "CAD",
  unit_count: 2,
  linked_count: 1,
  unlinked_count: 1,
  net_to_host_cents: 400000,
  mrg_commission_cents: 100000,
  mrg_take_cents: 100000,
  hst_invoice_cents: 5000,
  expense_cents: 15000,
  reservation_count: 2,
  fleet_last_synced_at: null,
  units: [unit, unit2],
};

const EXPECTED_HEADER = [
  "Property",
  "Client",
  "Linked",
  "Take %",
  "HST mode",
  "HST %",
  "Sync",
  "Net to host",
  "MRG fee",
  "Nightly",
  "HST to invoice",
  "Host charges",
  "Stays",
] as const;

if (JSON.stringify([...MONTH_CLOSE_CSV_HEADER]) !== JSON.stringify([...EXPECTED_HEADER])) {
  fail("CSV header drifted from the MonthClosePanel contract");
}

const EXPECTED_CSV = [
  '"Property","Client","Linked","Take %","HST mode","HST %","Sync","Net to host","MRG fee","Nightly","HST to invoice","Host charges","Stays"',
  '"Unit A","Client One","yes","Nightly · 20% · HST invoice 5% · Host cleaning","invoice","5","fresh","4000.00","1000.00","5000.00","50.00","150.00","2"',
  '"Unit B","Client One","no","Nightly · 25% take · Host cleaning","cohost","5","unlinked","","","","","","0"',
].join("\n");

const csv = monthCloseCsvString(portfolio);
if (csv !== EXPECTED_CSV) fail("CSV string does not match fixture\nGOT:\n" + csv);

const groups = buildInvoiceGroups(portfolio.units);
const EXPECTED_CLIENT =
  "Client One — October 2026 HST invoice (CAD)\nUnit A: $50.00 (MRG fee $1,000.00 × 5%)\nTotal: $50.00";
const EXPECTED_MONTH =
  "MRG HST to invoice — October 2026 (CAD)\n\nClient One — October 2026 HST invoice (CAD)\nUnit A: $50.00 (MRG fee $1,000.00 × 5%)\nTotal: $50.00\n\nGrand total: $50.00";

const clientTxt = clientSummaryText(groups[0]!, "2026-10", "CAD");
const monthTxt = monthSummaryText(groups, "2026-10", "CAD", 5000);
if (clientTxt !== EXPECTED_CLIENT) fail("clientSummaryText drifted\nGOT:\n" + clientTxt);
if (monthTxt !== EXPECTED_MONTH) fail("monthSummaryText drifted\nGOT:\n" + monthTxt);

console.log("csv-fixture-ok");
console.log("hst-copy-fixture-ok");
