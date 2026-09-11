/**
 * Phase 2 ops workflow helpers: create VA tasks from reviews, supply, turnover signals.
 * Cross-app events should eventually call these with hospitablePropertyId resolved to Admin id.
 */
import { getSupabaseAdmin } from "../supabase.js";
import { createPmTask, listPmTasks, type PmTask } from "./taskStore.js";

function db() {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  return sb;
}

function yearMonthNow(): string {
  return new Date().toISOString().slice(0, 7);
}

async function findOpenTaskByTitlePrefix(
  propertyId: string,
  titlePrefix: string,
): Promise<PmTask | null> {
  const tasks = await listPmTasks({ status: "openish" });
  return (
    tasks.find(
      (t) =>
        t.property_id === propertyId &&
        t.title.toLowerCase().startsWith(titlePrefix.toLowerCase()),
    ) ?? null
  );
}

/** Create open tasks for cached reviews at or below maxStars (default 4). Dedupes by review id in title. */
export async function ensureNegativeReviewTasks(input?: {
  propertyId?: string;
  maxStars?: number;
}): Promise<{ created: number; skipped: number; tasks: PmTask[] }> {
  const maxStars = input?.maxStars ?? 4;
  let q = db()
    .from("pm_reviews")
    .select(
      "id, property_id, hospitable_review_id, rating, public_review, guest_first_name, reviewed_at",
    )
    .not("rating", "is", null)
    .lte("rating", maxStars)
    .order("reviewed_at", { ascending: false })
    .limit(200);
  if (input?.propertyId) q = q.eq("property_id", input.propertyId);
  const { data, error } = await q;
  if (error) {
    if (/pm_reviews|relation/i.test(error.message || "")) {
      return { created: 0, skipped: 0, tasks: [] };
    }
    throw error;
  }

  const createdTasks: PmTask[] = [];
  let created = 0;
  let skipped = 0;

  for (const row of data || []) {
    const propertyId = String(row.property_id || "");
    if (!propertyId) {
      skipped += 1;
      continue;
    }
    const reviewKey = String(row.hospitable_review_id || row.id || "").slice(0, 12);
    const title = `Review dispute · ${reviewKey}`;
    const existing = await findOpenTaskByTitlePrefix(propertyId, title);
    if (existing) {
      skipped += 1;
      continue;
    }
    const rating = Number(row.rating);
    const guest = String(row.guest_first_name || "Guest").trim() || "Guest";
    const snippet = String(row.public_review || "").trim().slice(0, 280);
    const task = await createPmTask({
      title,
      detail: [
        `${rating}★ from ${guest}.`,
        snippet ? `“${snippet}”` : "",
        "VA: flag for team, draft dispute or recovery reply.",
      ]
        .filter(Boolean)
        .join("\n"),
      status: "open",
      priority: "high",
      property_id: propertyId,
      year_month: yearMonthNow(),
      task_type: "owner",
      created_by: "ops-workflow",
    });
    createdTasks.push(task);
    created += 1;
  }

  return { created, skipped, tasks: createdTasks };
}

/** VA supply reorder task when inventory is low (called from Cleaner Hub or Admin). */
export async function ensureSupplyReorderTask(input: {
  propertyId: string;
  itemName: string;
  detail?: string;
}): Promise<PmTask> {
  const item = (input.itemName || "Supply").trim() || "Supply";
  const title = `Reorder · ${item}`;
  const existing = await findOpenTaskByTitlePrefix(input.propertyId, title);
  if (existing) return existing;
  return createPmTask({
    title,
    detail:
      input.detail?.trim() ||
      `Inventory low for ${item}. Place Amazon order, mark shipped in Cleaner Hub, notify cleaner to restock.`,
    status: "open",
    priority: "normal",
    property_id: input.propertyId,
    year_month: yearMonthNow(),
    task_type: "supplies",
    created_by: "ops-workflow",
  });
}

/** VA QA after cleaner turnover completes. */
export async function ensureTurnoverQaTask(input: {
  propertyId: string;
  cleaningTaskId?: string;
  detail?: string;
}): Promise<PmTask> {
  const suffix = input.cleaningTaskId
    ? input.cleaningTaskId.slice(0, 8)
    : new Date().toISOString().slice(0, 10);
  const title = `Turnover QA · ${suffix}`;
  const existing = await findOpenTaskByTitlePrefix(input.propertyId, title);
  if (existing) return existing;
  return createPmTask({
    title,
    detail:
      input.detail?.trim() ||
      "Review cleaner photos, inventory counts, and maintenance flags. Approve or open a maintenance task.",
    status: "open",
    priority: "normal",
    property_id: input.propertyId,
    year_month: yearMonthNow(),
    task_type: "cleaning",
    created_by: "ops-workflow",
  });
}
