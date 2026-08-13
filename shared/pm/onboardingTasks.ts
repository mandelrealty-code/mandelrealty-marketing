/** OPS setup tasks created when a host signs their portal agreement. */

import { getSupabaseAdmin } from "../supabase.js";
import { createPmTask } from "./taskStore.js";

export const ONBOARDING_KEYS = {
  airbnb: "onboarding:connect_airbnb",
  calendar: "onboarding:link_calendar",
  terms: "onboarding:confirm_terms",
} as const;

type OnboardingKey = (typeof ONBOARDING_KEYS)[keyof typeof ONBOARDING_KEYS];

function db() {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  return sb;
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function detailFor(key: OnboardingKey, body: string): string {
  return `[${key}]\n${body}`;
}

async function existingKeys(clientId: string): Promise<Set<string>> {
  const { data, error } = await db()
    .from("pm_tasks")
    .select("detail")
    .eq("client_id", clientId);
  if (error) {
    if (/pm_tasks|relation/i.test(error.message || "")) return new Set();
    throw error;
  }
  const keys = new Set<string>();
  for (const row of data ?? []) {
    const detail = String((row as { detail?: string }).detail || "");
    const match = detail.match(/^\[(onboarding:[a-z_]+)\]/);
    if (match?.[1]) keys.add(match[1]);
  }
  return keys;
}

/** Create Airbnb / calendar / terms tasks once per client after they sign. */
export async function createOnboardingTasks(input: {
  clientId: string;
  clientName: string;
  propertyId?: string | null;
}): Promise<void> {
  const name = input.clientName.trim() || "this host";
  const have = await existingKeys(input.clientId);
  const specs: Array<{
    key: OnboardingKey;
    title: string;
    body: string;
    due: string;
  }> = [
    {
      key: ONBOARDING_KEYS.airbnb,
      title: `Connect Airbnb for ${name}`,
      body: "Invite the host as co-host / request listing access so we can manage the unit.",
      due: addDaysIso(3),
    },
    {
      key: ONBOARDING_KEYS.calendar,
      title: `Link listing calendar for ${name}`,
      body: "Import the unit from Hospitable in Clients → Properties so earnings can unlock.",
      due: addDaysIso(7),
    },
    {
      key: ONBOARDING_KEYS.terms,
      title: `Confirm commission terms for ${name}`,
      body: "Confirm management % and HST mode on the property before the first statement.",
      due: addDaysIso(10),
    },
  ];

  for (const spec of specs) {
    if (have.has(spec.key)) continue;
    await createPmTask({
      title: spec.title,
      detail: detailFor(spec.key, spec.body),
      status: spec.key === ONBOARDING_KEYS.airbnb ? "in_progress" : "open",
      priority: "high",
      due_on: spec.due,
      property_id: input.propertyId || null,
      client_id: input.clientId,
      task_type: "owner",
      created_by: "portal",
    });
  }
}

/** Mark setup tasks done when the listing is linked / synced. */
export async function completeOnboardingTasks(input: {
  clientId: string;
  listingLinked: boolean;
  calendarSynced: boolean;
}): Promise<void> {
  const keys: OnboardingKey[] = [];
  if (input.listingLinked) keys.push(ONBOARDING_KEYS.airbnb);
  if (input.calendarSynced) keys.push(ONBOARDING_KEYS.calendar);
  if (!keys.length) return;

  const { data, error } = await db()
    .from("pm_tasks")
    .select("id, detail, status")
    .eq("client_id", input.clientId)
    .in("status", ["open", "in_progress", "blocked"]);
  if (error || !data?.length) return;

  const ids = data
    .filter((row) => {
      const detail = String((row as { detail?: string }).detail || "");
      return keys.some((key) => detail.startsWith(`[${key}]`));
    })
    .map((row) => String((row as { id: string }).id));
  if (!ids.length) return;

  await db()
    .from("pm_tasks")
    .update({ status: "done", updated_at: new Date().toISOString() })
    .in("id", ids);
}
