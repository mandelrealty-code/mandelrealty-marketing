export type PlaybookStepStatus = "done" | "current" | "pending";

export type PlaybookStep = {
  id: string;
  title: string;
  status: PlaybookStepStatus;
};
