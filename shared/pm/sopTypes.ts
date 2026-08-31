/** SOP & Scribe-Style Guide Types */

export type SopCategory =
  | "outreach"
  | "guest_ops"
  | "team_comms"
  | "turnover"
  | "maintenance"
  | "software"
  | "other";

export type SopTargetRole = "va" | "cleaner" | "manager" | "all";

export type SopStepPin = {
  id: string;
  number: number;
  x: number; // 0 to 1 percentage
  y: number; // 0 to 1 percentage
  label?: string;
};

export type SopStepBox = {
  id: string;
  type: "spotlight" | "blur" | "blackout";
  x: number; // 0 to 1 percentage
  y: number; // 0 to 1 percentage
  w: number; // 0 to 1 percentage
  h: number; // 0 to 1 percentage
  label?: string;
};

export type SopCopySnippet = {
  id: string;
  title: string;
  template: string;
  description?: string;
};

export type SopStep = {
  id: string;
  step_number: number;
  title: string;
  description: string;
  media_type?: "image" | "video_embed" | "none";
  image_url?: string;
  video_url?: string;
  pro_tip?: string;
  warning?: string;
  copy_snippets?: SopCopySnippet[];
  boxes?: SopStepBox[];
  pins?: SopStepPin[];
};

export type SopItem = {
  id: string;
  created_at: string;
  updated_at: string;
  slug: string;
  title: string;
  category: SopCategory;
  summary: string;
  target_role: SopTargetRole;
  estimated_minutes: number;
  steps: SopStep[];
  is_published: boolean;
  author: string;
};

export const SOP_CATEGORY_LABELS: Record<SopCategory, string> = {
  outreach: "Outreach & Leads",
  guest_ops: "Guest Comms & Inquiries",
  team_comms: "Team & Cleaner Comms",
  turnover: "Turnover & Inspection",
  maintenance: "Maintenance & Repairs",
  software: "Software & Settings",
  other: "General SOP",
};

export const SOP_ROLE_LABELS: Record<SopTargetRole, string> = {
  va: "Virtual Assistant (VA)",
  cleaner: "Cleaner / Turnover",
  manager: "Operations Manager",
  all: "All Team Members",
};
