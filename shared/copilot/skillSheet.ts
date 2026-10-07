import { createSign } from "node:crypto";
import { parityEnabled } from "./parity/flag.js";

const sheets = new Map<string, string[][]>();

export function installSheet(id: string, rows: string[][]): void {
  sheets.set(sheetIdOf(id), rows.map((row) => row.slice()));
}

export function resetSheets(): void {
  sheets.clear();
}

export function sheetIdOf(linkOrId: string): string {
  const match = linkOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return (match ? match[1] : linkOrId).trim();
}

export async function readSheet(linkOrId: string): Promise<{ id: string; rows: string[][] } | { error: string }> {
  const id = sheetIdOf(linkOrId);
  if (!id) return { error: "A sheet link or id is required." };
  if (parityEnabled()) {
    const rows = sheets.get(id);
    if (!rows) return { error: "That sheet is not in the test workbook." };
    return { id, rows: rows.map((row) => row.slice()) };
  }
  return liveRead(id);
}

export async function writeSheet(linkOrId: string, row: string[]): Promise<{ id: string; rows: string[][] } | { error: string }> {
  const id = sheetIdOf(linkOrId);
  if (!id) return { error: "A sheet link or id is required." };
  const next = row.map((cell) => String(cell ?? "").slice(0, 500)).slice(0, 26);
  if (!next.some((cell) => cell.trim())) return { error: "The row was empty, so the sheet was not changed." };
  if (parityEnabled()) {
    const rows = sheets.get(id) ?? [];
    rows.push(next);
    sheets.set(id, rows);
    return { id, rows: rows.map((item) => item.slice()) };
  }
  return liveWrite(id, next);
}

async function sheetsToken(): Promise<string | { error: string }> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return { error: "Google Sheets is not connected, so that sheet was not changed." };
  let creds: { client_email?: string; private_key?: string };
  try {
    creds = JSON.parse(raw) as { client_email?: string; private_key?: string };
  } catch {
    return { error: "Google Sheets is not connected, so that sheet was not changed." };
  }
  if (!creds.client_email || !creds.private_key) return { error: "Google Sheets is not connected, so that sheet was not changed." };
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const claim = Buffer.from(JSON.stringify({
    iss: creds.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })).toString("base64url");
  const sign = createSign("RSA-SHA256");
  sign.update(`${header}.${claim}`);
  const assertion = `${header}.${claim}.${sign.sign(creds.private_key).toString("base64url")}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string };
  if (!res.ok || !data.access_token) return { error: "Google Sheets is not connected, so that sheet was not changed." };
  return data.access_token;
}

async function liveRead(id: string): Promise<{ id: string; rows: string[][] } | { error: string }> {
  const token = await sheetsToken();
  if (typeof token !== "string") return token;
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values/A1:Z200`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { error: "That sheet could not be read. Nothing was changed." };
  const data = (await res.json().catch(() => ({}))) as { values?: unknown };
  const rows = Array.isArray(data.values) ? data.values.map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? "")) : [])) : [];
  return { id, rows };
}

async function liveWrite(id: string, row: string[]): Promise<{ id: string; rows: string[][] } | { error: string }> {
  const token = await sheetsToken();
  if (typeof token !== "string") return token;
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values/A1:append?valueInputOption=USER_ENTERED`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values: [row] }),
  });
  if (!res.ok) return { error: "That sheet could not be updated. Nothing was changed." };
  return liveRead(id);
}
