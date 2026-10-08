/**
 * Copilot's Hospitable token: a saved token reads a stub, a bad token stays disconnected,
 * and the token value never leaves the server record.
 */

import {
  disconnectHospitable,
  hospitableCard,
  hospitableCipherForTest,
  hospitableRead,
  resetHospitableConnection,
  saveHospitableToken,
  setHospitableProbe,
} from "./hospitableConnection.js";

const GOOD = "copilot-pat-sentinel-value-7Kq2";
const BAD = "copilot-pat-sentinel-value-BAD1";
const ENV = "env-hospitable-pat-should-stay-unused-ZZ9";

function fail(label: string): never {
  throw new Error(`Hospitable connection harness failed: ${label}`);
}

function hides(value: unknown): void {
  const text = JSON.stringify(value);
  if (text.includes(GOOD) || text.includes(BAD) || text.includes(ENV)) fail("a surface included the token");
}

resetHospitableConnection();
process.env.HOSPITABLE_PAT = ENV;
const seen: string[] = [];
setHospitableProbe(async (token, name) => {
  const which = token === GOOD ? "good" : token === BAD ? "bad" : token === ENV ? "env" : "other";
  seen.push(`${name}:${which}`);
  if (which === "bad") throw new Error("rejected");
  if (name === "get-properties") {
    return { data: [{ id: "p1", name: "Charlotte" }, { id: "p2", name: "Shaw" }] };
  }
  if (name === "get-reservations") return { data: [{ id: "r1", property_id: "p1" }] };
  return { data: [] };
});

const rejected = await saveHospitableToken(BAD);
if (rejected.card.connected || rejected.error !== "Hospitable didn't accept this token.") fail("bad token");
if (!rejected.card.statusLine.includes("Not connected")) fail("bad token status");
hides(rejected);
if (hospitableCipherForTest()) fail("bad token was stored");

const saved = await saveHospitableToken(GOOD);
if (!saved.card.connected || saved.error) fail("save");
if (saved.card.last4 !== "7Kq2") fail("last four");
if (saved.card.canRead !== "Reservations, guest messages and the Knowledge Hub, for all 2 properties.") fail("can read");
if (!saved.card.statusLine.startsWith("Working. Last checked")) fail("last checked");
if (saved.card.properties.map((row) => row.name).join(",") !== "Charlotte,Shaw") fail("properties on the page");
if (saved.card.reads.length !== 3 || saved.card.reads.some((row) => row.state !== "Working" || !row.checked)) fail("read capabilities");
if (!saved.card.reads.some((row) => row.name === "Reservations") || !saved.card.reads.some((row) => row.name === "Guest messages") || !saved.card.reads.some((row) => row.name === "Knowledge Hub")) fail("read names");
hides(saved);
const cipher = hospitableCipherForTest();
if (!cipher.startsWith("v1.") || cipher.includes(GOOD)) fail("stored record");

const read = await hospitableRead("get-properties");
const rows = read && typeof read === "object" && Array.isArray((read as { data?: unknown }).data) ? (read as { data: unknown[] }).data : [];
if (rows.length !== 2) fail("properties read");
if (!seen.includes("get-properties:good")) fail("read did not use the saved token");
if (seen.some((line) => line.endsWith(":env"))) fail("read used another token");
hides(read);

const replaced = await saveHospitableToken(BAD);
if (!replaced.card.connected || replaced.error !== "Hospitable didn't accept this token. The current one is still in use.") fail("replace");
hides(replaced);
if (hospitableCipherForTest().includes(BAD) || hospitableCipherForTest().includes(GOOD)) fail("replace stored the token");

const off = await disconnectHospitable();
if (off.connected || off.statusLine !== "Not connected. Add a token to let Copilot read your stays.") fail("disconnect");
hides(off);
let message = "";
try {
  await hospitableRead("get-reservations", { properties: ["p1"] });
} catch (err) {
  message = err instanceof Error ? err.message : "";
}
if (message !== "Hospitable is not connected.") fail("disconnected read");
if (seen.some((line) => line.endsWith(":env"))) fail("disconnected read used another token");
hides(await hospitableCard());

console.log("Hospitable connection harness passed.");
