/**
 * What Copilot is connected to, as it really is: the same rows the Settings page shows and the agent reads.
 * A sign-in the provider rejects is "Needs re-authorization", never "Connected". Each row says how it was last checked.
 */

import { gmailKeysReady, gmailStatus } from "../adminApi/gmail.js";
import { outlookKeysReady, outlookStatus } from "../adminApi/outlook.js";
import { airroiStatus } from "../airroi.js";
import { cleanerWebhookReady, twilioReady } from "./cleanText.js";
import { hospitableCard } from "./hospitableConnection.js";
import { loginCheckedAt, type LoginState } from "./mailLoginStatus.js";
import { runsOnItsOwn, skillRows } from "./skillRunner.js";
import type { ConnectorRow, SkillRow } from "./types.js";

const HOSPITABLE_TOOLS = ["guest_inbox", "list_stays", "read_guest_messages"];

/** A mail connector as the page shows it. A saved token that the provider rejects is "Needs re-authorization", never "Connected". */
function mailRow(input: { id: string; name: string; detail: string; login: { state: LoginState; email: string }; ready: boolean; connectedNote: string; readyNote: string; missingNote: string; startUrl: string }): ConnectorRow {
  const { state } = input.login;
  const label = state === "connected" ? "Connected" : state === "unverified" ? "Connected, couldn't verify just now" : state === "needs_reauth" ? "Needs re-authorization" : "Not connected";
  const note = state === "connected" ? input.connectedNote
    : state === "unverified" ? `${input.name} didn't answer the check just now, so the sign-in couldn't be confirmed. ${input.connectedNote}`
    : state === "needs_reauth" ? `${input.name} rejected the saved sign-in, so Copilot can't read it right now. Click Connect to sign in again, or Disconnect to clear it.`
    : input.ready ? input.readyNote : input.missingNote;
  return {
    id: input.id,
    name: input.name,
    detail: input.detail,
    status: state === "connected" || state === "unverified" ? "connected" : "not_connected",
    statusLabel: label,
    note,
    ...(input.ready ? { connectUrl: input.startUrl } : {}),
    canDisconnect: state !== "not_connected",
    ...(state !== "not_connected" ? { checked: "live" as const, checkedAt: loginCheckedAt(input.id as "gmail" | "outlook") } : {}),
  };
}

/** AirROI: the key is checked with AirROI (kept six hours). A refused key reads "Needs re-authorization", never "Connected". */
function airroiRow(state: LoginState): ConnectorRow {
  const label = state === "connected" ? "Connected" : state === "unverified" ? "Connected, couldn't verify just now" : state === "needs_reauth" ? "Needs re-authorization" : "Not connected";
  return {
    id: "airroi",
    name: "AirROI",
    detail: "Market comps and rates for the units.",
    status: state === "connected" || state === "unverified" ? "connected" : "not_connected",
    statusLabel: label,
    note: state === "connected" ? "The agent can pull comparable listings and nightly rates for a unit, in the unit's own currency."
      : state === "needs_reauth" ? "AirROI refused the saved key. Put a new key in AIRROI_API_KEY on the server."
      : state === "unverified" ? "AirROI didn't answer the check just now, so the key couldn't be confirmed."
      : "AIRROI_API_KEY isn't set on the server.",
    ...(state === "connected" || state === "needs_reauth" || state === "unverified" ? { checked: "live" as const, checkedAt: loginCheckedAt("airroi") } : {}),
  };
}

export async function connectorRows(skills?: SkillRow[]): Promise<ConnectorRow[]> {
  const rows = skills ?? (await skillRows().catch(() => []));
  const readsGuests = rows.some(
    (skill) =>
      skill.enabled &&
      runsOnItsOwn(skill) &&
      skill.lastRun?.status === "ok" &&
      skill.lastRun.result?.tools.some((tool) => HOSPITABLE_TOOLS.includes(tool)),
  );
  const [hospitable, gmail, outlook, airroiLogin] = await Promise.all([
    hospitableCard().catch(() => null),
    gmailStatus().catch(() => ({ state: "unverified" as LoginState, email: "" })),
    outlookStatus().catch(() => ({ state: "unverified" as LoginState, email: "" })),
    airroiStatus().catch(() => ({ state: "unverified" as LoginState })),
  ]);
  const gmailReady = gmailKeysReady();
  const outlookReady = outlookKeysReady();
  const cleaner = cleanerWebhookReady();
  const twilio = twilioReady();
  return [
    mailRow({
      id: "gmail",
      name: "Gmail",
      detail: "Reads Sent and Primary, and drafts a reply when you ask.",
      login: gmail,
      ready: gmailReady,
      connectedNote: "Searches Sent and Primary. Social and Promotions stay out. A reply sends only after you press Submit.",
      readyNote: "Click Connect and allow reading and sending. A reply still waits for Submit.",
      missingNote: "The Gmail sign-in is not on the server yet.",
      startUrl: "/api/admin/gmail/start",
    }),
    mailRow({
      id: "outlook",
      name: "Outlook",
      detail: "Reads Sent and Focused, and drafts a reply when you ask.",
      login: outlook,
      ready: outlookReady,
      connectedNote: "Searches Sent and the Focused inbox. Other stays out. A reply sends only after you press Submit.",
      readyNote: "Click Connect and sign in as the company mailbox. A reply still waits for Submit.",
      missingNote: "The Outlook sign-in is not on the server yet.",
      startUrl: "/api/admin/outlook/start",
    }),
    {
      id: "hospitable",
      name: "Hospitable",
      detail: "Lets Copilot read your stays in Hospitable. It never changes anything there.",
      status: hospitable?.connected ? "connected" : "not_connected",
      ...(hospitable?.connected ? { checked: "live" as const } : {}),
      statusLabel: hospitable?.connected
        ? hospitable.choiceSaved
          ? `Connected · ${hospitable.chosenCount} in Copilot`
          : `Connected${(hospitable.properties?.length ?? 0) ? ` · ${hospitable.properties.length} ${hospitable.properties.length === 1 ? "property" : "properties"}` : ""}`
        : "Not connected",
      setup: hospitable?.connected ? "pat" : "none",
      note: hospitable?.connected
        ? readsGuests
          ? "Reservations, guest messages, and the Knowledge Hub. A reply waits until you press Submit in Guest messaging."
          : "Reservations, guest messages, and the Knowledge Hub. Nothing in Hospitable changes from here."
        : "Hospitable is not connected.",
    },
    {
      id: "cleaner",
      name: "Cleaner app",
      detail: "Calendar, assignments, issues, inventory.",
      status: cleaner ? "connected" : "not_connected",
      statusLabel: cleaner ? "Connected" : "Not connected",
      ...(cleaner ? { checked: "configured" as const } : {}),
      note: cleaner
        ? "Pings Copilot when a clean is done."
        : "Turnovers still open tasks in OPS. A live calendar read is next.",
    },
    {
      id: "twilio",
      name: "Twilio",
      detail: "Texts the numbers you set.",
      status: twilio ? "connected" : "not_connected",
      statusLabel: twilio ? "Connected" : "Not connected",
      ...(twilio ? { checked: "configured" as const } : {}),
      note: twilio ? "It texts you. It does not text guests." : "Twilio keys are not set on the server.",
    },
    airroiRow(airroiLogin.state),
    {
      id: "browser",
      name: "Browser",
      detail: "Looks things up on the web when you ask.",
      status: process.env.BROWSERBASE_API_KEY?.trim() ? "connected" : "not_connected",
      statusLabel: process.env.BROWSERBASE_API_KEY?.trim() ? "On" : "Not connected",
      ...(process.env.BROWSERBASE_API_KEY?.trim() ? { checked: "configured" as const } : {}),
      note: process.env.BROWSERBASE_API_KEY?.trim() ? "A lookup stays in chat until you watch, pause, or end it." : "Browser is not connected.",
    },
    {
      id: "ops",
      name: "OPS",
      detail: "Property records and the operations tools in this app.",
      status: "connected",
      statusLabel: "On",
      note: "Copilot reads OPS here. It does not use the Hospitable token stored for Copilot.",
    },
  ];
}

