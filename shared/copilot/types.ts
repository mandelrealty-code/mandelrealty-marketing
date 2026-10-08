import type { OverviewModel } from "./overviewRank.js";
import type { Workflow } from "./workflow.js";
import type { PurchaseState } from "./purchaseTypes.js";

export type DraftStatus = "waiting" | "held" | "approved_unsent" | "sent";

export type CopilotDraft = {
  subject: string;
  body: string;
  to: string;
  threadId?: string;
  replyMessageId?: string;
  mailbox?: "gmail" | "outlook";
  status: DraftStatus;
  channel: "email" | "note" | "skill" | "hospitable";
  /** The Hospitable change Submit will make. Absent until then, nothing is committed. */
  hospitable?: { tool: string; args: Record<string, unknown> };
  skillName?: string;
  skillWhen?: string;
  skillReads?: string;
  skillDrafts?: string;
  skillMustNot?: string;
  skillKind?: "playbook" | "text";
  skillPhone?: string;
  skillSchedule?: SkillSchedule;
  choices?: string[];
  /** Set when Submit should resend this contract through OPS. */
  contractSend?: { clientId: string; contractId: string };
  /** Set when Submit should assign this cleaner. Nothing is written until then. */
  cleanerAssign?: { propertyId: string; scheduledOn: string; cleanerName: string; unit: string };
  /** Set when Submit should email this proposal. Nothing is sent until then. */
  proposalSend?: { proposalId: string; to: string };
  /** Low-stock purchase. Nothing is ordered until Purchase item. */
  purchase?: PurchaseState;
};

export type Weekday = "Sunday" | "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday";

/** "" = runs only when asked. "daily" and "weekly:Monday" run on the 5:00 Toronto morning pass. */
export type SkillSchedule = "" | "daily" | `weekly:${Weekday}`;

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
  schedule: SkillSchedule;
  chat_id: string | null;
  last_run_at: string | null;
  /** The builder canvas. The same skill the runner executes. */
  workflow?: Workflow | null;
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
  steps?: { text: string; meta?: string; url?: string }[] | null;
  thought?: string | null;
  images?: { mimeType: string; data: string }[] | null;
  /** This message asked for a generated picture, or it is the picture that came back. */
  picture?: boolean | null;
  /** Structured report from a skill run. body holds the plain-text version. */
  report?: CopilotReport | null;
  /** Set when a skill run wrote this message, not a chat answer. */
  run_id?: string | null;
  /** A memory file written in this turn. */
  memoryFile?: { path: string; title: string; preview: string } | null;
};

export type CopilotReportRow = { who: string; meta: string; details?: string[]; quote?: string };

export type CopilotReport = {
  title: string;
  summary: string;
  sections: { title: string; rows: CopilotReportRow[] }[];
  failed?: { line: string; sub?: string } | null;
};

export type CopilotChat = {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  kind: "chat" | "code";
  needs_you_at?: string | null;
  unread?: boolean;
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
  /** The concrete thing: property, date, and what is proposed. */
  headline?: string;
  /** What approval does, and what has or has not happened yet. */
  detail?: string;
  /** Every choice the card can take. The overview renders each one as a button. */
  actions?: string[];
  source: string;
  chatId?: string;
  messageId?: string;
  purchaseStatus?: "ordered" | "shipped" | "delivered";
  trackingUrl?: string;
  /** Ranking facts. Absent cards are inferred from the headline. */
  rank?: {
    kind: "registration" | "guest" | "cleaner" | "expiring" | "stock" | "draft" | "failed" | "other";
    property: string;
    deadline: string;
    when?: string;
    lead?: string;
  };
};

export type BriefPayload = {
  hello: string;
  line: string;
  quiet: boolean;
  focus: BriefCard[];
  eating: BriefCard[];
  overview?: OverviewModel;
};

export type ConnectorRow = {
  id: string;
  name: string;
  detail: string;
  status: "connected" | "not_connected";
  statusLabel: string;
  note?: string;
  /** Hospitable: pat is the Copilot connection. none means it is not connected. */
  setup?: "mcp" | "pat" | "none";
};

/** What the Settings card may show. The access token itself is never included. */
export type HospitableCard = {
  connected: boolean;
  statusLabel: "Connected" | "Not connected";
  statusLine: string;
  canRead: string;
  cant: string;
  last4: string;
  savedLine: string;
};

export type InboxGuest = {
  reservationId: string;
  guest: string;
  unit: string;
  checkIn: string | null;
  checkOut: string | null;
  lastAt: string | null;
  snippet: string;
  found: { item: string; quote: string }[];
};

export type GuestInboxResult = {
  read: number;
  stays: number;
  unreadable: number;
  partial: boolean;
  waiting: InboxGuest[];
  unclear: InboxGuest[];
  details: InboxGuest[];
};

export type SkillRunResult = {
  /** One line for the morning card. */
  headline: string;
  needs_you: boolean;
  /** The agent posted its report through the tools. */
  posted: boolean;
  tools: string[];
};

export type CopilotRun = {
  id: string;
  skill_id: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "ok" | "failed";
  trigger: "schedule" | "manual";
  agent_id: string;
  cursor_run_id: string;
  result: SkillRunResult | null;
  error: string;
};

export type SkillRow = CopilotSkill & { lastRun: CopilotRun | null };

export type MemoryFileView = {
  path: string;
  body: string;
  origin: "you" | "ops" | "night";
  updated_at: string;
  group: "today" | "files" | "tonight";
  label: string;
  quiet: string;
  title: string;
};
