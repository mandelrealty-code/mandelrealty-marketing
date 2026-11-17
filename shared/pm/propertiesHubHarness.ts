/** Properties hub: no design placeholders, audit action labels present, confirms, light theme. */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function fail(label: string): never {
  throw new Error("Properties hub harness failed: " + label);
}

const root = new URL("../../src/pages/ops-hub/properties", import.meta.url);
const cssPath = new URL("../../src/pages/ops-hub/clients/clientsDesign.css", import.meta.url);

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
if (!files.length) fail("no files under ops-hub/properties");
const contractsCard = readFileSync(
  new URL("../../src/pages/ops-hub/clients/ContractsCard.tsx", import.meta.url),
  "utf8",
);
const clientsApp = readFileSync(new URL("../../src/pages/clients/ClientsApp.tsx", import.meta.url), "utf8");
const src = files.map((f) => readFileSync(f, "utf8")).join("\n") + "\n" + contractsCard;
const css = readFileSync(cssPath, "utf8");

const FORBIDDEN = [
  "Sample Loft",
  "Example Suite",
  "Example Cottage",
  "Mock Studio",
  "Mock Townhome",
  "Mock Basement Suite",
  "Demo Condo",
  "Placeholder Flat",
  "Placeholder Townhouse",
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
  "32 Mock Rd SW",
  "34 Mock Rd SW",
  "40 Demo Way SE",
  "60 Placeholder Rd SE",
  "70 Placeholder Ave NW",
  "80 Sample Blvd SE",
  "00000000-0000-4000-8000-000000000101",
  "00000000-0000-4000-8000-000000000105",
  "00000000-0000-4000-8000-000000000108",
  "CH-PLACEHOLDER-01",
  "GB-SAMPLE-01",
  "PLCH-STR-0001",
  "Guest A",
  "Guest B",
  "Guest C",
  "Guest D",
  "Cleaning supplies",
  "Linen replacement",
  "Faucet cartridge",
  "5,200.00",
  "1,200.00",
  "Furniture addendum",
  "signed-agreement-placeholder.pdf",
];
for (const s of FORBIDDEN) {
  if (src.includes(s)) fail("sample data from the design is in the properties hub: " + s);
}

const REQUIRED = [
  "Add",
  "Import",
  "All clients",
  "Active",
  "Paused",
  "Properties",
  "Edit",
  "Link Hospitable",
  "Copy UUID",
  "Upload",
  "Replace",
  "Remove",
  "Edit links",
  "Copy",
  "Open",
  "Create / open in Cleaner Hub",
  "Create ≤4★ review tasks",
  "Change",
  "Save billing terms",
  "Add permit",
  "Edit permit",
  "Enable MAT",
  "Mark filed",
  "Undo filed",
  "Upload",
  "Refresh",
  "Statement",
  "Add expense",
  "Save",
  "Keep",
  "Delete",
  "Save property",
  "Confirm change",
  "Save links",
  "Deactivate",
  "Continue",
  "Import unit",
  "Save & connect",
  "Delete contract",
];
const missing = REQUIRED.filter((s) => !src.includes(s));
if (missing.length) fail("action labels missing from properties hub: " + missing.join(", "));

if (!src.includes("Delete contract") || !src.includes("ConfirmModal")) {
  fail("contract delete must use a confirm");
}
if (!/Deactivate[\s\S]{0,800}inconfirm|inconfirm[\s\S]{0,800}Deactivate/.test(src)) {
  fail("Deactivate must have an in-sheet confirm");
}

const dark = css.match(/#(?:0a0a0a|111111|111\b|121212|141414|1a1a1a|1c1c1c)\b/gi);
if (dark) fail("dark background colours in the hub CSS: " + [...new Set(dark)].join(", "));

const propsCss = css.includes(".mrgc .pgrid2") && css.includes(".mrgc .covercard") && css.includes(".mrgc .etot");
if (!propsCss) fail("properties CSS additions missing under .mrgc");

for (const bp of ["1239px", "899px", "767px"]) {
  if (!css.includes(bp)) fail("no media query at " + bp);
}
if (!/#c4a35a/i.test(css)) fail("the gold accent is missing");
if (!/Inter/.test(css)) fail("Inter is not the font");

if (!clientsApp.includes("PROPERTIES_HUB = true") || !clientsApp.includes("PropertiesHubApp")) {
  fail("PROPERTIES_HUB flag / PropertiesHubApp wiring missing from ClientsApp");
}

console.log("properties-hub-harness passed");
