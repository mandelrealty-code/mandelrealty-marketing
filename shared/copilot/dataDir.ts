/**
 * Vercel and Lambda keep the deployment at /var/task, which cannot be created into.
 * Reports and the local chat file go under the temp directory there.
 * Elsewhere they go under data/, which is created on save when it is missing.
 */

import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export function readOnlyRuntime(): boolean {
  if (process.env.VERCEL) return true;
  if (process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT || process.env.AWS_EXECUTION_ENV) return true;
  return isTaskPath(process.cwd());
}

export function tempDataDir(): string {
  return safeTemp(path.join(tmpdir(), "mrg-copilot", "data"));
}

let testDir = "";

export function runtimeDataDir(): string {
  const temp = tempDataDir();
  if (readOnlyRuntime()) return temp;
  // Test runs never share state through the local file: each process gets its own empty folder, so a suite can't pass or fail on what an earlier run left.
  if (process.env.COPILOT_PARITY === "1") {
    if (!testDir) testDir = mkdtempSync(path.join(tmpdir(), "mrg-parity-"));
    return testDir;
  }
  const local = path.join(process.cwd(), "data");
  if (isTaskPath(local)) return temp;
  return local;
}

export function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

function isTaskPath(dir: string): boolean {
  const resolved = path.resolve(dir);
  return resolved === "/var/task" || resolved.startsWith(`${path.sep}var${path.sep}task${path.sep}`) || resolved.startsWith("/var/task/");
}

function safeTemp(dir: string): string {
  if (!isTaskPath(dir)) return dir;
  return path.join("/tmp", "mrg-copilot", "data");
}
