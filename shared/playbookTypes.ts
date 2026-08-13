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
