/** Composer choices. Prices are OpenAI’s published list price for one 1024×1024 gpt-image-1 image. */

export type AccountSpend = {
  id: "openai" | "anthropic" | "cursor";
  name: string;
  spent: string | null;
  left: string | null;
  note: string;
  /** Last four characters of the key this server uses, so it can be matched in the console. */
  keyHint: string | null;
  addUrl: string;
};

export const ACCOUNT_LINKS = {
  openai: "https://platform.openai.com/settings/organization/billing/overview",
  anthropic: "https://platform.claude.com/settings/billing",
  cursor: "https://cursor.com/dashboard/billing",
} as const;

export type WorkModelId = "auto" | "haiku" | "sonnet" | "cursor";
export type PictureModelId = "draft" | "edit" | "client";

export type WorkModel = {
  id: WorkModelId;
  name: string;
  line: string;
};

export type PictureModel = {
  id: PictureModelId;
  name: string;
  line: string;
  price: string;
  quality: "low" | "medium" | "high";
  needsPhoto: boolean;
};

export const WORK_MODELS: WorkModel[] = [
  { id: "auto", name: "Auto", line: "The cheapest model that can do this." },
  { id: "haiku", name: "Haiku", line: "A short answer, or a simple skill." },
  { id: "sonnet", name: "Sonnet", line: "Better writing for a skill or anything a person will read." },
  { id: "cursor", name: "Cursor", line: "Opens the web. This is the team bill." },
];

export const PICTURE_MODELS: PictureModel[] = [
  {
    id: "draft",
    name: "Draft",
    line: "A new picture from the words. It will not keep a face.",
    price: "$0.011",
    quality: "low",
    needsPhoto: false,
  },
  {
    id: "edit",
    name: "Edit",
    line: "Uses your photo. The person stays.",
    price: "$0.042",
    quality: "medium",
    needsPhoto: true,
  },
  {
    id: "client",
    name: "Client",
    line: "The same edit, sharper, for a customer report.",
    price: "$0.167",
    quality: "high",
    needsPhoto: true,
  },
];

export function workModel(id: string): WorkModel {
  return WORK_MODELS.find((row) => row.id === id) ?? WORK_MODELS[0];
}

export function pictureModel(id: string): PictureModel {
  return PICTURE_MODELS.find((row) => row.id === id) ?? PICTURE_MODELS[0];
}
