/**
 * Every table a migration creates must also declare Row Level Security in the repo, so the files describe the live
 * database. The app reaches these tables only with the service-role key (which bypasses RLS), so tables carry NO policies:
 * the public anon key and signed-in users can't touch them.
 *
 * Add a new table, add its `alter table public.<name> enable row level security;` line, or this fails.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function fail(label: string): never {
  throw new Error(`RLS harness failed: ${label}`);
}

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "supabase");
const files = readdirSync(dir).filter((name) => name.endsWith(".sql")).sort();

const created = new Map<string, string>();
const protectedTables = new Set<string>();
const policies: string[] = [];
const loose: string[] = [];

for (const file of files) {
  const sql = readFileSync(join(dir, file), "utf8").replace(/--.*$/gm, "");
  for (const match of sql.matchAll(/create table (?:if not exists )?(?:public\.)?([a-z_0-9]+)/gi)) created.set(match[1]!.toLowerCase(), file);
  for (const match of sql.matchAll(/alter table (?:if exists )?(?:public\.)?([a-z_0-9]+)\s+enable row level security/gi)) protectedTables.add(match[1]!.toLowerCase());
  for (const match of sql.matchAll(/create policy\s+"?([^"\s]+)"?\s+on\s+(?:public\.)?([a-z_0-9]+)/gi)) policies.push(`${match[2]}: ${match[1]}`);
  for (const match of sql.matchAll(/grant\s+(?:all|select|insert|update|delete)[^;]*\sto\s+(?:anon|authenticated|public)\b/gi)) loose.push(`${file}: ${match[0].slice(0, 60)}`);
}

if (created.size < 50) fail(`only ${created.size} tables found: the migration scan is broken`);
const missing = [...created].filter(([table]) => !protectedTables.has(table)).map(([table, file]) => `${table} (${file})`);
if (missing.length) fail(`tables with no RLS declaration: ${missing.join(", ")}`);
if (policies.length) fail(`a policy now exists, which opens a table to someone: ${policies.join("; ")}. Review it, then allow it here on purpose.`);
if (loose.length) fail(`a migration grants access to anon or authenticated: ${loose.join("; ")}`);

console.log(`RLS harness passed. ${created.size} tables, all with RLS declared, no policies, no public grants.`);
