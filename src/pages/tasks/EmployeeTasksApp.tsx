import { useMemo } from "react";
import { TasksBoard, type BoardApi, type BoardPayload } from "./TasksBoard";

async function team<T>(op: string, method: "GET" | "POST", body: Record<string, unknown> = {}): Promise<T> {
  const params = new URLSearchParams({ op });
  if (method === "GET") for (const [key, value] of Object.entries(body)) if (value != null && value !== "") params.set(key, String(value));
  const res = await fetch(`/api/team?${params}`, {
    method,
    credentials: "include",
    headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
    body: method === "POST" ? JSON.stringify({ op, ...body }) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || "That didn't load. Try again.");
  return data;
}

/**
 * What an employee sees after signing in to the admin app with their OPS account: their own Tasks
 * board and nothing else of Copilot. Assignee and priority are read-only for them.
 */
export default function EmployeeTasksApp({ name, onSignOut }: { name: string; onSignOut: () => void }) {
  const api = useMemo<BoardApi>(() => ({
    load: (open) => team<BoardPayload>("board", "GET", open ? { open: "1" } : {}),
    act: (body) => team<BoardPayload>("board_action", "POST", body),
  }), []);
  return (
    <div className="flex h-dvh flex-col bg-[#211b16] text-[#ede6dc]">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[#3d342a] px-4">
        <span className="grid h-7 w-7 place-items-center rounded-[7px] bg-[#ede6dc] text-[14px] font-bold text-[#211b16]">M</span>
        <span className="text-[15px] font-semibold">Mandel Realty Group</span>
        <span className="text-[13px] text-[#a29584]">· Tasks</span>
        <span className="flex-1" />
        <span className="text-[13px] text-[#a29584]">{name}</span>
        <button type="button" onClick={onSignOut} className="rounded-[10px] border border-[#3d342a] px-3 py-1 text-[13px] text-[#ede6dc] hover:border-[#52463a]">Sign out</button>
      </header>
      <div className="relative flex min-h-0 flex-1">
        <TasksBoard api={api} theme="dark" />
      </div>
    </div>
  );
}
