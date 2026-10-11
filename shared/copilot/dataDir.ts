/**
 * Vercel and Lambda keep the deployment at /var/task, which cannot be created into.
 * Reports and the local chat file go under the temp directory there.
 * Elsewhere they go under data/, which is created on save when it is missing.
 */

import { mkdirSync } from "node:fs";
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

export function runtimeDataDir(): string {
  const temp = tempDataDir();
  if (readOnlyRuntime()) return temp;
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
