/** Clients hub: no design placeholders, every audit §3 action label, contract delete confirm, light theme only. */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function fail(label: string): never {
  throw new Error("Clients hub harness failed: " + label);
}

const root = new URL("../../src/pages/ops-hub/clients", import.meta.url);
const dir = root.pathname;

function walk(dirPath: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dirPath)) {
    const p = join(dirPath, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|css)$/.test(name)) out.push(p);
  }
  return out;
}

const files = walk(dir);
if (!files.length) fail("ops-hub/clients is empty");
const src = files.map((f) => readFileSync(f, "utf8")).join("\n");
const cssFile = files.find((f) => f.endsWith("clientsDesign.css"));
if (!cssFile) fail("clientsDesign.css missing");
const css = readFileSync(cssFile, "utf8");

const FORBIDDEN = [
  "Harper Sample",
  "Rowan Example",
  "Logan Mock",
  "Emery Placeholder",
  "Parker Demo",
  "Reese Fake",
  "Jordan Placeholder",
  "Taylor Test",
  "Sky Dummy",
  "Quinn Fake",
  "harper.sample@example.com",
  "rowan.example@example.com",
  "logan.mock@example.com",
  "emery.placeholder@example.com",
  "parker.demo@example.com",
  "reese.fake@example.com",
  "jordan.placeholder@example.com",
  "(403) 555-0210",
  "(403) 555-0221",
  "(587) 555-0232",
  "(403) 555-0243",
  "(825) 555-0254",
  "(403) 555-0265",
  "(403) 555-0161",
  "Sample Loft",
  "Example Suite",
  "Mock Studio",
  "Demo Condo",
  "10 Sample St",
  "portal.example.com/host/placeholder",
];
for (const s of FORBIDDEN) {
  if (src.includes(s)) fail("sample data from the design is in the hub: " + s);
}

const REQUIRED = [
  "Add client",
  "Preview",
  "Clear",
  "Choose a lead",
  "Save & send contract",
  "Save client only",
  "Month earnings",
  "Properties",
  "Delete client",
  "Send portal invite",
  "Resend invite",
  "Replace contract",
  "Edit boxes only",
  "Preview as host",
  "Existing host",
  "Send portal access",
  "Next: place fields",
  "Send invite",
  "Replace & resend",
  "Upload",
  "Open",
  "Delete contract",
  "Preview statement",
  "HST worklist",
  "Copy HST",
  "Download PDF",
  "Host fills later",
  "MRG fills now",
];
const missing = REQUIRED.filter((s) => !src.includes(s));
if (missing.length) fail("action labels missing from the hub: " + missing.join(", "));

if (!/confirmLabel=["']Delete contract["']|Delete contract/.test(src) || !/ConfirmModal|confirmLabel/.test(src)) {
  fail("contract delete confirm is missing");
}
if (!src.includes("Delete contract") || !src.includes("pendingDelete")) {
  fail("contract delete must go through a confirm (pendingDelete)");
}

const dark = css.match(/#(?:0a0a0a|111111|111\b|121212|141414|1a1a1a|1c1c1c)\b/gi);
if (dark) fail("dark background colours in the Clients CSS: " + [...new Set(dark)].join(", "));

for (const bp of ["1239px", "899px", "767px"]) {
  if (!css.includes(bp)) fail("no media query at " + bp);
}
if (!/#c4a35a/i.test(css)) fail("the gold accent is missing");
if (!/Inter/.test(css) && !/Inter/.test(src)) fail("Inter is not the font");
if (!/\.mrgc\b/.test(css)) fail("CSS is not scoped under .mrgc");

console.log("clients-hub-harness passed");
