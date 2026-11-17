/**
 * Create a test unit through addUnit with a fake DB, assert no email is sent, then archive it.
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const storeSrc = readFileSync(join(root, "shared/pm/onboardingStore.ts"), "utf8");
const addUnitBody = storeSrc.slice(storeSrc.indexOf("export async function addUnit"), storeSrc.indexOf("export async function toggleTask"));
if (addUnitBody.includes("notifyAssignees(") || addUnitBody.includes("sendTaskAssignedEmail")) {
  throw new Error("addUnit still emails assignees");
}
const appSrc = readFileSync(join(root, "src/pages/onboarding/OnboardingApp.tsx"), "utf8");
if (appSrc.includes("Emailed") || appSrc.includes("onNote")) {
  throw new Error("Emailed banner still present in OnboardingApp");
}

// Runtime create + archive with in-memory fake, email spy via global hook on staffEmails
const units = new Map<string, Record<string, unknown>>();
const tasks: Record<string, unknown>[] = [];
const stages: Record<string, unknown>[] = [];
const history: Record<string, unknown>[] = [];
let emailCalls = 0;

function thenable<T>(data: T) {
  const p = Promise.resolve({ data, error: null });
  return Object.assign(p, {
    maybeSingle: () => p,
    single: () => p,
    select: () => thenable(data),
    order: () => thenable(data),
    limit: () => thenable(data),
    eq: () => thenable(data),
  });
}

function from(table: string) {
  const ctx: { op: string; payload?: unknown; filters: Record<string, unknown> } = { op: "select", filters: {} };
  const api: Record<string, CallableFunction> = {};
  const exec = async () => {
    if (table === "onboarding_units") {
      if (ctx.op === "insert") {
        const row = { ...(ctx.payload as object), id: crypto.randomUUID() } as Record<string, unknown>;
        units.set(String(row.id), row);
        return { data: row, error: null };
      }
      if (ctx.op === "update") {
        const id = String(ctx.filters.id || "");
        const cur = units.get(id);
        if (cur) Object.assign(cur, ctx.payload);
        return { data: cur ?? null, error: null };
      }
      if (ctx.filters.id) return { data: units.get(String(ctx.filters.id)) ?? null, error: null };
      return { data: [...units.values()], error: null };
    }
    if (table === "onboarding_unit_stages") {
      if (ctx.op === "upsert") {
        stages.push(...((ctx.payload as Record<string, unknown>[]) || []));
        return { data: ctx.payload, error: null };
      }
      return { data: stages.filter((s) => !ctx.filters.unit_id || s.unit_id === ctx.filters.unit_id), error: null };
    }
    if (table === "onboarding_task_templates") {
      return {
        data: [
          { stage: "Audit", label: "Schedule onboarder visit 1", default_type: "partner", sort: 10 },
          { stage: "App Setup", label: "Schedule onboarder visit 2", default_type: "partner", sort: 10 },
          { stage: "Software", label: "Airbnb setup", default_type: "partner", sort: 10 },
          { stage: "Live", label: "Record live date", default_type: "partner", sort: 10 },
        ],
        error: null,
      };
    }
    if (table === "onboarding_tasks") {
      if (ctx.op === "insert") {
        const rows = Array.isArray(ctx.payload) ? ctx.payload : [ctx.payload];
        tasks.push(...(rows as Record<string, unknown>[]));
        return { data: rows, error: null };
      }
      return { data: tasks, error: null };
    }
    if (table === "onboarding_history") {
      if (ctx.op === "insert") {
        history.push(ctx.payload as Record<string, unknown>);
        return { data: null, error: null };
      }
      return { data: history, error: null };
    }
    if (table === "onboarding_schedule" && ctx.op === "delete") return { data: null, error: null };
    return { data: null, error: null };
  };
  const wrap = () => {
    const p = exec();
    return Object.assign(p, {
      maybeSingle: () => p,
      single: () => p,
    });
  };
  api.select = () => api;
  api.insert = (payload: unknown) => ((ctx.op = "insert"), (ctx.payload = payload), api);
  api.update = (payload: unknown) => ((ctx.op = "update"), (ctx.payload = payload), api);
  api.upsert = (payload: unknown) => ((ctx.op = "upsert"), (ctx.payload = payload), api);
  api.delete = () => ((ctx.op = "delete"), api);
  api.eq = (k: string, v: unknown) => ((ctx.filters[k] = v), api);
  api.order = () => api;
  api.limit = () => api;
  api.maybeSingle = wrap;
  api.single = wrap;
  (api as { then: typeof Promise.prototype.then }).then = (onFulfilled, onRejected) => wrap().then(onFulfilled, onRejected);
  return api;
}

// Register lightweight ESM mocks via node --import style: patch process.env and inject via global
(globalThis as { __MRG_TEST_SB?: unknown }).__MRG_TEST_SB = { from };
(globalThis as { __MRG_TEST_EMAIL?: () => void }).__MRG_TEST_EMAIL = () => {
  emailCalls += 1;
  throw new Error("email must not send on create");
};

// Patch getSupabaseAdmin / team / staff / email by rewriting import targets is hard in ESM.
// Instead: call the store functions after temporarily monkeypatching via createRequire CJS interop for supabase only.
const require = createRequire(import.meta.url);

const supabasePath = require.resolve("../shared/supabase.ts");
require.cache[supabasePath] = {
  id: supabasePath,
  filename: supabasePath,
  loaded: true,
  exports: {
    getSupabaseAdmin: () => ({ from }),
    isSupabaseConfigured: () => true,
  },
} as NodeModule;

const teamPath = require.resolve("../shared/pm/teamStore.ts");
require.cache[teamPath] = {
  id: teamPath,
  filename: teamPath,
  loaded: true,
  exports: {
    listPmTeamMembers: async () => [{ id: "1", name: "Shane Mosoff", staff_type: "partner" }],
  },
} as NodeModule;

const staffUserPath = require.resolve("../shared/pm/staffUserStore.ts");
require.cache[staffUserPath] = {
  id: staffUserPath,
  filename: staffUserPath,
  loaded: true,
  exports: {
    listStaffUsers: async () => [
      { active: true, display_name: "Shane Mosoff", email: "real-person@example.com", first_name: "Shane", slug: "shane" },
    ],
  },
} as NodeModule;

const staffEmailsPath = require.resolve("../shared/staffEmails.ts");
const real = require(staffEmailsPath);
require.cache[staffEmailsPath] = {
  id: staffEmailsPath,
  filename: staffEmailsPath,
  loaded: true,
  exports: {
    ...real,
    sendTaskAssignedEmail: async () => {
      emailCalls += 1;
      throw new Error("email must not send on create");
    },
  },
} as NodeModule;

// Force a fresh load of the store under the mocks (CJS path). Prefer compiling via tsx require.
const storePath = join(root, "shared/pm/onboardingStore.ts");
delete require.cache[require.resolve(storePath)];
const store = require(storePath) as typeof import("../shared/pm/onboardingStore.ts");

const address = `Test NoEmail - ${Date.now()} Test St`;
const made = await store.addUnit(
  {
    address,
    type: "1 Bed",
    owner: "Test Owner",
    assignee: "Shane Mosoff",
    plan: "Essentials",
    furniture: "none",
  },
  "2026-11-16",
);

if (emailCalls !== 0) throw new Error(`email sent (${emailCalls})`);
if (made.notified.emailed.length || made.notified.failed.length || made.notified.noLogin.length) {
  throw new Error("unexpected notified: " + JSON.stringify(made.notified));
}
if (!units.has(made.id)) throw new Error("unit missing after create");

await store.archiveUnit(made.id, "Admin");
if (units.get(made.id)?.archived !== true) throw new Error("archive failed");

console.log("VERIFY_OK", { id: made.id, address, emails: emailCalls, history: history.map((h) => h.action) });
void pathToFileURL;
void thenable;
