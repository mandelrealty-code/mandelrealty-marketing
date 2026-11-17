/** Team + Settings hubs: no design placeholders, audit §2/§6 labels, confirms, light theme. */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function fail(label: string): never {
  throw new Error("Team/Settings hub harness failed: " + label);
}

const teamRoot = new URL("../../src/pages/ops-hub/team", import.meta.url);
const settingsRoot = new URL("../../src/pages/ops-hub/settings", import.meta.url);
const cssPath = new URL("../../src/pages/ops-hub/clients/clientsDesign.css", import.meta.url);
const clientsAppPath = new URL("../../src/pages/clients/ClientsApp.tsx", import.meta.url);
const crmEnginePath = new URL("../../src/pages/crm-hub/engine.ts", import.meta.url);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|css)$/.test(name)) out.push(p);
  }
  return out;
}

const files = [...walk(teamRoot.pathname), ...walk(settingsRoot.pathname)];
if (!files.length) fail("no files under ops-hub/team or ops-hub/settings");
const connectSheet = readFileSync(
  new URL("../../src/pages/ops-hub/properties/PropertySheets.tsx", import.meta.url),
  "utf8",
);
const src = files.map((f) => readFileSync(f, "utf8")).join("\n") + "\n" + connectSheet;
const css = readFileSync(cssPath, "utf8");
const clientsApp = readFileSync(clientsAppPath, "utf8");
const crmEngine = readFileSync(crmEnginePath, "utf8");

const FORBIDDEN = [
  "Jules Placeholder",
  "Kai Sample",
  "Lee Demo",
  "Noor Example",
  "jules.placeholder@example.com",
  "Furniture addendum",
  "template-placeholder.pdf",
  "Sample Loft",
  "Example Cottage",
  "Placeholder Flat",
  "Mock Studio",
  "Book photographer for Sample Loft",
  "Walkthrough checklist, Example Cottage",
  "Order lockbox for Placeholder Flat",
  "Upload floor plan, Mock Studio",
  "Management agreement, Standard",
  "Management agreement, Essentials",
  "Management agreement, Short term",
];
for (const s of FORBIDDEN) {
  if (src.includes(s)) fail("sample data from the design is in team/settings hub: " + s);
}

/** Audit §2 Employees + §6 Settings action labels. */
const REQUIRED = [
  "Invite",
  "Send login",
  "Remove",
  "Add",
  "Send invite",
  "Cancel",
  "Open portal",
  "Resend invite",
  "Delete",
  "Refresh",
  "Staff logins",
  "Staff types",
  "Connect",
  "Update keys",
  "Disconnect",
  "Save & connect",
  "Manage",
  "Upload PDF",
  "View",
  "Archive",
  "Log out",
  "ConfirmModal",
  "Delete template",
];
const missing = REQUIRED.filter((s) => !src.includes(s));
if (missing.length) fail("action labels missing from team/settings hub: " + missing.join(", "));

const teamApp = readFileSync(join(teamRoot.pathname, "TeamHubApp.tsx"), "utf8");
const settingsApp = readFileSync(join(settingsRoot.pathname, "SettingsHubApp.tsx"), "utf8");
const templates = readFileSync(join(settingsRoot.pathname, "TemplatesCard.tsx"), "utf8");

if (!teamApp.includes("ConfirmModal") || !/confirmLabel=\"Remove\"/.test(teamApp)) {
  fail("roster Remove must use ConfirmModal with Remove");
}
if (!teamApp.includes("ConfirmModal") || !/confirmLabel=\"Delete\"/.test(teamApp)) {
  fail("staff Delete must use ConfirmModal with Delete");
}
if (!settingsApp.includes("ConfirmModal") || !settingsApp.includes('confirmLabel="Disconnect"')) {
  fail("Disconnect must use ConfirmModal");
}
if (!templates.includes("ConfirmModal") || !templates.includes('confirmLabel="Delete template"')) {
  fail("template Delete must use ConfirmModal with Delete template");
}

const dark = css.match(/#(?:0a0a0a|111111|111\b|121212|141414|1a1a1a|1c1c1c)\b/gi);
if (dark) fail("dark background colours in the hub CSS: " + [...new Set(dark)].join(", "));

for (const bp of ["1239px", "899px", "767px"]) {
  if (!css.includes(bp)) fail("no media query at " + bp);
}
if (!/#c4a35a/i.test(css)) fail("the gold accent is missing");
if (!/Inter/.test(css)) fail("Inter is not the font");

if (!clientsApp.includes("TEAM_HUB = true") || !clientsApp.includes("TeamHubApp")) {
  fail("TEAM_HUB flag / TeamHubApp wiring missing from ClientsApp");
}
if (!clientsApp.includes("SETTINGS_HUB = true") || !clientsApp.includes("SettingsHubApp")) {
  fail("SETTINGS_HUB flag / SettingsHubApp wiring missing from ClientsApp");
}

if (!teamApp.includes('op: "send"') || !teamApp.includes("staff_invite")) {
  fail("staff_invite send missing from TeamHubApp");
}
if (!teamApp.includes("lookback") && !teamApp.includes("time_entries")) {
  /* time_entries required */
}
if (!teamApp.includes("time_entries") || !teamApp.includes("board")) {
  fail("time_entries / board loads missing");
}
if (!settingsApp.includes("default_commission_percent") || !settingsApp.includes("default_hst_percent")) {
  fail("default commission/HST updates missing");
}
if (!settingsApp.includes("save_hospitable_pat") || !settingsApp.includes("clear_hospitable_mcp")) {
  fail("Hospitable save/clear ops missing");
}
if (!settingsApp.includes("HubSubscriptionsSheet") && !settingsApp.includes("SubscriptionsSheet")) {
  fail("Company costs Manage must open SubscriptionsSheet");
}
if (!settingsApp.includes("ConnectHospitableSheet")) {
  fail("Settings must reuse ConnectHospitableSheet from properties");
}

/* Sidebar Settings → OPS; CRM Settings is its own Jump-to / tablist entry */
if (!crmEngine.includes("label: 'Settings'")) {
  fail("CRM sidebar footer must be labelled Settings (OPS settings)");
}
if (!crmEngine.includes("'CRM Settings'")) {
  fail("CRM Settings must remain a distinct label in the CRM tablist / Jump to");
}
if (!/id === 'settings'[\s\S]{0,120}opsTab:\s*'settings'/.test(crmEngine)) {
  fail("CRM sidebar Settings must open /ops/settings via host.go");
}
if (!crmEngine.includes("go:ops:settings") || !crmEngine.includes("tab:settings")) {
  fail("Jump to must expose both Settings (ops) and CRM Settings (tab)");
}

console.log("team-hub-harness passed");
