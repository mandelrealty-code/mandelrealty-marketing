/**
 * A generated report stays available so the same file can be downloaded again.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parityEnabled } from "./parity/flag.js";

export type StoredReport = {
  id: string;
  filename: string;
  mime: string;
  data: string;
  request: string;
  audience: "client" | "internal";
  totalsLine: string;
  createdAt: string;
};

const FILE = path.join(process.cwd(), "data", "copilot-reports.json");
let memory: StoredReport[] = [];
let seq = 0;
let loaded = false;

export function resetReportStore(): void {
  memory = [];
  seq = 0;
  loaded = true;
}

export function nextReportSeq(): number {
  load();
  seq += 1;
  return seq;
}

export function rememberReport(report: StoredReport): StoredReport {
  load();
  memory = [report, ...memory.filter((row) => row.id !== report.id)].slice(0, 200);
  save();
  return report;
}

export function findStoredReport(text: string, prior = ""): StoredReport | null {
  load();
  const id = /\b(MRG-\d{4}-[A-Z0-9]+-[A-Z]{2}-\d{3})\b/.exec(`${text}\n${prior}`)?.[1];
  if (id) return memory.find((row) => row.id === id) ?? null;
  if (/\b(download|again)\b/i.test(text) && /\breport\b/i.test(text)) return memory[0] ?? null;
  return null;
}

function load(): void {
  if (loaded) return;
  loaded = true;
  if (parityEnabled()) return;
  try {
    const parsed = JSON.parse(readFileSync(FILE, "utf8")) as { seq?: number; reports?: StoredReport[] };
    seq = Number(parsed.seq) || 0;
    memory = Array.isArray(parsed.reports) ? parsed.reports : [];
  } catch {
    memory = [];
    seq = 0;
  }
}

function save(): void {
  if (parityEnabled()) return;
  mkdirSync(path.dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify({ seq, reports: memory }));
}
