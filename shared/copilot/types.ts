export type DraftStatus = "waiting" | "held" | "approved_unsent";

export type CopilotDraft = {
  subject: string;
  body: string;
  to: string;
  status: DraftStatus;
  channel: "email" | "note" | "skill";
  skillName?: string;
  skillWhen?: string;
  skillReads?: string;
  skillDrafts?: string;
  skillMustNot?: string;
  skillKind?: "playbook" | "text";
  skillPhone?: string;
  choices?: string[];
};

export type CopilotSkill = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  when_text: string;
  reads: string;
  drafts: string;
  must_not: string;
  enabled: boolean;
  kind: "playbook" | "text";
  phone: string;
};

export type CopilotTextSend = {
  id: string;
  created_at: string;
  skill_id: string;
  unit: string;
  body: string;
  link: string;
};

export type CopilotMessage = {
  id: string;
  chat_id: string;
  created_at: string;
  role: "user" | "assistant";
  body: string;
  draft: CopilotDraft | null;
  choices?: string[] | null;
};

export type CopilotChat = {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  kind: "chat" | "code";
};

export type CopilotReminder = {
  id: string;
  created_at: string;
  due_on: string;
  text: string;
  done: boolean;
};

export type BriefCard = {
  id: string;
  group: "focus" | "eating";
  text: string;
  action: string;
  source: string;
};

export type BriefPayload = {
  hello: string;
  line: string;
  quiet: boolean;
  focus: BriefCard[];
  eating: BriefCard[];
};

export type ConnectorRow = {
  id: string;
  name: string;
  detail: string;
  status: "connected" | "not_connected";
  statusLabel: string;
  note?: string;
};
