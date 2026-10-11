/**
 * A generated report stays available so the same file can be downloaded again.
 * Vercel keeps the app at /var/task, so a report is written under the temp directory.
 * Elsewhere it is written under data/, which is created on save when it is missing.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ensureDir, runtimeDataDir, tempDataDir } from "./dataDir.js";
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

const FILE_NAME = "copilot-reports.json";
let memory: StoredReport[] = [];
let seq = 0;
let loaded = false;
let dirOverride: string | null = null;
let chosenDir: string | null = null;
let writeFault = false;

/** The folder a report file is written into. Created on save when it is missing. */
export function reportDirectory(): string {
  if (dirOverride) return dirOverride;
  if (chosenDir) return chosenDir;
  return runtimeDataDir();
}

/** Point the next save at a directory. Pass null to use the runtime default. */
export function useReportDirectory(dir: string | null): void {
  dirOverride = dir;
  chosenDir = null;
  loaded = false;
}

/** The next save throws the production read-only directory error. */
export function failNextReportWrite(): void {
  writeFault = true;
}

export function resetReportStore(): void {
  memory = [];
  seq = 0;
  loaded = true;
  chosenDir = null;
  writeFault = false;
}

export function nextReportSeq(): number {
  load();
  seq += 1;
  return seq;
}

export function rememberReport(report: StoredReport): StoredReport {
  load();
  const previous = memory;
  memory = [report, ...memory.filter((row) => row.id !== report.id)].slice(0, 200);
  try {
    save();
  } catch (err) {
    memory = previous;
    throw err;
  }
  return report;
}

export function findStoredReport(text: string, prior = ""): StoredReport | null {
  load();
  const id = /\b(MRG-\d{4}-[A-Z0-9]+-[A-Z]{2}-\d{3})\b/.exec(`${text}\n${prior}`)?.[1];
  if (id) return memory.find((row) => row.id === id) ?? null;
  if (/\b(download|again)\b/i.test(text) && /\breport\b/i.test(text)) return memory[0] ?? null;
  return null;
}

function storeFile(dir: string): string {
  return path.join(dir, FILE_NAME);
}

function writeStore(dir: string): void {
  ensureDir(dir);
  writeFileSync(storeFile(dir), JSON.stringify({ seq, reports: memory }));
}

function load(): void {
  if (loaded) return;
  loaded = true;
  if (parityEnabled() && !dirOverride) return;
  try {
    const parsed = JSON.parse(readFileSync(storeFile(reportDirectory()), "utf8")) as { seq?: number; reports?: StoredReport[] };
    seq = Number(parsed.seq) || 0;
    memory = Array.isArray(parsed.reports) ? parsed.reports : [];
  } catch {
    memory = [];
    seq = 0;
  }
}

function save(): void {
  if (writeFault) {
    writeFault = false;
    const error = new Error("ENOENT: no such file or directory, mkdir '/var/task/data'");
    (error as NodeJS.ErrnoException).code = "ENOENT";
    throw error;
  }
  if (parityEnabled() && !dirOverride) return;
  const preferred = reportDirectory();
  try {
    writeStore(preferred);
  } catch (err) {
    const fallback = tempDataDir();
    if (dirOverride || path.resolve(preferred) === path.resolve(fallback)) throw err;
    writeStore(fallback);
    chosenDir = fallback;
  }
}
