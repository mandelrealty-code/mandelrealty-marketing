/** The CRM hub engine: no sample people from the design file, every control the design has, and the light theme only. No browser. */

import { readFileSync } from "node:fs";

function fail(label: string): never {
  throw new Error("CRM hub harness failed: " + label);
}

const engine = readFileSync(new URL("../../src/pages/crm-hub/engine.ts", import.meta.url), "utf8");

const cssMatch = engine.match(/export const CRM_CSS = ("(?:[^"\\]|\\.)*");/);
if (!cssMatch) fail("CRM_CSS is not a single string");
const css = JSON.parse(cssMatch[1]) as string;
if (!/export function mountCrm\(root, host\)/.test(engine)) fail("mountCrm(root, host) is not exported");
const returned = engine.slice(engine.lastIndexOf("return {"));
if (!["destroy", "openLead", "openNewLead"].every((k) => returned.includes(k))) fail("mountCrm does not return destroy, openLead and openNewLead");

const FORBIDDEN = [
  "Casey Example", "Morgan Sample", "Riley Demo", "Jordan Placeholder", "Taylor Test", "Drew Mockup", "Quinn Fake", "Sky Dummy",
  "Jamie Placeholder", "Avery Template",
  "casey.example@example.com", "morgan.sample@example.com", "riley.demo@example.com", "jordan.placeholder@example.com",
  "taylor.test@example.com", "quinn.fake@example.com", "sky.dummy@example.com", "jamie.placeholder@example.com",
  "(403) 555-0142", "(403) 555-0157", "(403) 555-0161", "(587) 555-0118", "(403) 555-0176", "(825) 555-0109", "(403) 555-0133",
  "(403) 555-0127", "(403) 555-0190", "(403) 555-0199", "(403) 555-0170", "(403) 555-0171",
  "100 Sample Ave", "200 Placeholder Rd", "200 Mock Cres", "300 Example Blvd", "400 Sample St", "500 Mockup Way", "600 Demo Dr",
  "700 Fake Lane", "800 Example Ct",
  "Alex Setter", "Sam Closer", "Pat Referrer", "Alert Person One",
  "PLCH-7K2Q", "PLCH-3M8D", "PLACEHOLDER-NOV-STR", "airbnb.ca/rooms/000000",
];
for (const s of FORBIDDEN) if (engine.includes(s)) fail("sample data from the design is in the engine: " + s);

const REQUIRED = [
  "Approve and send", "Edit", "Discard", "Follow up", "Done", "Take over", "Resume AI", "Enable AI", "Send AI first text",
  "Draft AI first text", "Dial from this phone", "CRM call", "Start onboarding", "Open unit", "Complete", "Skip",
  "Create client and send contract", "Mark booked", "Delete contact", "Copy phone", "Clear filters", "Show all leads",
  "Upload a file", "Upload file", "Paste text", "Add pasted text", "Retry", "Preview", "Import lead", "Add person", "Remove",
  "Create code", "Log out", "Save lead", "Autopilot", "Draft for review", "Booked this week", "Needs you", "All caught up",
  "No documents yet", "No codes yet", "Auto-reply to new SMS", "New lead text alerts", "Revenue audit unlock codes",
  "Paste a Meta lead",
];
const missing = REQUIRED.filter((s) => !engine.includes(s));
if (missing.length) fail("controls missing from the engine: " + missing.join(", "));

const dark = css.match(/#(?:0a0a0a|111111|111|121212|141414|1a1a1a|1c1c1c)\b/gi);
if (dark) fail("dark background colours in the CRM CSS: " + [...new Set(dark)].join(", "));

for (const bp of ["1239px", "899px", "767px"]) if (!css.includes(bp)) fail("no media query at " + bp);
if (!/#c4a35a/i.test(css)) fail("the gold accent is missing");
if (!/Inter/.test(css)) fail("Inter is not the font");

console.log("crm-hub-harness passed");
