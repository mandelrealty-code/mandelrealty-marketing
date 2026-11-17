/** Revenue hub: no design placeholders, audit §5 labels, confirms, light theme, CSV/HST parity. */

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

function fail(label: string): never {
  throw new Error("Revenue hub harness failed: " + label);
}

const root = new URL("../../src/pages/ops-hub/revenue", import.meta.url);
const cssPath = new URL("../../src/pages/ops-hub/clients/clientsDesign.css", import.meta.url);
const monthClosePanel = new URL("../../src/pages/clients/MonthClosePanel.tsx", import.meta.url);
const clientsAppPath = new URL("../../src/pages/clients/ClientsApp.tsx", import.meta.url);
const fixtureScript = fileURLToPath(new URL("../../scripts/revenue-month-close-fixture.ts", import.meta.url));

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|css)$/.test(name)) out.push(p);
  }
  return out;
}

const files = walk(root.pathname);
if (!files.length) fail("no files under ops-hub/revenue");
const src = files.map((f) => readFileSync(f, "utf8")).join("\n");
const css = readFileSync(cssPath, "utf8");
const clientsApp = readFileSync(clientsAppPath, "utf8");
const oldPanel = readFileSync(monthClosePanel, "utf8");

const FORBIDDEN = [
  "Sample Loft",
  "Example Suite",
  "Example Cottage",
  "Mock Studio",
  "Mock Townhome",
  "Demo Condo",
  "Sample Row House",
  "Harper Sample",
  "Rowan Example",
  "Logan Mock",
  "Emery Placeholder",
  "Parker Demo",
  "Reese Fake",
  "10 Sample St SW",
  "20 Example Ave NE",
  "50 Example Cres NW",
  "30 Mock Rd SW",
  "80 Sample Blvd SE",
  "Guest A",
  "Guest B",
  "Guest C",
  "Guest D",
  "Guest E",
  "Guest F",
  "Linen replacement",
  "Cleaning supplies",
  "Lockbox batch",
  "Sample Loft photo refresh",
  "Hospitable plan",
  "Coworking",
  "00000000-0000-4000-8000-000000000101",
];
for (const s of FORBIDDEN) {
  if (src.includes(s)) fail("sample data from the design is in the revenue hub: " + s);
}

/** Audit §5 Revenue action labels that must remain in the hub. */
const REQUIRED = [
  "Export CSV",
  "Sync all",
  "Sync needing attention",
  "Retry",
  "All",
  "Stale",
  "Unlinked",
  "Ready",
  "HST worklist",
  "Meta ads $0",
  "Add subscriptions",
  "Add cost",
  "Sync",
  "Copy month summary",
  "Copy total",
  "Copy client summary",
  "Copy",
  "Manage subscriptions",
  "Override for",
  "Remove",
  "Delete",
  "Save",
  "Add",
  "Copied",
  "ConfirmModal",
  "Remove cost",
  "Delete subscription",
];
const missing = REQUIRED.filter((s) => !src.includes(s));
if (missing.length) fail("action labels missing from revenue hub: " + missing.join(", "));

const hubApp = readFileSync(join(root.pathname, "RevenueHubApp.tsx"), "utf8");
const subsSheet = readFileSync(join(root.pathname, "SubscriptionsSheet.tsx"), "utf8");
if (!hubApp.includes("ConfirmModal") || !hubApp.includes('confirmLabel="Remove cost"')) {
  fail("cost Remove must use ConfirmModal with Remove cost");
}
if (!subsSheet.includes("ConfirmModal") || !subsSheet.includes('confirmLabel="Delete subscription"')) {
  fail("subscription Delete must use ConfirmModal with Delete subscription");
}

const dark = css.match(/#(?:0a0a0a|111111|111\b|121212|141414|1a1a1a|1c1c1c)\b/gi);
if (dark) fail("dark background colours in the hub CSS: " + [...new Set(dark)].join(", "));

const revCss =
  css.includes(".mrgc .cstrip") &&
  css.includes(".mrgc .ucard") &&
  css.includes(".mrgc .banner") &&
  css.includes(".mrgc .rev-actions");
if (!revCss) fail("revenue CSS additions missing under .mrgc");

for (const bp of ["1239px", "899px", "767px"]) {
  if (!css.includes(bp)) fail("no media query at " + bp);
}
if (!/#c4a35a/i.test(css)) fail("the gold accent is missing");
if (!/Inter/.test(css)) fail("Inter is not the font");

if (!clientsApp.includes("REVENUE_HUB = true") || !clientsApp.includes("RevenueHubApp")) {
  fail("REVENUE_HUB flag / RevenueHubApp wiring missing from ClientsApp");
}
if (!clientsApp.includes("HubSubscriptionsSheet")) {
  fail("Settings Manage must open HubSubscriptionsSheet when REVENUE_HUB is on");
}

if (!oldPanel.includes('from "./monthCloseText"') && !oldPanel.includes("from './monthCloseText'")) {
  fail("MonthClosePanel must import shared monthCloseText builders");
}
if (!src.includes("monthCloseText")) {
  fail("revenue hub must import monthCloseText builders");
}
if (!src.includes("clientSummaryText") || !src.includes("monthSummaryText") || !src.includes("downloadMonthCloseCsv")) {
  fail("revenue hub must call the shared CSV/HST builders");
}

const out = execFileSync(process.execPath, ["--import", "tsx", fixtureScript], {
  encoding: "utf8",
  env: process.env,
});
if (!out.includes("csv-fixture-ok") || !out.includes("hst-copy-fixture-ok")) {
  fail("CSV/HST fixture script did not report ok\n" + out);
}

console.log("revenue-hub-harness passed");
console.log(out.trim());
