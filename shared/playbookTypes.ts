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
