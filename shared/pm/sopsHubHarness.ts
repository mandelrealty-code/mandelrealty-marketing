/** SOPs hub: no design placeholders, audit §1 labels, confirms, draft/backup parity, light theme. */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  SOP_DRAFT_KEY,
  isSopBackup,
  parseSopBackupJson,
  sopBackupJsonString,
} from "./sopBackup.ts";
import type { SopItem } from "./sopTypes.ts";

function fail(label: string): never {
  throw new Error("SOPs hub harness failed: " + label);
}

const sopsRoot = new URL("../../src/pages/ops-hub/sops", import.meta.url);
const clientsCssPath = new URL("../../src/pages/ops-hub/clients/clientsDesign.css", import.meta.url);
const clientsAppPath = new URL("../../src/pages/clients/ClientsApp.tsx", import.meta.url);
const hubShellPath = new URL("../../src/pages/ops-hub/clients/HubShell.tsx", import.meta.url);
const crmEnginePath = new URL("../../src/pages/crm-hub/engine.ts", import.meta.url);
const onboardingEnginePath = new URL("../../src/pages/onboarding/engine.ts", import.meta.url);
const redactorPath = new URL("../../src/components/sop/ImageRedactorModal.tsx", import.meta.url);
const studioPath = new URL("../../src/components/sop/VideoSopStudioModal.tsx", import.meta.url);
const sopBackupPath = new URL("./sopBackup.ts", import.meta.url);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|css)$/.test(name)) out.push(p);
  }
  return out;
}

const files = walk(sopsRoot.pathname);
if (!files.length) fail("no files under ops-hub/sops");

const hubSrc = files.map((f) => readFileSync(f, "utf8")).join("\n");
const clientsCss = readFileSync(clientsCssPath.pathname, "utf8");
const modalCss = readFileSync(join(sopsRoot.pathname, "sopModalsDesign.css"), "utf8");
const clientsApp = readFileSync(clientsAppPath.pathname, "utf8");
const hubShell = readFileSync(hubShellPath.pathname, "utf8");
const crmEngine = readFileSync(crmEnginePath.pathname, "utf8");
const onboardingEngine = readFileSync(onboardingEnginePath.pathname, "utf8");
const redactor = readFileSync(redactorPath.pathname, "utf8");
const studio = readFileSync(studioPath.pathname, "utf8");
const sopBackupSrc = readFileSync(sopBackupPath.pathname, "utf8");

const allSrc = [hubSrc, redactor, studio, clientsApp].join("\n");

/* ---- design placeholders must not ship ---- */
const FORBIDDEN = [
  "Sample: First reply to a new lead",
  "Sample: Guest arrival message",
  "Sample: Cleaner handoff note",
  "Sample: Turnover walkthrough",
  "Sample: Add a listing in the PMS",
  "Sample: Review reply template",
  "Sample: Linen restock check",
  "sample-backup.json",
  "Name this SOP",
];
for (const s of FORBIDDEN) {
  if (hubSrc.includes(s)) fail("sample data from the design is in ops-hub/sops: " + s);
}

/* ---- audit §1 action labels ---- */
const REQUIRED = [
  "Record",
  "Import backup",
  "New SOP",
  "Create SOP",
  "Search SOPs",
  "Edit Guide",
  "Copy Link",
  "Delete SOP",
  "Video Studio",
  "Download backup",
  "Edit in Redactor",
  "Script",
  "Pro tip",
  "Warning",
  "Delete Guide",
  "Discard Changes",
  "Publish SOP",
  "Draft saved",
  "Close without saving?",
  "Add Step",
  "Delete Step",
  "Spotlight",
  "Replace Image",
  "Clear all",
  "Cancel",
  "Apply to Step",
  "Undo",
  "Publish",
  "Pause",
  "Resume",
  "Snapshots",
  "ConfirmModal",
];
const missing = REQUIRED.filter((s) => !allSrc.includes(s));
if (missing.length) fail("action labels missing from SOPs hub / modals: " + missing.join(", "));

/* ---- confirms: list delete, guide delete, unsaved close ---- */
if (!hubSrc.includes("ConfirmModal") || !hubSrc.includes('confirmLabel="Delete SOP"')) {
  fail("list Delete must use ConfirmModal with Delete SOP");
}
if (!hubSrc.includes('confirmLabel="Delete Guide"') && !hubSrc.includes('confirmLabel="Delete Guide"')) {
  fail("editor Delete Guide must use ConfirmModal");
}
if (!hubSrc.includes("Close without saving?")) {
  fail("unsaved close confirm missing");
}
if (!studio.includes("Delete Guide")) {
  fail("Video Studio Delete Guide label missing");
}

/* ---- draft key + backup shape unchanged; old exporter fixture must import ---- */
if (SOP_DRAFT_KEY !== "mrg_sop_editor_draft") fail("draft key changed from mrg_sop_editor_draft");
if (!sopBackupSrc.includes('SOP_DRAFT_KEY = "mrg_sop_editor_draft"')) {
  fail("sopBackup must export mrg_sop_editor_draft");
}
if (!hubSrc.includes("SOP_DRAFT_KEY") && !hubSrc.includes("mrg_sop_editor_draft")) {
  fail("hub must use the shared draft key");
}

/** Fixture shaped like the pre-hub SopsPanel exporter: JSON.stringify(SopItem), no indent. */
const OLD_EXPORTER_FIXTURE: SopItem = {
  id: "fixture-old-1",
  slug: "zz-old-backup-fixture",
  title: "ZZ Fixture Backup SOP",
  category: "outreach",
  target_role: "va",
  summary: "Exported by the old SopsPanel before the hub restyle.",
  estimated_minutes: 12,
  is_published: true,
  author: "Shane M.",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
  steps: [
    {
      id: "step-1",
      step_number: 1,
      title: "Open the panel",
      description: "Click New SOP.",
      media_type: "image",
      image_url: "https://example.com/step-1.jpg",
    },
    {
      id: "step-2",
      step_number: 2,
      title: "Publish",
      description: "Click Publish SOP.",
      media_type: "image",
      pro_tip: "Keep titles short.",
      warning: "Do not publish unfinished guides.",
    },
  ],
};
const oldJson = JSON.stringify(OLD_EXPORTER_FIXTURE);
if (oldJson !== sopBackupJsonString(OLD_EXPORTER_FIXTURE)) {
  fail("sopBackupJsonString must match JSON.stringify(SopItem) from the old exporter");
}
const imported = parseSopBackupJson(oldJson);
if (!isSopBackup(imported)) fail("fixture backup failed isSopBackup");
if (imported.slug !== OLD_EXPORTER_FIXTURE.slug || imported.steps.length !== 2) {
  fail("old exporter fixture did not import into the new parser");
}
const roundTrip = parseSopBackupJson(sopBackupJsonString(imported));
if (roundTrip.title !== OLD_EXPORTER_FIXTURE.title || roundTrip.steps[1].warning !== OLD_EXPORTER_FIXTURE.steps[1].warning) {
  fail("backup round-trip lost fields");
}

/* ---- no Paste Screenshot hint / no drag handle in hub ---- */
if (hubSrc.includes("Paste Screenshot")) fail("Paste Screenshot hint must not appear in the hub editor");
if (hubSrc.includes("⣿")) fail("decorative drag handle must not appear in the hub editor");

/* ---- wiring ---- */
if (!clientsApp.includes("SOPS_HUB = true") || !clientsApp.includes("SopsHubApp")) {
  fail("SOPS_HUB flag / SopsHubApp wiring missing from ClientsApp");
}
if (!clientsApp.includes("SopVideoStudioFrame")) {
  fail("Video Studio must mount via SopVideoStudioFrame for the light skin");
}
if (!hubShell.includes('label: "SOPs"') || !hubShell.includes('id: "sops"')) {
  fail("HubShell must include the SOPs sidebar item");
}
if (!crmEngine.includes("label: 'SOPs'") && !crmEngine.includes('label: "SOPs"')) {
  fail("CRM hub sidebar must include SOPs");
}
if (!crmEngine.includes("opsTab: 'sops'") && !crmEngine.includes('opsTab: "sops"')) {
  fail("CRM SOPs nav must open /ops (sops)");
}
if (!onboardingEngine.includes("label:'SOPs'") && !onboardingEngine.includes('label: "SOPs"')) {
  fail("Onboarding sidebar must include SOPs");
}

/* ---- light theme: no dark backgrounds outside the recording bar ---- */
function stripAllowedDark(css: string): string {
  return css
    .replace(/\.mrgc\s+\.mrg-sop-hud[\s\S]*?(?=\n\.mrgc|\n\/\*|$)/g, "")
    /* Attribute selectors that rematch Tailwind utility class names — not painted backgrounds. */
    .replace(/\[[^\]]*#[0-9a-fA-F]{3,8}[^\]]*\]/g, "[stripped]");
}
const cssForDark = stripAllowedDark(clientsCss + "\n" + modalCss);
const dark = cssForDark.match(
  /(?:background(?:-color)?\s*:\s*#(?:0a0a0a|111111|111\b|121212|141414|1a1a1a|1c1c1c)\b|#(?:0a0a0a|111111|121212|141414|1a1a1a|1c1c1c)\b)/gi,
);
if (dark) fail("dark background colours in SOPs CSS outside the recording bar: " + [...new Set(dark)].join(", "));

for (const bp of ["1239px", "899px", "767px"]) {
  if (!clientsCss.includes(bp) && !modalCss.includes(bp)) fail("no media query at " + bp);
}
if (!/#c4a35a/i.test(clientsCss)) fail("the gold accent is missing from hub CSS");
if (!/Inter/.test(clientsCss + modalCss + hubSrc)) fail("Inter is not the font");

/* ---- same sops ops ---- */
if (!hubSrc.includes('pmGet<{ sops: SopItem[] }>("sops")') && !hubSrc.includes('pmGet("sops")') && !hubSrc.includes('pmGet<{ sops')) {
  fail("list must load via pmGet sops");
}
if (!hubSrc.includes('op: "save"') || !hubSrc.includes('op: "delete"')) {
  fail("save/delete ops missing");
}
if (!hubSrc.includes("upload_image") && !hubSrc.includes("uploadStepImages")) {
  fail("image upload pipeline missing");
}
if (!studio.includes("upload_video") && !clientsApp.includes("upload_video") === false) {
  /* studio upload may live in ClientsApp save bridge */
  if (!clientsApp.includes("upload_video") && !studio.includes("upload_video")) {
    fail("upload_video path missing from studio/ClientsApp");
  }
}

console.log("sops-hub-harness passed");
