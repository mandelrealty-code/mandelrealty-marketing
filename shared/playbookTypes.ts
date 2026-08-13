export type PlaybookStepStatus = "done" | "current" | "pending";
export type PlaybookOwner = "host" | "mrg";

export type PlaybookStep = {
  id: string;
  title: string;
  status: PlaybookStepStatus;
  owner?: PlaybookOwner;
};

export function ownerForStepTitle(title: string): PlaybookOwner {
  const t = title.toLowerCase();
  if (/book|call|contract|portal|agreement|send/.test(t)) return "mrg";
  return "host";
}

export function makeStepId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
}

export const COMMON_PLAYBOOK_STEPS = [
  "Apply for STR permit",
  "Confirm building allows STR",
  "Book intro call",
  "Send portal contract",
] as const;

export function addPlaybookStep(steps: PlaybookStep[], title: string): PlaybookStep[] {
  const t = title.trim();
  if (!t) return steps;
  const hasCurrent = steps.some((s) => s.status === "current");
  return [
    ...steps,
    {
      id: `${makeStepId(t)}_${Math.random().toString(36).slice(2, 7)}`,
      title: t,
      status: hasCurrent ? "pending" : "current",
      owner: ownerForStepTitle(t),
    },
  ];
}

export function setCurrentPlaybookStep(steps: PlaybookStep[], id: string): PlaybookStep[] {
  if (!steps.some((s) => s.id === id)) return steps;
  return steps.map((s) => {
    if (s.id === id) return { ...s, status: "current" as const };
    if (s.status === "current") return { ...s, status: "pending" as const };
    return s;
  });
}

/** Remove a step. If it was current, promote the next pending (or reopen last done). */
export function removePlaybookStep(steps: PlaybookStep[], id: string): PlaybookStep[] {
  const target = steps.find((s) => s.id === id);
  if (!target) return steps;
  const next = steps.filter((s) => s.id !== id);
  if (!next.length) return next;
  if (target.status !== "current") return next;
  if (next.some((s) => s.status === "current")) return next;
  const pendingIdx = next.findIndex((s) => s.status === "pending");
  if (pendingIdx >= 0) {
    return next.map((s, i) => (i === pendingIdx ? { ...s, status: "current" as const } : s));
  }
  for (let i = next.length - 1; i >= 0; i--) {
    if (next[i]!.status === "done") {
      return next.map((s, j) => (j === i ? { ...s, status: "current" as const } : s));
    }
  }
  return next;
}
