import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  clearStaffSessionCookie,
  cookieShouldBeSecure,
  createStaffSessionToken,
  getStaffSessionFromRequest,
  staffSessionCookie,
  verifyPassword,
  verifyStaffSessionToken,
} from "./staffAuth.js";
import {
  getStaffUserById,
  getStaffUserBySlug,
  staffUserForEmployee,
  setStaffPassword,
  touchStaffLogin,
  type StaffUser,
} from "./pm/staffUserStore.js";
import {
  listPmTasks,
  getPmTask,
  updatePmTask,
  type TaskStatus,
  type PmTask,
} from "./pm/taskStore.js";
import {
  createTimeEntry,
  deleteTimeEntry,
  listTimeEntriesForStaff,
  sumHoursThisWeek,
  weekStartIso,
} from "./pm/timeEntryStore.js";
import { isSupabaseConfigured } from "./supabase.js";
import {
  OutreachDraftError,
  draftFirstOutreach,
  draftOutreachReply,
  draftReadyClose,
} from "./pm/outreachDraft.js";
import {
  autoSaveReplyOutcome,
  findOutcomesByListingUrl,
} from "./pm/outreachOutcomeStore.js";
import { extractAirbnbRoomId } from "./airbnbListingUrl.js";

function readBody(req: VercelRequest): Record<string, unknown> {
  const raw = req.body;
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return raw as Record<string, unknown>;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function opOf(req: VercelRequest, body: Record<string, unknown>): string {
  if (typeof body.op === "string" && body.op.trim()) return body.op.trim();
  if (typeof req.query.op === "string" && req.query.op.trim()) return req.query.op.trim();
  return "";
}

const STATUSES = new Set<TaskStatus>([
  "open",
  "in_progress",
  "blocked",
  "done",
]);

function publicTask(t: PmTask) {
  return {
    id: t.id,
    title: t.title,
    detail: t.detail,
    status: t.status,
    priority: t.priority,
    due_on: t.due_on,
    task_type: t.task_type,
    property_name: t.property_name || "",
    updated_at: t.updated_at,
  };
}

function nameMatchesAssignee(displayName: string, task: PmTask): boolean {
  const needle = displayName.trim().toLowerCase();
  if (!needle) return false;
  return task.assignees.some((a) => a.trim().toLowerCase() === needle);
}

async function tasksForStaff(user: StaffUser, status: "openish" | "all" | "done") {
  const all = await listPmTasks({
    status: status === "done" ? "done" : status === "all" ? "all" : "openish",
    assignee: user.display_name,
  });
  return all.filter((t) => nameMatchesAssignee(user.display_name, t));
}

async function staffBootstrapPublic(slug: string) {
  const user = await getStaffUserBySlug(slug);
  if (!user || !user.active) return null;
  // Unauthenticated: never leak email, ids, or login timestamps
  return {
    user: {
      slug: user.slug,
      first_name: user.first_name,
    },
  };
}

async function staffBootstrapAuthed(user: StaffUser) {
  return { user: staffUserForEmployee(user) };
}

async function requireStaff(
  req: VercelRequest,
  res: VercelResponse,
): Promise<StaffUser | null> {
  const token = getStaffSessionFromRequest(req.headers.cookie);
  const session = verifyStaffSessionToken(token);
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  const user = await getStaffUserById(session.userId);
  if (!user || !user.active) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return user;
}

export default async function handleTeam(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: "Supabase is not configured." });
  }

  const body = readBody(req);
  const op = opOf(req, body);
  const secure = cookieShouldBeSecure(req);

  try {
    if (req.method === "GET") {
      if (op === "bootstrap" || !op) {
        const slug = str(req.query.slug);
        if (!slug) return res.status(400).json({ error: "slug required." });
        const pub = await staffBootstrapPublic(slug);
        if (!pub) return res.status(404).json({ error: "Team portal not found." });

        const token = getStaffSessionFromRequest(req.headers.cookie);
        const session = verifyStaffSessionToken(token);
        if (session) {
          const user = await getStaffUserById(session.userId);
          if (user && user.active && user.slug === pub.user.slug) {
            return res.status(200).json({
              ...(await staffBootstrapAuthed(user)),
              session: {
                authenticated: true,
                must_change_password: user.must_change_password,
              },
            });
          }
        }

        return res.status(200).json({
          ...pub,
          session: { authenticated: false, must_change_password: false },
        });
      }

      if (op === "tasks") {
        const user = await requireStaff(req, res);
        if (!user) return;
        const statusRaw = str(req.query.status) || "openish";
        const status =
          statusRaw === "all" || statusRaw === "done" ? statusRaw : "openish";
        const tasks = await tasksForStaff(user, status);
        return res.status(200).json({ tasks: tasks.map(publicTask) });
      }

      if (op === "hours") {
        const user = await requireStaff(req, res);
        if (!user) return;
        const entries = await listTimeEntriesForStaff(user.id);
        const weekStart = weekStartIso();
        return res.status(200).json({
          entries,
          week_start: weekStart,
          week_hours: sumHoursThisWeek(entries, weekStart),
        });
      }

      return res.status(404).json({ error: "Unknown op." });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed." });
    }

    if (op === "login") {
      const slug = str(body.slug);
      const email = str(body.email).toLowerCase();
      const password = typeof body.password === "string" ? body.password.trim() : "";
      if (!slug || !email || !password) {
        return res.status(400).json({ error: "slug, email, and password required." });
      }
      const user = await getStaffUserBySlug(slug);
      // Constant-ish failure message — do not reveal whether slug/email exists
      if (!user || !user.active || user.email.toLowerCase() !== email) {
        return res.status(401).json({ error: "Invalid email or password." });
      }
      if (!verifyPassword(password, user.password_hash)) {
        return res.status(401).json({ error: "Invalid email or password." });
      }
      await touchStaffLogin(user.id);
      const token = createStaffSessionToken(user.id);
      res.setHeader("Set-Cookie", staffSessionCookie(token, { secure }));
      const payload = await staffBootstrapAuthed(user);
      return res.status(200).json({
        ok: true,
        user: staffUserForEmployee(user),
        must_change_password: user.must_change_password,
        bootstrap: payload,
      });
    }

    if (op === "logout") {
      res.setHeader("Set-Cookie", clearStaffSessionCookie({ secure }));
      return res.status(200).json({ ok: true });
    }

    if (op === "set_password") {
      const user = await requireStaff(req, res);
      if (!user) return;
      const password = typeof body.password === "string" ? body.password : "";
      const confirm = typeof body.confirm === "string" ? body.confirm : password;
      if (password !== confirm) {
        return res.status(400).json({ error: "Passwords do not match." });
      }
      const updated = await setStaffPassword(user.id, password);
      return res.status(200).json({ ok: true, user: staffUserForEmployee(updated) });
    }

    if (op === "update_task") {
      const user = await requireStaff(req, res);
      if (!user) return;
      if (user.must_change_password) {
        return res.status(400).json({ error: "Set your password first." });
      }
      const id = str(body.id);
      if (!id) return res.status(400).json({ error: "id required." });
      const existing = await getPmTask(id);
      if (!existing || !nameMatchesAssignee(user.display_name, existing)) {
        return res.status(403).json({ error: "Not allowed." });
      }
      const statusRaw = str(body.status) as TaskStatus;
      if (!STATUSES.has(statusRaw)) {
        return res.status(400).json({ error: "Invalid status." });
      }
      const note = str(body.note);
      const patch: { status: TaskStatus; detail?: string } = { status: statusRaw };
      if (note) {
        const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
        const line = `[${stamp} · ${user.display_name}] ${note}`;
        patch.detail = existing.detail
          ? `${existing.detail.trim()}\n\n${line}`
          : line;
      }
      const task = await updatePmTask(id, patch);
      return res.status(200).json({ task: publicTask(task) });
    }

    if (op === "log_hours") {
      const user = await requireStaff(req, res);
      if (!user) return;
      if (user.must_change_password) {
        return res.status(400).json({ error: "Set your password first." });
      }
      let taskId = str(body.task_id) || null;
      if (taskId) {
        const task = await getPmTask(taskId);
        if (!task || !nameMatchesAssignee(user.display_name, task)) {
          return res.status(403).json({ error: "Task not assigned to you." });
        }
      }
      let entry;
      try {
        entry = await createTimeEntry({
          staff_user_id: user.id,
          started_at: str(body.started_at) || str(body.start_at),
          ended_at: str(body.ended_at) || str(body.end_at),
          work_date: str(body.work_date),
          note: str(body.note),
          task_id: taskId,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (
          /required|after start|48 hours|1 minute|Time range columns missing/i.test(
            msg,
          )
        ) {
          return res.status(400).json({ error: msg });
        }
        throw e;
      }
      const entries = await listTimeEntriesForStaff(user.id);
      const weekStart = weekStartIso();
      return res.status(200).json({
        entry,
        entries,
        week_start: weekStart,
        week_hours: sumHoursThisWeek(entries, weekStart),
      });
    }

    if (op === "delete_hours") {
      const user = await requireStaff(req, res);
      if (!user) return;
      const id = str(body.id);
      if (!id) return res.status(400).json({ error: "id required." });
      await deleteTimeEntry(id, user.id);
      const entries = await listTimeEntriesForStaff(user.id);
      const weekStart = weekStartIso();
      return res.status(200).json({
        ok: true,
        entries,
        week_start: weekStart,
        week_hours: sumHoursThisWeek(entries, weekStart),
      });
    }

    if (op === "check_listing_url") {
      const user = await requireStaff(req, res);
      if (!user) return;
      const listing_url = str(body.listing_url);
      const room_id = extractAirbnbRoomId(listing_url);
      if (!listing_url || !room_id) {
        return res.status(200).json({ room_id: null, matches: [] });
      }
      const matches = await findOutcomesByListingUrl({ listing_url });
      return res.status(200).json({ room_id, matches });
    }

    if (op === "draft_outreach" || op === "draft_outreach_reply") {
      const user = await requireStaff(req, res);
      if (!user) return;
      if (user.must_change_password) {
        return res.status(400).json({ error: "Set your password first." });
      }

      const issues = Array.isArray(body.issues)
        ? (body.issues as unknown[])
            .filter((x): x is string => typeof x === "string")
            .map((x) => x.trim())
            .filter(Boolean)
        : str(body.issues)
          ? str(body.issues)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [];

      const listing = {
        host_name: str(body.host_name),
        neighborhood: str(body.neighborhood),
        star_rating: str(body.star_rating),
        listing_url: str(body.listing_url),
        issues,
        notes: str(body.notes),
        bad_reviews: str(body.bad_reviews),
      };

      try {
        if (op === "draft_outreach_reply") {
          const result = await draftOutreachReply({
            ...listing,
            thread: str(body.thread) || str(body.reply),
            first_message: str(body.first_message),
            reply_note: str(body.reply_note),
            staff_user_id: user.id,
          });
          return res.status(200).json({
            message: result.message,
            learned_outcome: result.learned_outcome ?? null,
            learning_saved: Boolean(result.learning_saved),
          });
        }
        const intent = str(body.intent);
        const rejectedRaw = Array.isArray(body.rejected_messages)
          ? (body.rejected_messages as unknown[])
              .filter((x): x is string => typeof x === "string")
              .map((x) => x.trim())
              .filter(Boolean)
          : str(body.rejected_message)
            ? [str(body.rejected_message)]
            : [];
        if (intent === "close") {
          const message = await draftReadyClose({
            ...listing,
            thread: str(body.thread) || str(body.reply),
            first_message: str(body.first_message),
            reply_note: str(body.reply_note),
            staff_user_id: user.id,
          });
          return res.status(200).json({ message, close: true });
        }
        const message = await draftFirstOutreach({
          ...listing,
          rejected_messages: rejectedRaw,
          staff_user_id: user.id,
        });
        if (intent === "rewrite" && rejectedRaw[0]) {
          const saved = await autoSaveReplyOutcome({
            staff_user_id: user.id,
            ...listing,
            first_message: rejectedRaw[rejectedRaw.length - 1],
            follow_up_message: message,
            thread_snippet: "",
            outcome: "airbnb_rejected",
            outcome_note: "Airbnb blocked previous draft",
          });
          return res.status(200).json({
            message,
            learned_outcome: "airbnb_rejected",
            learning_saved: saved.saved,
          });
        }
        return res.status(200).json({ message });
      } catch (aiErr) {
        if (aiErr instanceof OutreachDraftError) {
          return res.status(aiErr.status).json({ error: aiErr.message });
        }
        console.error("[teamApi/draft_outreach]", aiErr);
        return res.status(502).json({ error: "AI service unavailable." });
      }
    }

    return res.status(404).json({ error: "Unknown op." });
  } catch (e) {
    console.error("[teamApi]", e instanceof Error ? e.message : e);
    return res.status(500).json({ error: "Request failed." });
  }
}
