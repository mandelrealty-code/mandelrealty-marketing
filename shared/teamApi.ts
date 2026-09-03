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
      const password = typeof body.password === "string" ? body.password : "";
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
      const entry = await createTimeEntry({
        staff_user_id: user.id,
        started_at: str(body.started_at) || str(body.start_at),
        ended_at: str(body.ended_at) || str(body.end_at),
        work_date: str(body.work_date),
        note: str(body.note),
        task_id: taskId,
      });
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

    if (op === "draft_outreach") {
      const user = await requireStaff(req, res);
      if (!user) return;
      if (user.must_change_password) {
        return res.status(400).json({ error: "Set your password first." });
      }

      const issues = Array.isArray(body.issues)
        ? (body.issues as unknown[]).filter((x) => typeof x === "string").join(", ")
        : str(body.issues);
      const hostName = str(body.host_name) || "the host";
      const listingUrl = str(body.listing_url);
      const neighborhood = str(body.neighborhood);
      const starRating = str(body.star_rating);
      const additionalNotes = str(body.notes);

      const key = process.env.ANTHROPIC_API_KEY?.trim();
      if (!key) {
        return res.status(503).json({ error: "AI not configured." });
      }

      const listingContext = [
        issues ? `Issues observed: ${issues}` : null,
        neighborhood ? `Location/neighborhood: ${neighborhood}` : null,
        starRating ? `Star rating: ${starRating}` : null,
        listingUrl ? `Listing URL (reference only): ${listingUrl}` : null,
        additionalNotes ? `Additional notes from VA: ${additionalNotes}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const systemPrompt = `You are an outreach specialist for Mandel Realty Group, a premium short-term rental management company based in the US.

Write a short, warm, personalized Airbnb host outreach message (5–8 sentences max).

Tone: friendly, confident, slightly observational — point out 1-2 specific flaws or missed opportunities without being harsh, then position Mandel Realty Group as the solution. End with a curiosity hook so the host wants to reply.

Key things to mention naturally (where relevant):
- We handle everything: professional photos, dynamic pricing, guest communication, reviews
- $5,000 furniture upgrade program (mention if furniture/photos are an issue)
- We can help them earn significantly more

Rules:
- Address the host by first name if provided
- Reference a specific thing you noticed about their listing (makes it feel personal, not mass-sent)
- Never be rude or harsh — be empathetic and helpful
- Never use filler openers like "I hope this finds you well" or "My name is..."
- Never use a subject line or sign-off placeholder
- Write only the message body`;

      const userPrompt = `Host name: ${hostName}
${listingContext}

Write the outreach message now.`;

      let aiMessage = "";
      try {
        const model =
          process.env.ANTHROPIC_MODEL?.trim() || "claude-haiku-4-5";
        const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model,
            max_tokens: 400,
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
          }),
        });
        if (!aiRes.ok) {
          console.error("[teamApi/draft_outreach] AI HTTP", aiRes.status);
          return res.status(502).json({ error: "AI service unavailable." });
        }
        const aiData = (await aiRes.json()) as {
          content?: { type: string; text: string }[];
        };
        aiMessage =
          aiData.content?.find((c) => c.type === "text")?.text?.trim() || "";
      } catch (aiErr) {
        console.error("[teamApi/draft_outreach] AI call failed", aiErr);
        return res.status(502).json({ error: "AI service unavailable." });
      }

      if (!aiMessage) {
        return res.status(500).json({ error: "No message generated." });
      }
      return res.status(200).json({ message: aiMessage });
    }

    return res.status(404).json({ error: "Unknown op." });
  } catch (e) {
    console.error("[teamApi]", e instanceof Error ? e.message : e);
    return res.status(500).json({ error: "Request failed." });
  }
}
