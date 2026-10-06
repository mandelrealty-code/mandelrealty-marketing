import { useEffect, useMemo, useRef, useState } from "react";
import type { AdminProductMode } from "../clients/mode";
import type { BriefCard, BriefPayload, ConnectorRow, CopilotChat, CopilotMessage, CopilotSkill, CopilotTextSend, SkillRow } from "../../../shared/copilot/types";
import "./copilot.css";
import { EmailDraftCard, ReportCard, SkillDetail, SkillDraftCard, SkillsList } from "./skillsUi";
import { WorkflowBuilder } from "./WorkflowBuilder";
import { ACCOUNT_LINKS, PICTURE_MODELS, WORK_MODELS, wantsWeb } from "../../../shared/copilot/models";
import type { AccountSpend, PictureModelId, WorkModelId } from "../../../shared/copilot/models";
import { BLANK, SEED } from "../../../shared/copilot/workflow";
import { runWhen } from "./skillsTime";

type Screen = "brief" | "empty" | "chat" | "settings" | "skills" | "skill" | "connectors" | "twilio" | "account" | "billing" | "board";

type Boot = {
  brief: BriefPayload;
  chats: CopilotChat[];
  skills: SkillRow[];
  connectors: ConnectorRow[];
  billing: string;
  textLog?: CopilotTextSend[];
  textNumbers?: string[];
  twilioFrom?: string;
  runningChatIds?: string[];
};

type SkillForm = { name: string; when: string; reads: string; drafts: string; mustNot: string; phone: string };

type PendingFile = {
  id: string;
  kind: "photo" | "doc";
  name: string;
  size: string;
  ext: string;
  url?: string;
  file: File;
};

function storedChoice<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const value = localStorage.getItem(key) ?? "";
    return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function isPhotoFile(file: File) {
  return file.type.startsWith("image/") || /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(file.name);
}

async function imagePayload(file: File): Promise<{ mimeType: string; data: string } | null> {
  if (!isPhotoFile(file)) return null;
  try {
    const bitmap = await createImageBitmap(file);
    const max = 1280;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.72));
    if (!blob) return null;
    return { mimeType: "image/jpeg", data: bytesToBase64(new Uint8Array(await blob.arrayBuffer())) };
  } catch {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type) || file.size > 1_400_000) return null;
    return { mimeType: file.type, data: bytesToBase64(new Uint8Array(await file.arrayBuffer())) };
  }
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
}

function fileExt(name: string) {
  const part = name.includes(".") ? name.split(".").pop() ?? "" : "";
  return (part || "FILE").slice(0, 4).toUpperCase();
}

function prettyPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function usablePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
}

const SUGGESTIONS = [
  "Email the next guest at 20 Blue Jays Way",
  "How much is unit 606 making this month?",
  "Did Elizabeth get her contract?",
  "Add a new client",
];

async function api<T>(op: string, body?: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const res = await fetch(body ? "/api/admin/copilot" : `/api/admin/copilot?op=${op}`, {
    method: body ? "POST" : "GET",
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify({ op, ...body }) : undefined,
    signal,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || "Copilot request failed.");
  return data;
}

function pause(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function when(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "short" });
}

function greetLead(hello: string) {
  return hello.replace(/,?\s*team\.?$/i, ",");
}

function initial(source: string) {
  const word = source.trim().split(/\s+/)[0] ?? "";
  return (word[0] ?? "M").toUpperCase();
}

function Moon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 2.5a5.5 5.5 0 010 11z" fill="currentColor" />
    </svg>
  );
}

function Arrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 10L10 4M5 4h5v5" />
    </svg>
  );
}

type DeskView = { url?: string; image?: string; mime?: string; rev?: string; pointer?: { x: number; y: number } };

type Stage = {
  kind: "page" | "pdf";
  control: boolean;
  open: boolean;
  url: string;
  image?: string;
  pointer?: { x: number; y: number };
  pdfUrl?: string;
  pdfName?: string;
};

function withDesk(current: Stage | null, view?: DeskView, fallbackUrl?: string): Stage | null {
  if (current?.kind === "pdf") return current;
  if (current?.control) return current;
  const url = view?.url || fallbackUrl || current?.url || "";
  const image = view?.image ? `data:${view.mime || "image/png"};base64,${view.image}` : current?.image;
  if (!current && !url && !image) return current;
  return {
    kind: "page",
    control: false,
    open: current?.open ?? true,
    url,
    image,
    pointer: view?.pointer ?? current?.pointer,
  };
}

function Pointer() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <path d="M1.2 1.2 L1.2 12.4 L4.4 9.4 L6.6 14.2 L8.3 13.4 L6.1 8.8 L10.2 8.8 Z" fill="#0b0a10" stroke="#fff" strokeWidth="1" />
    </svg>
  );
}

function Up() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 14V4M4.5 8.5L9 4l4.5 4.5" />
    </svg>
  );
}

function Plus() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <path d="M9 3.5v11M3.5 9h11" />
    </svg>
  );
}

function PhotoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="3.5" width="13" height="11" rx="2" />
      <circle cx="6.5" cy="7.5" r="1.3" />
      <path d="M15.5 12l-3.5-3.5-6.5 6" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 2.5h5.5L14 6v9.5H5z" />
      <path d="M10.5 2.5V6H14M7.5 9.5h4M7.5 12h4" />
    </svg>
  );
}

function PictureIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 2.5l1.3 3.7 3.7 1.3-3.7 1.3L8 12.5 6.7 8.8 3 7.5l3.7-1.3z" />
      <path d="M13.5 11.5v4M11.5 13.5h4" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="9" cy="9" r="6.5" />
      <ellipse cx="9" cy="9" rx="2.8" ry="6.5" />
      <path d="M2.5 9h13" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="cp-check" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );
}

function SkillIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="2.5" width="12" height="13" rx="2" />
      <path d="M6 6.5h6M6 9h6M6 11.5h3.5" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 4.5L11.5 9 7 13.5" />
    </svg>
  );
}

function Dots() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
      <circle cx="7" cy="2.8" r="1.25" />
      <circle cx="7" cy="7" r="1.25" />
      <circle cx="7" cy="11.2" r="1.25" />
    </svg>
  );
}

function Pencil() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.5 2.5l3 3L5.5 13.5H2.5v-3z" />
      <path d="M9 4l3 3" />
    </svg>
  );
}

function Trash() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2.5 4.5h11M6 4.5V3h4v1.5M4 4.5l.7 9h6.6l.7-9" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 4.5L6.5 10l5.5 5.5" />
    </svg>
  );
}

function Switcher({ onModeChange }: { onModeChange: (mode: AdminProductMode) => void }) {
  return (
    <div className="cp-switch">
      <button type="button" onClick={() => onModeChange("crm")}>CRM</button>
      <button type="button" onClick={() => onModeChange("ops")}>OPS</button>
      <button type="button" className="on">Copilot</button>
    </div>
  );
}

function ChoiceCard({
  message,
  locked,
  open,
  draft,
  onOpen,
  onDraft,
  onPick,
  onElse,
}: {
  message: CopilotMessage;
  locked: boolean;
  open: boolean;
  draft: string;
  onOpen: () => void;
  onDraft: (value: string) => void;
  onPick: (label: string) => void;
  onElse: (value: string) => void;
}) {
  const choices = (message.choices ?? []).filter((label) => !/^something else\.?$/i.test(label.trim()));
  const letters = "ABCD";
  const elseLetter = letters[choices.length] ?? "D";
  const signIn = choices[0] === "Keep me signed in";
  return (
    <div className={`cp-choices${signIn ? " signin" : ""}`}>
      {choices.map((label, index) => (
        <button
          key={label}
          type="button"
          className="cp-choice"
          disabled={locked}
          onClick={() => onPick(`${letters[index]}. ${label}.`)}
        >
          <span className="cp-choice-letter">{letters[index]}</span>
          <span>{label}</span>
        </button>
      ))}
      {open && !locked ? (
        <div className="cp-choice-else">
          <span className="cp-choice-letter">{elseLetter}</span>
          <input
            placeholder="Type your own"
            aria-label="Something else"
            value={draft}
            onChange={(event) => onDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                const value = draft.trim();
                if (value) onElse(value);
              }
            }}
          />
          <button type="button" className="cp-else-send" aria-label="Send" disabled={!draft.trim()} onClick={() => onElse(draft.trim())}>
            <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 14V4M4.5 8.5L9 4l4.5 4.5" />
            </svg>
          </button>
        </div>
      ) : (
        <button type="button" className="cp-choice else" disabled={locked} onClick={onOpen}>
          <span className="cp-choice-letter">{elseLetter}</span>
          <span>Something else</span>
        </button>
      )}
    </div>
  );
}

function workFor(message: CopilotMessage): { thought: string; steps: { text: string }[] } {
  const steps = [{ text: "Read your message" }];
  const draft = message.draft;
  if (draft?.channel === "skill") {
    if (draft.skillKind === "text") {
      steps.push({ text: "Wrote the text and left it waiting" });
      return { thought: "Saving this texts your number only. It does not text a guest.", steps };
    }
    steps.push({ text: "Wrote the skill and left it waiting" });
    return { thought: "This is a playbook. Saving it does not send anything.", steps };
  }
  if (message.choices?.length) {
    steps.push({ text: "Found a real fork" });
    steps.push({ text: "Asked instead of guessing" });
    return { thought: "A guess here would be wrong, so I asked.", steps };
  }
  if (!draft && /\?\s*$/.test(message.body.trim())) {
    steps.push({ text: "Asked one question" });
    return { thought: "One question was enough. I did not guess.", steps };
  }
  if (/Before I write the skill/i.test(message.body)) {
    steps.push({ text: "Asked what the skill should do" });
    steps.push({ text: "Did not save a skill yet" });
    return { thought: "I need your answers before I write the skill. Nothing was saved.", steps };
  }
  if (/remind you tomorrow/i.test(message.body)) {
    steps.push({ text: "Saved a reminder for tomorrow" });
    steps.push({ text: "Did not contact anyone" });
    return { thought: "You asked for a reminder. I stored it and stopped there.", steps };
  }
  if (/can't read the picture/i.test(message.body)) {
    steps.push({ text: "Received the file name" });
    steps.push({ text: "Could not read the picture yet" });
    return { thought: "Cursor is not connected, so I did not invent what the picture shows.", steps };
  }
  if (draft?.channel === "note") {
    steps.push({ text: "Wrote the note" });
    if (draft.status === "held") {
      steps.push({ text: "You held it. Nothing was sent" });
      return { thought: "You held this note. Nothing was sent.", steps };
    }
    if (draft.status === "approved_unsent") {
      steps.push({ text: "You kept it. Nothing was sent" });
      return { thought: "You kept this note. Nothing was sent.", steps };
    }
    steps.push({ text: "Left it waiting. Nothing was sent" });
    return { thought: "This is a note for you. It is not an email, and nothing was sent.", steps };
  }
  if (draft) {
    steps.push({ text: "Drafted the email" });
    if (draft.status === "held") {
      steps.push({ text: "You held it. Nothing was sent" });
      return { thought: "You held this. Nothing was sent.", steps };
    }
    if (draft.status === "approved_unsent") {
      steps.push({ text: "You approved it. It was not sent" });
      return { thought: "You approved this. Gmail is not connected, so it was not sent.", steps };
    }
    steps.push({ text: "Left it waiting. Nothing was sent" });
    return { thought: "I wrote the email and stopped. It stays here until you confirm.", steps };
  }
  if (/isn’t connected on the server/.test(message.body)) {
    steps.push({ text: "Cursor is not connected" });
    return { thought: "The team key is not set on the server, so Cursor did not answer.", steps };
  }
  steps.push({ text: "Cursor answered" });
  steps.push({ text: "Nothing was sent" });
  return { thought: "Cursor wrote this reply. Nothing was sent.", steps };
}

function shownTrail(message: CopilotMessage): { thought?: string; steps: { text: string; meta?: string }[]; summary: string } {
  const trail = message.steps?.length || message.thought
    ? { thought: message.thought || undefined, steps: message.steps ?? [] }
    : workFor(message);
  const count = trail.steps.length + (trail.thought ? 1 : 0);
  return { ...trail, summary: count === 1 ? "1 step" : `${count} steps` };
}

function ThinkChevron({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={open ? "M3 7.5L6 4.5l3 3" : "M3 4.5L6 7.5l3-3"} />
    </svg>
  );
}

function ThinkCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 7.5l2.5 2.5L11 4.5" />
    </svg>
  );
}

function foundPages(body: string): string[] {
  const found = body.match(/https?:\/\/[^\s<>"']+/g) ?? [];
  return [...new Set(found.map((url) => url.replace(/[),.;]+$/, "")))];
}

function Address({ url }: { url: string }) {
  if (!/^https?:\/\//i.test(url)) return <span>Opening the browser</span>;
  try {
    const page = new URL(url);
    const path = `${page.pathname}${page.search}`;
    return (
      <span className="cp-addr">
        <b>{page.hostname.replace(/^www\./, "")}</b>
        {path && path !== "/" ? <span>{path}</span> : null}
      </span>
    );
  } catch {
    return <span>{url}</span>;
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Thinking({
  open,
  onToggle,
  title,
  summary,
  thought,
  steps,
  live,
  onShowBrowser,
}: {
  open: boolean;
  onToggle: () => void;
  title: string;
  summary: string;
  thought?: string;
  steps: { text: string; meta?: string }[];
  live?: boolean;
  onShowBrowser?: () => void;
}) {
  return (
    <div className="cp-think">
      <div className="cp-think-row">
      <button
        type="button"
        className={`cp-think-head${live ? " live" : ""}`}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggle();
        }}
      >
        <span className="label">{title}</span>
        {summary ? <span className="count">{summary}</span> : null}
        <ThinkChevron open={open} />
      </button>
      {onShowBrowser ? (
        <button
          type="button"
          className="cp-showbrowser"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onShowBrowser();
          }}
        >
          <i />Show browser
        </button>
      ) : null}
      </div>
        {open ? (
        <div
          className="cp-think-body"
          onWheel={(event) => {
            const el = event.currentTarget;
            if (el.scrollHeight <= el.clientHeight + 1) return;
            event.stopPropagation();
          }}
        >
          {thought ? <p>{thought}</p> : null}
          {steps.length > 0 ? (
            <div className="cp-think-steps">
              {steps.map((step, index) => (
                <div key={`${index}-${step.text}`} className="cp-think-step">
                  {live && index === steps.length - 1 ? <span className="cp-pulse" /> : <ThinkCheck />}
                  <span>{step.text}</span>
                  {step.meta ? <span className="meta">{step.meta}</span> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Mark({ size }: { size: number }) {
  return <img className="cp-mark" src="/mrg-logo.png" alt="" width={size} height={size} style={{ width: size, height: size, borderRadius: size > 28 ? 12 : 6 }} />;
}

export default function CopilotApp({ onModeChange }: { onModeChange: (mode: AdminProductMode) => void }) {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try {
      return localStorage.getItem("mrg_copilot_theme") === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });
  const [boot, setBoot] = useState<Boot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elseFor, setElseFor] = useState<string | null>(null);
  const [elseDraft, setElseDraft] = useState("");
  const [connectHint, setConnectHint] = useState<Record<string, boolean>>({});
  const [screen, setScreen] = useState<Screen>("brief");
  const [boardKind, setBoardKind] = useState<"seed" | "blank">("seed");
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [install, setInstall] = useState(false);
  const [installHint, setInstallHint] = useState(false);
  const [copied, setCopied] = useState(false);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [trail, setTrail] = useState<Record<string, boolean>>({});
  const [report, setReport] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [workModel, setWorkModel] = useState<WorkModelId>(() => storedChoice("mrg_copilot_work_model", ["auto", "haiku", "sonnet", "cursor"] as const, "auto"));
  const [pictureModel, setPictureModel] = useState<PictureModelId>(() => storedChoice("mrg_copilot_picture_model", ["draft", "edit", "client"] as const, "draft"));
  const [pictureWait, setPictureWait] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountSpend[] | null>(null);
  const [webSearch, setWebSearch] = useState(false);
  const [pictureMode, setPictureMode] = useState(false);
  const [pendingPicture, setPendingPicture] = useState(false);
  const [stage, setStage] = useState<Stage | null>(null);
  const [skillMode, setSkillMode] = useState(false);
  const [viaPlus, setViaPlus] = useState<Record<string, boolean>>({});
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  const [pendingDelete, setPendingDelete] = useState<{ kind: "chat" | "skill"; id: string; title: string } | null>(null);
  const [skillId, setSkillId] = useState<string | null>(null);
  const [skillForm, setSkillForm] = useState<SkillForm>({ name: "", when: "", reads: "", drafts: "", mustNot: "", phone: "" });
  const [skillPhones, setSkillPhones] = useState<Record<string, string>>({});
  const [numberDraft, setNumberDraft] = useState("");
  const [skillSaved, setSkillSaved] = useState(false);
  const [pw, setPw] = useState({ cur: "", next: "", conf: "" });
  const [pwMsg, setPwMsg] = useState<"" | "err" | "current" | "server">("");
  const [pending, setPending] = useState<string | null>(null);
  const [runBusy, setRunBusy] = useState(false);
  const [runMsg, setRunMsg] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [liveSteps, setLiveSteps] = useState<{ text: string; meta?: string }[]>([{ text: "Sent your message to Cursor" }]);
  const [liveThought, setLiveThought] = useState<string | undefined>();
  const [runOpen, setRunOpen] = useState(false);
  const [stopped, setStopped] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const deskRev = useRef("");
  const chatIdRef = useRef<string | null>(null);
  const screenRef = useRef<Screen>("brief");
  const deskMemory = useRef<Record<string, Stage>>({});
  const closedBrowsers = useRef<Set<string>>(new Set());
  const [liveRuns, setLiveRuns] = useState<string[]>([]);
  chatIdRef.current = chatId;
  screenRef.current = screen;
  const sendDown = useRef(false);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const photoRef = useRef<HTMLInputElement | null>(null);
  const docRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    document.title = "Copilot | Mandel Realty Group";
    const root = document.documentElement;
    root.classList.add("cp-app");
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = "/copilot.webmanifest";
    document.head.appendChild(link);
    const themeMeta = document.createElement("meta");
    themeMeta.name = "theme-color";
    document.head.appendChild(themeMeta);
    const appleBar = document.createElement("meta");
    appleBar.name = "apple-mobile-web-app-status-bar-style";
    appleBar.content = "black-translucent";
    document.head.appendChild(appleBar);
    const paint = () => {
      const light = root.dataset.cpTheme === "light";
      themeMeta.content = light ? "#f4f3f7" : "#0b0a10";
    };
    paint();
    const observer = new MutationObserver(paint);
    observer.observe(root, { attributes: true, attributeFilter: ["data-cp-theme"] });
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/copilot-sw.js").catch(() => undefined);
    }
    let startY = 0;
    const onStart = (event: TouchEvent) => {
      startY = event.touches[0]?.clientY ?? 0;
    };
    const onMove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY ?? startY;
      const dy = y - startY;
      const target = event.target;
      if (!(target instanceof Element)) {
        event.preventDefault();
        return;
      }
      let node: Element | null = target;
      while (node && node !== document.body) {
        if (node instanceof HTMLElement) {
          const overflowY = window.getComputedStyle(node).overflowY;
          if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight + 1) {
            const atTop = node.scrollTop <= 0;
            const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 1;
            if ((dy > 0 && atTop) || (dy < 0 && atBottom)) event.preventDefault();
            return;
          }
        }
        node = node.parentElement;
      }
      event.preventDefault();
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    return () => {
      observer.disconnect();
      root.classList.remove("cp-app");
      delete root.dataset.cpTheme;
      link.remove();
      themeMeta.remove();
      appleBar.remove();
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.title = "CRM | Mandel Realty Group";
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.cpTheme = theme;
  }, [theme]);

  async function load() {
    const data = await api<Boot>("boot");
    setBoot(data);
    return data;
  }

  function rememberRun(id: string) {
    setLiveRuns((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  function runningChat(id: string | null) {
    if (!id) return false;
    return liveRuns.includes(id) || (boot?.runningChatIds ?? []).includes(id);
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Could not load Copilot."));
  }, []);

  useEffect(() => {
    const server = boot?.runningChatIds ?? [];
    if (!server.length) return;
    setLiveRuns((prev) => {
      const next = Array.from(new Set([...prev, ...server]));
      return next.length === prev.length && next.every((id, index) => id === prev[index]) ? prev : next;
    });
  }, [boot]);

  useEffect(() => {
    if (!liveRuns.length) return;
    const controllers = liveRuns.map(() => new AbortController());
    liveRuns.forEach((id, index) => {
      const signal = controllers[index]?.signal;
      if (!signal) return;
      void (async () => {
        while (!signal.aborted) {
          try {
            await pause(400, signal);
          } catch {
            return;
          }
          if (signal.aborted) return;
          try {
            const next = await api<{ messages: CopilotMessage[]; pending?: boolean; steps?: { text: string; meta?: string; url?: string }[]; thought?: string; view?: DeskView }>("think", {
              chatId: id,
              viewRev: id === chatIdRef.current ? deskRev.current : "",
            }, signal);
            if (signal.aborted) return;
            if (next.view?.rev && id === chatIdRef.current) deskRev.current = next.view.rev;
            const opened = [...(next.steps ?? [])].reverse().find((step) => step.url && /^https?:\/\//i.test(step.url));
            if (next.view || opened?.url) {
              const saved = withDesk(deskMemory.current[id] ?? null, next.view, opened?.url);
              if (saved) deskMemory.current[id] = saved;
              if (id === chatIdRef.current && screenRef.current === "chat" && saved && !closedBrowsers.current.has(id)) setStage(saved);
            }
            if (id === chatIdRef.current && screenRef.current === "chat") {
              if (next.steps?.length) setLiveSteps(next.steps);
              setLiveThought(next.thought);
              setMessages(next.messages);
              setThinking(Boolean(next.pending));
            }
            if (!next.pending) {
              setLiveRuns((prev) => prev.filter((item) => item !== id));
              if (id === chatIdRef.current) {
                setMessages(next.messages);
                setThinking(false);
              }
              void load().catch(() => undefined);
              return;
            }
          } catch (err) {
            if (signal.aborted || (err instanceof DOMException && err.name === "AbortError")) return;
          }
        }
      })();
    });
    return () => {
      for (const ctrl of controllers) ctrl.abort();
    };
  }, [liveRuns]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      void load().then(async (data) => {
        const id = chatIdRef.current;
        if (!id || screenRef.current !== "chat") return;
        const next = await api<{ messages: CopilotMessage[] }>(`messages&chatId=${encodeURIComponent(id)}`);
        setMessages(next.messages);
        const still = (data.runningChatIds ?? []).includes(id) || liveRuns.includes(id);
        setThinking(still);
      }).catch(() => undefined);
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [liveRuns]);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "38px";
    el.style.height = `${Math.min(el.scrollHeight, 110)}px`;
  }, [text]);

  useEffect(() => {
    try {
      localStorage.setItem("mrg_copilot_work_model", workModel);
      localStorage.setItem("mrg_copilot_picture_model", pictureModel);
    } catch {
      /* The choice still applies to this visit. */
    }
  }, [workModel, pictureModel]);

  useEffect(() => {
    let gone = false;
    void api<{ accounts: AccountSpend[] }>("accounts", {}).then((data) => {
      if (!gone) setAccounts(data.accounts);
    }).catch(() => {
      if (!gone) setAccounts((prev) => prev ?? [
        { id: "openai", name: "OpenAI", spent: null, left: null, note: "Couldn’t read the accounts.", keyHint: null, addUrl: ACCOUNT_LINKS.openai },
        { id: "anthropic", name: "Anthropic", spent: null, left: null, note: "Couldn’t read the accounts.", keyHint: null, addUrl: ACCOUNT_LINKS.anthropic },
        { id: "cursor", name: "Cursor", spent: null, left: null, note: "Couldn’t read the accounts.", keyHint: null, addUrl: ACCOUNT_LINKS.cursor },
      ]);
    });
    return () => { gone = true; };
  }, [screen]);

  useEffect(() => {
    function down(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (menuFor && !target?.closest("[data-chat-menu]")) setMenuFor(null);
      if (plusOpen && !target?.closest("[data-plus]")) setPlusOpen(false);
      if (modelOpen && !target?.closest("[data-model]")) setModelOpen(false);
    }
    document.addEventListener("click", down);
    return () => document.removeEventListener("click", down);
  }, [menuFor, plusOpen, modelOpen]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || screen === "brief") {
      if (el && screen === "brief") el.scrollTop = 0;
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, [messages, screen, busy]);

  function setThemeAndSave(next: "dark" | "light") {
    setTheme(next);
    try {
      localStorage.setItem("mrg_copilot_theme", next);
    } catch {
      /* ignore */
    }
  }

  function goHome() {
    setChatId(null);
    setMessages([]);
    setScreen("brief");
    setSheet(false);
    setReport(false);
    setStage(null);
    setWebSearch(false);
    setPictureMode(false);
  }

  function goEmpty() {
    setChatId(null);
    setMessages([]);
    setScreen("empty");
    setSheet(false);
    setReport(false);
    setStage(null);
    setWebSearch(false);
    setPictureMode(false);
  }

  async function openChat(id: string) {
    const still = runningChat(id);
    setChatId(id);
    setScreen("chat");
    setSheet(false);
    setReport(false);
    setStopped(false);
    if (still) {
      setThinking(true);
      const saved = deskMemory.current[id];
      if (saved) setStage(saved);
      else if (id !== chatId) setStage(null);
      if (id !== chatId) setLiveSteps([{ text: "Looking this up" }]);
    } else {
      setThinking(false);
      setStage(null);
    }
    const data = await api<{ messages: CopilotMessage[] }>(`messages&chatId=${encodeURIComponent(id)}`);
    setMessages(data.messages);
    await api("seen", { chatId: id }).catch(() => undefined);
    await load();
  }

  async function openCard(cardText: string, action: string) {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPending(cardText);
    setLiveSteps([{ text: "Sent your message to Cursor" }]);
    setLiveThought(undefined);
    setThinking(false);
    setRunOpen(false);
    setStopped(false);
    setBusy(true);
    setError(null);
    setSheet(false);
    setScreen("chat");
    let activeId = "";
    let handed = false;
    try {
      const data = await api<{ chat: CopilotChat; messages: CopilotMessage[]; pending?: boolean; chats?: CopilotChat[] }>("card", {
        text: cardText,
        action,
      }, ctrl.signal);
      if (ctrl.signal.aborted) return;
      activeId = data.chat.id;
      setChatId(data.chat.id);
      setMessages(data.messages);
      if (data.chats) setBoot((prev) => (prev ? { ...prev, chats: data.chats ?? prev.chats } : prev));
      setPending(null);
      setScreen("chat");
      if (data.pending) {
        handed = true;
        setThinking(true);
        rememberRun(data.chat.id);
      }
      await api("seen", { chatId: data.chat.id }).catch(() => undefined);
      await load();
    } catch (e) {
      if (ctrl.signal.aborted) {
        setStopped(true);
        if (activeId) void api("cancel-think", { chatId: activeId }).catch(() => undefined);
      } else setError(e instanceof Error ? e.message : "Could not open the draft.");
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
      setPending(null);
      if (!handed) setThinking(false);
      setBusy(false);
    }
  }

  async function send(preset?: string, keepChat = false) {
    const kept = files;
    const photos = preset ? [] : kept.filter((item) => item.kind === "photo" || isPhotoFile(item.file));
    const docs = preset ? [] : kept.filter((item) => !photos.includes(item));
    const attached = docs.length ? `\nAttached: ${docs.map((file) => file.name).join(", ")}` : "";
    const typed = (preset ?? text).trim();
    const value = `${typed}${attached}`.trim();
    if ((!value && kept.length === 0) || busy) return;
    const images: { mimeType: string; data: string }[] = [];
    for (const item of photos) {
      const image = await imagePayload(item.file).catch(() => null);
      if (image) images.push(image);
      if (images.length === 4) break;
    }
    if (photos.length && images.length === 0) {
      setError("That photo couldn't be read. Try a different one.");
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const pdf = docs.find((file) => file.file.type === "application/pdf" || /\.pdf$/i.test(file.name));
    const makingPicture = pictureMode && !preset;
    const searching = !makingPicture && !preset && (webSearch || wantsWeb(typed));
    const pictureId: PictureModelId = (pictureModel === "edit" || pictureModel === "client") && photos.length === 0 ? "draft" : pictureModel;
    const chosen = makingPicture ? pictureId : searching ? "cursor" : workModel;
    if (searching) {
      setWorkModel("cursor");
      deskRev.current = "";
    }
    const waitLabel = makingPicture ? PICTURE_MODELS.find((row) => row.id === pictureId) : null;
    setPending(value || "Look at the attached photo.");
    setPendingPicture(makingPicture);
    setPictureWait(waitLabel ? `${waitLabel.name} · ${waitLabel.price}` : null);
    setModelOpen(false);
    setLiveSteps(makingPicture ? [] : [{ text: images.length ? "Looking at the photo" : searching ? "Looking this up" : "Thinking" }]);
    if (pdf && !makingPicture) {
      setStage({
        kind: "pdf",
        control: false,
        open: true,
        url: "",
        pdfUrl: pdf.url,
        pdfName: pdf.name,
      });
    } else if (searching) {
      if (chatId) closedBrowsers.current.delete(chatId);
      setStage({ kind: "page", control: false, open: true, url: "" });
    } else if (!makingPicture) {
      setStage(null);
    }
    if (searching || pdf) setPlusOpen(false);
    if (searching) setWebSearch(false);
    setLiveThought(undefined);
    setThinking(false);
    setRunOpen(false);
    setStopped(false);
    setBusy(true);
    setError(null);
    setScreen("chat");
    if (!preset) {
      setText("");
      setFiles([]);
      if (makingPicture) setPictureMode(false);
    }
    let activeId = preset && !keepChat ? "" : chatId ?? "";
    let delivered = false;
    let handed = false;
    try {
      const makingSkill = skillMode && (!preset || keepChat);
      const data = await api<{ chatId: string; messages: CopilotMessage[]; pending?: boolean; chats?: CopilotChat[] }>("send", {
        text: value || "Look at the attached photo.",
        chatId: preset && !keepChat ? null : chatId,
        kind: "chat",
        skillMode: makingSkill,
        pictureMode: makingPicture,
        webSearch: searching,
        model: chosen,
        images,
      }, ctrl.signal);
      delivered = true;
      if (ctrl.signal.aborted) return;
      kept.forEach((file) => {
        if (file.url && file.url !== pdf?.url) URL.revokeObjectURL(file.url);
      });
      activeId = data.chatId;
      setChatId(data.chatId);
      if (searching) {
        closedBrowsers.current.delete(data.chatId);
        deskMemory.current[data.chatId] = deskMemory.current[data.chatId] ?? { kind: "page", control: false, open: true, url: "" };
      }
      setMessages(data.messages);
      if (data.chats) setBoot((prev) => (prev ? { ...prev, chats: data.chats ?? prev.chats } : prev));
      setPending(null);
      let shown = data.messages;
      if (data.pending) {
        handed = true;
        setThinking(true);
        rememberRun(data.chatId);
      }
      if (makingSkill) {
        const user = [...data.messages].reverse().find((m) => m.role === "user");
        if (user) setViaPlus((prev) => ({ ...prev, [user.id]: true }));
        const assistant = [...shown].reverse().find((m) => m.role === "assistant");
        if (assistant?.draft?.channel === "skill") setSkillMode(false);
      }
      setScreen("chat");
      setSheet(false);
      setPlusOpen(false);
      setElseFor(null);
      setElseDraft("");
      if (/floor plan|sourcing|furniture report/i.test(value)) setReport(true);
      await api("seen", { chatId: data.chatId }).catch(() => undefined);
      await load();
    } catch (e) {
      if (ctrl.signal.aborted) {
        setStopped(true);
        if (activeId) void api("cancel-think", { chatId: activeId }).catch(() => undefined);
        if (!delivered && !preset) {
          setText(typed);
          setFiles(kept);
          if (makingPicture) setPictureMode(true);
        }
      } else {
        setError(e instanceof Error ? e.message : "Could not send.");
        if (!delivered && !preset) {
          setText(typed);
          setFiles(kept);
          if (makingPicture) setPictureMode(true);
        }
      }
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
      setPending(null);
      setPendingPicture(false);
      setPictureWait(null);
      if (!handed) setThinking(false);
      setBusy(false);
    }
  }

  function reopenBrowser() {
    if (!chatId) return;
    closedBrowsers.current.delete(chatId);
    const saved = deskMemory.current[chatId] ?? { kind: "page" as const, control: false, open: true, url: "" };
    deskMemory.current[chatId] = saved;
    setStage({ ...saved, control: false });
  }

  function stopRun() {
    const id = chatIdRef.current;
    abortRef.current?.abort();
    if (id) {
      closedBrowsers.current.add(id);
      setLiveRuns((prev) => prev.filter((item) => item !== id));
      void api("cancel-think", { chatId: id }).catch(() => undefined);
    }
    setStage(null);
    setThinking(false);
    setStopped(true);
    setPending(null);
  }

  async function act(message: CopilotMessage, action: "send" | "hold") {
    setBusy(true);
    try {
      await api("draft", {
        messageId: message.id,
        action,
        channel: message.draft?.channel ?? "email",
        edited: edits[message.id] ?? message.draft?.body ?? "",
      });
      if (chatId) await openChat(chatId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the draft.");
    } finally {
      setBusy(false);
    }
  }

  const inSettings = screen === "settings" || screen === "skills" || screen === "skill" || screen === "connectors" || screen === "twilio" || screen === "account" || screen === "billing";
  const skills = boot?.skills ?? [];

  async function runSkill(skill: CopilotSkill) {
    setRunBusy(true);
    setRunMsg(null);
    try {
      const data = await api<{ skills: SkillRow[]; connectors: ConnectorRow[]; chats: CopilotChat[] }>("run-skill", { id: skill.id });
      setBoot((prev) => (prev ? { ...prev, skills: data.skills, connectors: data.connectors, chats: data.chats } : prev));
      setRunMsg("Running. It can take a few minutes. The report lands in this skill's chat. Nothing is sent.");
    } catch (e) {
      setRunMsg(e instanceof Error ? e.message : "It did not start. Nothing was sent.");
    } finally {
      setRunBusy(false);
    }
  }

  const chatSkill = chatId ? skills.find((s) => s.chat_id === chatId) ?? null : null;
  const anyRunning = skills.some((s) => s.lastRun?.status === "running");

  // While a skill runs, refresh until its report lands. The server checks Cursor on each load.
  useEffect(() => {
    if (!anyRunning) return;
    let polls = 0;
    const timer = window.setInterval(() => {
      polls += 1;
      if (polls > 40) {
        window.clearInterval(timer);
        return;
      }
      void load().catch(() => undefined);
      if (chatId && screen === "chat") {
        void api<{ messages: CopilotMessage[] }>(`messages&chatId=${encodeURIComponent(chatId)}`)
          .then((data) => setMessages(data.messages))
          .catch(() => undefined);
      }
    }, 15000);
    return () => window.clearInterval(timer);
  }, [anyRunning, chatId, screen]);

  const openSkillRecord = skills.find((s) => s.id === skillId) ?? null;

  const title = useMemo(() => {
    if (screen === "brief") return "Overview";
    if (screen === "empty") return "New chat";
    return boot?.chats.find((c) => c.id === chatId)?.title || "New chat";
  }, [boot, chatId, screen]);

  const backLabel =
    screen === "skills" || screen === "connectors" || screen === "account" || screen === "billing"
      ? "Settings"
      : screen === "skill"
        ? "Skills"
        : screen === "twilio"
          ? "Connectors"
          : "Chats";

  function back() {
    if (screen === "skill") setScreen("skills");
    else if (screen === "twilio") setScreen("connectors");
    else if (screen === "skills" || screen === "connectors" || screen === "account" || screen === "billing") setScreen("settings");
    else {
      setScreen("brief");
      setSheet(false);
    }
  }

  function startSkill() {
    setSkillMode(true);
    setPlusOpen(false);
    setText("");
    setChatId(null);
    setMessages([]);
    setScreen("chat");
    setSheet(false);
  }

  function openSkill(skill: CopilotSkill) {
    setSkillId(skill.id);
    setSkillForm({
      name: skill.name,
      when: skill.when_text,
      reads: skill.reads,
      drafts: skill.drafts,
      mustNot: skill.must_not,
      phone: skill.phone || "",
    });
    setSkillSaved(false);
    setRunMsg(null);
    setScreen("skill");
    setSheet(false);
  }

  async function persistSkill(enabled: boolean) {
    if (!skillForm.name.trim()) return;
    setBusy(true);
    try {
      const data = await api<{ skills: SkillRow[]; textNumbers?: string[] }>("skill", {
        id: skillId,
        name: skillForm.name,
        when: skillForm.when,
        reads: skillForm.reads,
        drafts: skillForm.drafts,
        mustNot: skillForm.mustNot,
        phone: skillForm.phone,
        kind: openSkillRecord?.kind ?? "playbook",
        enabled,
      });
      setBoot((prev) => (prev ? { ...prev, skills: data.skills, textNumbers: data.textNumbers ?? prev.textNumbers } : prev));
      setSkillSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the skill.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleSkill(skill: CopilotSkill) {
    const data = await api<{ skills: SkillRow[]; textNumbers?: string[] }>("skill", {
      id: skill.id,
      name: skill.name,
      when: skill.when_text,
      reads: skill.reads,
      drafts: skill.drafts,
      mustNot: skill.must_not,
      phone: skill.phone,
      kind: skill.kind,
      enabled: !skill.enabled,
    });
    setBoot((prev) => (prev ? { ...prev, skills: data.skills, textNumbers: data.textNumbers ?? prev.textNumbers } : prev));
  }

  async function commitRename() {
    const id = renaming;
    const next = renameText.trim();
    setRenaming(null);
    if (!id || !next) return;
    const data = await api<{ chats: CopilotChat[] }>("rename", { chatId: id, title: next });
    setBoot((prev) => (prev ? { ...prev, chats: data.chats } : prev));
  }

  async function confirmDelete() {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;
    if (target.kind === "chat") {
      const data = await api<{ chats: CopilotChat[] }>("delete-chat", { chatId: target.id });
      setBoot((prev) => (prev ? { ...prev, chats: data.chats } : prev));
      if (chatId === target.id) goHome();
      return;
    }
    const data = await api<{ skills: SkillRow[] }>("skill", { action: "delete", id: target.id });
    setBoot((prev) => (prev ? { ...prev, skills: data.skills } : prev));
    setScreen("skills");
  }

  async function saveSkillCard(message: CopilotMessage) {
    const draft = message.draft;
    if (!draft) return;
    const phone = skillPhones[message.id] ?? draft.skillPhone ?? "";
    if (draft.skillKind === "text" && !usablePhone(phone)) {
      setError("Add your mobile number. Nothing was saved.");
      return;
    }
    setBusy(true);
    try {
      const data = await api<{ skills: SkillRow[]; textNumbers?: string[]; chats?: CopilotChat[] }>("draft", {
        messageId: message.id,
        action: "save-skill",
        name: draft.skillName,
        when: draft.skillWhen,
        reads: draft.skillReads,
        drafts: draft.skillDrafts,
        mustNot: draft.skillMustNot,
        kind: draft.skillKind === "text" ? "text" : "playbook",
        phone,
        schedule: draft.skillSchedule === "daily" ? "daily" : "",
      });
      setBoot((prev) => (prev ? { ...prev, skills: data.skills, textNumbers: data.textNumbers ?? prev.textNumbers, chats: data.chats ?? prev.chats } : prev));
      if (chatId) await openChat(chatId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the skill.");
    } finally {
      setBusy(false);
    }
  }

  async function discardSkillCard(message: CopilotMessage) {
    setBusy(true);
    try {
      await api("draft", { messageId: message.id, action: "discard-skill" });
      if (chatId) await openChat(chatId);
    } finally {
      setBusy(false);
    }
  }

  async function updatePassword() {
    if (!pw.next || pw.next !== pw.conf) {
      setPwMsg("err");
      return;
    }
    const data = await api<{ code?: string }>("password", pw);
    setPwMsg(data.code === "current" ? "current" : data.code === "server" ? "server" : "err");
  }

  async function logout() {
    await fetch("/api/admin/session?op=logout", { method: "POST", credentials: "include" });
    window.location.reload();
  }

  function takeFiles(list: FileList | null, kind: "photo" | "doc") {
    const next = Array.from(list ?? []).map((file) => ({
      id: crypto.randomUUID(),
      kind,
      name: file.name,
      size: formatBytes(file.size),
      ext: fileExt(file.name),
      url: kind === "photo" || file.type.startsWith("image/") || file.type === "application/pdf" || /\.pdf$/i.test(file.name) ? URL.createObjectURL(file) : undefined,
      file,
    }));
    if (next.length) setFiles((prev) => [...prev, ...next]);
    if (kind === "photo") setPictureModel((current) => (pictureMode && current === "draft" ? "edit" : current));
    setPlusOpen(false);
  }

  function removeFile(id: string) {
    setFiles((prev) => {
      const item = prev.find((file) => file.id === id);
      if (item?.url) URL.revokeObjectURL(item.url);
      return prev.filter((file) => file.id !== id);
    });
  }

  const waiting = messages.some((m) => m.draft?.status === "waiting");
  const hasPhoto = files.some((file) => file.kind === "photo");
  const activePicture: PictureModelId = (pictureModel === "edit" || pictureModel === "client") && !hasPhoto ? "draft" : pictureModel;
  const lookupDraft = !pictureMode && (webSearch || wantsWeb(text));
  const shownWork: WorkModelId = lookupDraft ? "cursor" : workModel;
  const modelLabel = pictureMode
    ? `${PICTURE_MODELS.find((row) => row.id === activePicture)?.name ?? "Draft"} · ${PICTURE_MODELS.find((row) => row.id === activePicture)?.price ?? ""}`
    : (WORK_MODELS.find((row) => row.id === shownWork)?.name ?? "Auto");
  const focus = (boot?.brief.focus ?? []).filter((c) => !hidden.includes(c.id));
  const eating = (boot?.brief.eating ?? []).filter((c) => !hidden.includes(c.id));
  const chromeOnPhone = /CriOS|FxiOS|EdgiOS/i.test(typeof navigator === "undefined" ? "" : navigator.userAgent);

  function askInstall() {
    if (window.matchMedia("(max-width: 700px)").matches) {
      setInstall(true);
      setSheet(false);
    } else {
      setInstallHint((v) => !v);
    }
  }

  async function dismissCard(id: string) {
    setHidden((ids) => (ids.includes(id) ? ids : [...ids, id]));
    try {
      const data = await api<{ brief: BriefPayload }>("dismiss", { cardId: id });
      setBoot((prev) => (prev ? { ...prev, brief: data.brief } : prev));
    } catch (e) {
      setHidden((ids) => ids.filter((item) => item !== id));
      setError(e instanceof Error ? e.message : "Could not remove that card.");
    }
  }

  function card(item: BriefCard) {
    return (
      <article key={item.id} className="cp-card">
        <div className="cp-card-top">
          <span className="cp-tag">{item.source}</span>
          <div className="cp-people">
            <span className="cp-avatar">{initial(item.source)}</span>
          </div>
          <button type="button" className="cp-x" aria-label="Remove card" onClick={() => void dismissCard(item.id)}>
            <svg width="11" height="11" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
              <path d="M2 2l6 6M8 2L2 8" />
            </svg>
          </button>
        </div>
        <p>{item.text}</p>
        <button type="button" className="cp-cta" disabled={busy} onClick={() => void (item.chatId ? openChat(item.chatId) : openCard(item.text, item.action))}>
          <span className="cp-cta-label">{item.action}</span>
          <span className="cp-go"><Arrow /></span>
        </button>
      </article>
    );
  }

  function sideList() {
    return (
    <>
      <button type="button" className="cp-new" onClick={goEmpty}>
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
          <path d="M8 3v10M3 8h10" />
        </svg>
        New chat
      </button>
      <button type="button" className={`cp-row${screen === "brief" ? " on" : ""}`} onClick={goHome}>
        Overview
      </button>
      <div className="cp-chats">
        {(boot?.chats ?? []).map((chat) => {
          const active = chat.id === chatId && screen === "chat";
          const menuOpen = menuFor === chat.id;
          const working = liveRuns.includes(chat.id) || skills.some((skill) => skill.chat_id === chat.id && skill.lastRun?.status === "running");
          return (
            <div
              key={chat.id}
              className={`cp-chatitem${menuOpen ? " menu" : ""}`}
            >
              {renaming === chat.id ? (
                <input
                  data-chat-menu="1"
                  className="cp-rename"
                  aria-label="Chat name"
                  autoFocus
                  value={renameText}
                  onChange={(e) => setRenameText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void commitRename();
                    } else if (e.key === "Escape") setRenaming(null);
                  }}
                  onBlur={() => void commitRename()}
                />
              ) : (
                <div className={`cp-chatline${active ? " on" : ""}${menuOpen ? " menu" : ""}`}>
                  <button type="button" className="open" onClick={() => void openChat(chat.id)}>
                    {working ? <span className="cp-pulse" aria-label="Working" /> : chat.unread && !active ? <span className="cp-unread" aria-label="Needs you" /> : null}
                    <span className="cp-chat-title">{chat.title}</span>
                    <span className={`cp-time${working ? " work" : ""}`}>{working ? "Working" : when(chat.updated_at)}</span>
                  </button>
                  <button
                    type="button"
                    data-chat-menu="1"
                    className={`cp-dots${menuOpen ? " on" : ""}`}
                    aria-label="Chat options"
                    aria-expanded={menuOpen}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuFor(menuOpen ? null : chat.id);
                    }}
                  >
                    <Dots />
                  </button>
                </div>
              )}
              {menuOpen ? (
                <div data-chat-menu="1" className="cp-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuFor(null);
                      setRenaming(chat.id);
                      setRenameText(chat.title);
                    }}
                  >
                    <Pencil />Rename
                  </button>
                  <div className="rule" />
                  <button
                    type="button"
                    role="menuitem"
                    className="danger"
                    onClick={() => {
                      setMenuFor(null);
                      setPendingDelete({ kind: "chat", id: chat.id, title: chat.title });
                    }}
                  >
                    <Trash />Delete
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="cp-sidefoot">
        <button type="button" className={`cp-footbtn${inSettings ? " on" : ""}`} onClick={() => { setScreen("settings"); setSheet(false); }}>
          Settings
        </button>
        <button type="button" className="cp-install" onClick={askInstall}>
          Install Copilot
        </button>
        {installHint ? <div className="cp-hint">Open this page on your phone, then tap Install Copilot.</div> : null}
      </div>
    </>
    );
  }

  return (
    <div className="cp" data-theme={theme}>
      <header className="cp-top desk">
        <div className="cp-brand">
          <Mark size={22} />
          <span className="cp-brand-name">Mandel Realty Group</span>
        </div>
        <Switcher onModeChange={onModeChange} />
        <button type="button" className="cp-theme" aria-label="Night mode" onClick={() => setThemeAndSave(theme === "dark" ? "light" : "dark")}>
          <Moon />
        </button>
      </header>
      {screen === "board" ? (
        <WorkflowBuilder key={boardKind} seed={boardKind === "blank" ? BLANK : SEED} theme={theme} onBack={() => setScreen("skills")} />
      ) : (
      <div className={`cp-body${stage && !inSettings ? " work" : ""}`}>
        <aside className="cp-side">{sideList()}</aside>
        <main className="cp-main">
          <header className="cp-mobilebar">
            <Mark size={22} />
            <Switcher onModeChange={onModeChange} />
            <button type="button" className="cp-theme" aria-label="Night mode" onClick={() => setThemeAndSave(theme === "dark" ? "light" : "dark")}>
              <Moon />
            </button>
          </header>
          {inSettings ? (
            <header className="cp-mhead">
              <button type="button" className="cp-icon44" onClick={back} style={{ width: "auto", padding: "0 12px 0 6px", gap: 4 }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 4.5L6.5 10l5.5 5.5" />
                </svg>
                {backLabel}
              </button>
              {screen === "skills" && skills.length > 0 ? (
                <button type="button" className="cp-mnew" onClick={startSkill}>New skill</button>
              ) : null}
            </header>
          ) : (
            <header className="cp-mhead">
              <button type="button" className="cp-icon44" aria-label={(boot?.chats ?? []).some((chat) => chat.unread) ? "Chats, needs you" : "Chats"} onClick={() => setSheet(true)}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
                  <path d="M3 6h14M3 10h14M3 14h9" />
                </svg>
                {(boot?.chats ?? []).some((chat) => chat.unread) ? <span className="cp-navdot" /> : null}
              </button>
              <div className="cp-mtitle">
                {screen === "brief" ? null : <span>{title}</span>}
                {waiting ? <span className="cp-count">1</span> : null}
              </div>
              <button type="button" className="cp-icon44" aria-label="New chat" onClick={goEmpty}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
                  <path d="M10 4v12M4 10h12" />
                </svg>
              </button>
            </header>
          )}

          <>
              {screen === "chat" ? (
                <header className="cp-dhead">
                  <span className="who">{title}</span>
                  {waiting ? (
                    <span className="cp-waitbadge">
                      <span className="cp-count">1</span>Waiting
                    </span>
                  ) : null}
                </header>
              ) : null}
              <div className="cp-scroll" ref={scrollRef}>
                {inSettings ? (
                  <div className="cp-col">
                    {screen !== "settings" ? (
                      <button type="button" className="cp-dback" onClick={back}>
                        <BackIcon />
                        {backLabel}
                      </button>
                    ) : null}
                    {screen === "settings" ? (
                      <>
                        <div className="cp-sethead">
                          <h1>Settings</h1>
                          <p>Shared by both partners.</p>
                        </div>
                        <button type="button" className="cp-setrow" onClick={() => setScreen("skills")}>
                          <span><strong>Skills</strong><em>Tools that automate routine work for the business.</em></span>
                          <Chevron />
                        </button>
                        <button type="button" className="cp-setrow" onClick={() => setScreen("connectors")}>
                          <span><strong>Connectors</strong><em>Accounts this chat can use.</em></span>
                          <Chevron />
                        </button>
                        <button type="button" className="cp-setrow" onClick={() => setScreen("account")}>
                          <span><strong>Account</strong><em>Password and log out.</em></span>
                          <Chevron />
                        </button>
                        <button type="button" className="cp-setrow" onClick={() => setScreen("billing")}>
                          <span><strong>Billing</strong><em>What these three accounts have used.</em></span>
                          <Chevron />
                        </button>
                      </>
                    ) : null}
                    {screen === "skills" ? (
                      <SkillsList
                        skills={skills}
                        log={boot?.textLog ?? []}
                        onOpen={(skill) => openSkill(skill)}
                        onToggle={(skill) => void toggleSkill(skill)}
                        onNew={startSkill}
                        onBoard={(kind) => { setBoardKind(kind); setScreen("board"); }}
                      />
                    ) : null}
                    {screen === "skill" && openSkillRecord ? (
                      <SkillDetail
                        skill={openSkillRecord}
                        form={skillForm}
                        onForm={(patch) => { setSkillForm((f) => ({ ...f, ...patch })); setSkillSaved(false); }}
                        saved={skillSaved}
                        busy={busy}
                        runBusy={runBusy}
                        runMsg={runMsg}
                        log={boot?.textLog ?? []}
                        onToggle={() => void toggleSkill(openSkillRecord)}
                        onSave={() => void persistSkill(openSkillRecord.enabled)}
                        onDelete={() => setPendingDelete({ kind: "skill", id: openSkillRecord.id, title: openSkillRecord.name })}
                        onRun={() => void runSkill(openSkillRecord)}
                        onOpenChat={() => void openChat(openSkillRecord.chat_id as string)}
                      />
                    ) : null}
                    {screen === "connectors" ? (
                      <>
                        <div className="cp-sethead">
                          <h1>Connectors</h1>
                          <p>Accounts this chat can use.</p>
                        </div>
                        {(boot?.connectors ?? []).map((row) => {
                          const openTwilio = row.id === "twilio" && row.status === "connected";
                          return (
                          <div key={row.id} className={`cp-crow${openTwilio ? " link" : ""}`} onClick={openTwilio ? () => setScreen("twilio") : undefined}>
                            <div className="cp-crow-copy">
                              <strong>{row.name}</strong>
                              {row.detail ? <div className="desc">{row.detail}</div> : null}
                              <div className={row.status === "connected" ? "ok" : "off"}>{row.statusLabel}</div>
                              {row.note ? <div className="note">{row.note}</div> : null}
                              {connectHint[row.id] ? (
                                <div className="note">
                                  {row.id === "gmail"
                                    ? "Gmail sign-in isn't set up yet. Nothing was connected."
                                    : "WhatsApp linking isn't set up yet. Nothing was connected."}
                                </div>
                              ) : null}
                            </div>
                            {(row.id === "gmail" || row.id === "whatsapp") && row.status !== "connected" ? (
                              <button
                                type="button"
                                className="cp-gold"
                                style={{ height: 36, padding: "0 18px" }}
                                onClick={() => setConnectHint((prev) => ({ ...prev, [row.id]: true }))}
                              >
                                Connect
                              </button>
                            ) : null}
                            {row.id === "hospitable" ? (
                              <button type="button" className="cp-linkish" onClick={() => onModeChange("ops")}>Open OPS Settings</button>
                            ) : null}
                            {openTwilio ? <Chevron /> : null}
                          </div>
                          );
                        })}
                      </>
                    ) : null}
                    {screen === "twilio" ? (
                      <>
                        <div className="cp-sethead">
                          <h1>Twilio</h1>
                          <p>Numbers a skill is allowed to text.</p>
                        </div>
                        <div className="cp-skillbox">
                          <div className="cp-field">
                            <span>From</span>
                            <strong>{boot?.twilioFrom || "Not set on the server."}</strong>
                          </div>
                          <div className="cp-field">
                            <span>Text these numbers</span>
                            {(boot?.textNumbers ?? []).length === 0 && !skills.some((skill) => skill.phone) ? (
                              <span className="cp-quietline">No number yet.</span>
                            ) : null}
                            {Array.from(new Set([...(boot?.textNumbers ?? []), ...skills.map((skill) => skill.phone).filter(Boolean)])).map((phone) => (
                              <div key={phone} className="cp-numrow">
                                <input type="tel" aria-label="Number" value={prettyPhone(phone)} readOnly />
                                <button
                                  type="button"
                                  className="cp-textbtn"
                                  onClick={() => {
                                    void api<{ textNumbers: string[]; skills?: SkillRow[] }>("text-number", { action: "remove", phone }).then((data) => {
                                      setBoot((prev) => (prev ? { ...prev, textNumbers: data.textNumbers, skills: data.skills ?? prev.skills } : prev));
                                    }).catch((e) => setError(e instanceof Error ? e.message : "Could not remove that number."));
                                  }}
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                            <div className="cp-numadd">
                              <input
                                type="tel"
                                placeholder="Add a number"
                                value={numberDraft}
                                onChange={(e) => setNumberDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    if (!usablePhone(numberDraft)) {
                                      setError("That mobile number is not valid.");
                                      return;
                                    }
                                    void api<{ textNumbers: string[] }>("text-number", { phone: numberDraft }).then((data) => {
                                      setNumberDraft("");
                                      setBoot((prev) => (prev ? { ...prev, textNumbers: data.textNumbers } : prev));
                                    }).catch((err) => setError(err instanceof Error ? err.message : "Could not add that number."));
                                  }
                                }}
                              />
                              <button
                                type="button"
                                className="cp-goldlink"
                                onClick={() => {
                                  if (!usablePhone(numberDraft)) {
                                    setError("That mobile number is not valid.");
                                    return;
                                  }
                                  void api<{ textNumbers: string[] }>("text-number", { phone: numberDraft }).then((data) => {
                                    setNumberDraft("");
                                    setBoot((prev) => (prev ? { ...prev, textNumbers: data.textNumbers } : prev));
                                  }).catch((err) => setError(err instanceof Error ? err.message : "Could not add that number."));
                                }}
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        </div>
                        <p className="cp-note">A skill can text only these numbers. Guests, hosts, and clients are never texted.</p>
                      </>
                    ) : null}
                    {screen === "billing" ? (
                      <>
                        <div className="cp-sethead">
                          <h1>Billing</h1>
                          <p>What these three accounts have used.</p>
                        </div>
                        {(accounts ?? [
                          { id: "openai" as const, name: "OpenAI", spent: null, left: null, note: "Checking the account.", keyHint: null, addUrl: ACCOUNT_LINKS.openai },
                          { id: "anthropic" as const, name: "Anthropic", spent: null, left: null, note: "Checking the account.", keyHint: null, addUrl: ACCOUNT_LINKS.anthropic },
                          { id: "cursor" as const, name: "Cursor", spent: null, left: null, note: "Checking the account.", keyHint: null, addUrl: ACCOUNT_LINKS.cursor },
                        ]).map((row) => (
                          <div key={row.id} className="cp-bill">
                            <strong>{row.name}</strong>
                            {row.keyHint ? <span className="split">{row.keyHint}</span> : null}
                            <span className="spent">{row.spent ?? "Spend not recorded"}</span>
                            {row.bars?.map((bar) => (
                              <div key={bar.label} className="cp-usebar">
                                <span>{bar.label}</span>
                                <span>{bar.percent}% used</span>
                                <div className="track" aria-hidden>
                                  <div className="fill" style={{ width: `${Math.min(100, Math.max(0, bar.percent))}%` }} />
                                </div>
                              </div>
                            ))}
                            {row.left ? <span className="split">{row.left}</span> : null}
                            <span className="note">{row.note}</span>
                            <a className="cp-goldlink" href={row.addUrl} target="_blank" rel="noreferrer">Add funds</a>
                          </div>
                        ))}
                        <p className="cp-note">Match the key ending to the key in that console. That is the account Copilot spends from. Add funds opens the page where the balance and the top-up live.</p>
                      </>
                    ) : null}
                    {screen === "account" ? (
                      <>
                        <div className="cp-sethead">
                          <h1>Account</h1>
                        </div>
                        <div className="cp-acct">
                          <div>
                            <h2>Admin password</h2>
                            <p className="sub">The shared login both partners use. Changing it changes it for both.</p>
                          </div>
                          <label className="cp-field">
                            <span>Current password</span>
                            <input type="password" autoComplete="current-password" value={pw.cur} onChange={(e) => { setPw((p) => ({ ...p, cur: e.target.value })); setPwMsg(""); }} />
                          </label>
                          <label className="cp-field">
                            <span>New password</span>
                            <input className={pwMsg === "err" ? "bad" : undefined} type="password" autoComplete="new-password" value={pw.next} onChange={(e) => { setPw((p) => ({ ...p, next: e.target.value })); setPwMsg(""); }} />
                          </label>
                          <label className="cp-field">
                            <span>Confirm new password</span>
                            <input className={pwMsg === "err" ? "bad" : undefined} type="password" autoComplete="new-password" value={pw.conf} onChange={(e) => { setPw((p) => ({ ...p, conf: e.target.value })); setPwMsg(""); }} />
                          </label>
                          <div className="cp-pwmsg" style={{ color: pwMsg === "server" ? "var(--quiet)" : pwMsg ? "var(--danger)" : undefined }}>
                            {pwMsg === "err" ? "Those passwords do not match." : pwMsg === "current" ? "The current password is not right." : pwMsg === "server" ? "The admin password is set on the server. It can't be changed from here yet." : ""}
                          </div>
                          <div className="cp-pw-actions">
                            <button type="button" className="cp-gold" onClick={() => void updatePassword()}>Update password</button>
                          </div>
                        </div>
                        <button type="button" className="cp-logout" onClick={() => void logout()}>Log out</button>
                      </>
                    ) : null}
                  </div>
                ) : null}
                {screen === "brief" && boot ? (
                  <div className="cp-home">
                    {error ? <p className="cp-err">{error}</p> : null}
                    <h1 className="cp-greet">
                      {greetLead(boot.brief.hello)} <strong>team,</strong>
                      <br />
                      <span className="dim">here is what the focus should be today.</span>
                    </h1>
                    {focus.length > 0 ? (
                      <section className="cp-group">
                        <div className="cp-glabel">
                          <h2>Focus today</h2>
                          <span className="cp-badge">{focus.length}</span>
                        </div>
                        <div className="cp-grid">{focus.map(card)}</div>
                      </section>
                    ) : null}
                    {eating.length > 0 ? (
                      <section className="cp-group">
                        <div className="cp-glabel">
                          <h2>Eating time</h2>
                          <span className="cp-badge">{eating.length}</span>
                        </div>
                        <div className="cp-grid">{eating.map(card)}</div>
                      </section>
                    ) : null}
                  </div>
                ) : null}
                {screen === "empty" ? (
                  <div className="cp-empty">
                    <div className="cp-empty-hero">
                      <img className="cp-empty-mark" src="/mrg-logo.png" alt="" width={32} height={32} />
                      <h2>What do you need?</h2>
                    </div>
                    <div className="cp-sugs">
                      {SUGGESTIONS.map((item) => (
                        <button key={item} type="button" onClick={() => void send(item)}>{item}</button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {screen === "chat" ? (
                  <div className="cp-thread">
                    {error ? <p className="cp-err">{error}</p> : null}
                    {messages.map((message) =>
                      message.role === "user" ? (
                        <div key={message.id} className="cp-userwrap">
                          {message.picture ? <span className="cp-via">Make a picture</span> : null}
                          {viaPlus[message.id] ? <span className="cp-via">New skill</span> : null}
                          <div className="cp-user">
                            {message.images?.map((image, index) => (
                              <img key={index} src={`data:${image.mimeType};base64,${image.data}`} alt="" />
                            ))}
                            {message.body ? <span>{message.body}</span> : null}
                          </div>
                        </div>
                      ) : message.draft?.channel === "skill" ? (
                        <div key={message.id} className="cp-bot">
                          <Thinking
                            open={!!trail[message.id]}
                            onToggle={() => setTrail((prev) => ({ ...prev, [message.id]: !prev[message.id] }))}
                            title="Worked"
                            summary={shownTrail(message).summary}
                            thought={shownTrail(message).thought}
                            steps={shownTrail(message).steps}
                          />
                          <SkillDraftCard
                            message={message}
                            phone={skillPhones[message.id] ?? message.draft.skillPhone ?? ""}
                            onPhone={(value) => setSkillPhones((prev) => ({ ...prev, [message.id]: value }))}
                            busy={busy}
                            onSave={() => void saveSkillCard(message)}
                            onSkip={() => void discardSkillCard(message)}
                          />
                        </div>
                      ) : message.report ? (
                        <div key={message.id} className="cp-bot">
                          <ReportCard
                            message={message}
                            report={message.report}
                            running={runBusy || chatSkill?.lastRun?.status === "running"}
                            onRun={chatSkill ? () => void runSkill(chatSkill) : undefined}
                          />
                        </div>
                      ) : message.draft?.channel === "email" ? (
                        <div key={message.id} className="cp-bot">
                          {message.run_id ? null : (
                            <Thinking
                              open={!!trail[message.id]}
                              onToggle={() => setTrail((prev) => ({ ...prev, [message.id]: !prev[message.id] }))}
                              title="Worked"
                              summary={shownTrail(message).summary}
                              thought={shownTrail(message).thought}
                              steps={shownTrail(message).steps}
                            />
                          )}
                          <EmailDraftCard
                            message={message}
                            body={edits[message.id] ?? message.draft.body}
                            onBody={(value) => setEdits((prev) => ({ ...prev, [message.id]: value }))}
                            busy={busy}
                            onApprove={() => void act(message, "send")}
                            onHold={() => void act(message, "hold")}
                          />
                        </div>
                      ) : message.picture && message.images?.length ? (
                        <div key={message.id} className="cp-bot">
                          <figure className="cp-made">
                            {message.images.map((image, index) => (
                              <img key={index} src={`data:${image.mimeType};base64,${image.data}`} alt="" />
                            ))}
                            {message.body ? <figcaption>{message.body}</figcaption> : null}
                          </figure>
                        </div>
                      ) : message.run_id ? (
                        <div key={message.id} className="cp-bot">
                          <span className="cp-sk-stamp">{runWhen(message.created_at, true)}</span>
                          <p className="cp-sk-pre">{message.body}</p>
                        </div>
                      ) : (
                        <div key={message.id} className="cp-bot">
                          <Thinking
                            open={!!trail[message.id]}
                            onToggle={() => setTrail((prev) => ({ ...prev, [message.id]: !prev[message.id] }))}
                            title="Worked"
                            summary={shownTrail(message).summary}
                            thought={shownTrail(message).thought}
                            steps={shownTrail(message).steps}
                          />
                          {message.draft?.status === "waiting" ? <p>{message.body}</p> : <p className={message.draft ? "cp-muted" : undefined}>{message.body}</p>}
                          {message.body.includes("Tell me when you're in.") && !messages.slice(messages.findIndex((item) => item.id === message.id) + 1).some((item) => item.role === "user") ? (
                            <button type="button" className="cp-imin" disabled={busy} onClick={() => void send("I'm in", true)}>I'm in</button>
                          ) : null}
                          {foundPages(message.body).map((url) => (
                            <button
                              key={url}
                              type="button"
                              className="cp-showpage"
                              onClick={() => setStage({ kind: "page", control: false, open: true, url })}
                            >
                              Show {hostOf(url)}
                            </button>
                          ))}
                          {message.choices?.length ? (
                            <ChoiceCard
                              message={message}
                              locked={messages.slice(messages.findIndex((item) => item.id === message.id) + 1).some((item) => item.role === "user") || busy}
                              open={elseFor === message.id}
                              draft={elseDraft}
                              onOpen={() => { setElseFor(message.id); setElseDraft(""); }}
                              onDraft={setElseDraft}
                              onPick={(label) => void send(label, true)}
                              onElse={(value) => void send(value, true)}
                            />
                          ) : null}
                          {message.draft?.status === "waiting" && message.draft.channel === "note" ? (
                            <>
                              <div className="cp-mail">
                                <div className="cp-mail-meta">
                                  <div className="cp-meta-row">
                                    <span className="cp-meta-k">Note</span>
                                    <span className="cp-subject">{message.draft.subject}</span>
                                  </div>
                                </div>
                                <textarea
                                  value={edits[message.id] ?? message.draft.body}
                                  onChange={(e) => setEdits((prev) => ({ ...prev, [message.id]: e.target.value }))}
                                />
                                <div className="cp-mail-note">This stays in Copilot. It is not an email.</div>
                              </div>
                              <div className="cp-waiting">Waiting for you</div>
                              <div className="cp-actions">
                                <button type="button" className="cp-send" disabled={busy} onClick={() => void act(message, "send")}>Keep</button>
                                <button type="button" className="cp-hold" disabled={busy} onClick={() => void act(message, "hold")}>Hold</button>
                              </div>
                            </>
                          ) : null}
                        </div>
                      ),
                    )}
                    {pending ? (
                      <div className="cp-userwrap">
                        {pendingPicture ? <span className="cp-via">Make a picture</span> : null}
                        <div className="cp-user">{pending}</div>
                      </div>
                    ) : null}
                    {pendingPicture ? (
                      <div className="cp-bot">
                        <figure className="cp-made cp-making" aria-live="polite">
                          <div className="cp-making-frame" aria-hidden />
                          <figcaption>Making the picture{pictureWait ? ` · ${pictureWait}` : ""}</figcaption>
                        </figure>
                      </div>
                    ) : null}
                    {stage?.control ? <p className="cp-paused"><i />Paused. Copilot picks up where you leave off.</p> : null}
                    {(pending || thinking) && !pendingPicture ? (
                      <Thinking
                        open={runOpen}
                        onToggle={() => setRunOpen((open) => !open)}
                        title="Exploring"
                        summary={(liveSteps.length + (liveThought ? 1 : 0)) === 1 ? "1 step" : `${liveSteps.length + (liveThought ? 1 : 0)} steps`}
                        thought={liveThought}
                        steps={liveSteps}
                        live
                        onShowBrowser={chatId && !stage && deskMemory.current[chatId]?.kind === "page" ? reopenBrowser : undefined}
                      />
                    ) : null}
                    {stopped && !pending && !thinking ? <p className="cp-muted">Stopped. Nothing was sent.</p> : null}
                    {chatId && !stage && !thinking && !pending && deskMemory.current[chatId]?.kind === "page" ? (
                      <button type="button" className="cp-showbrowser alone" onClick={reopenBrowser}>Show browser</button>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {inSettings ? null : (
              <div className="cp-composer-wrap">
                <div className="cp-confirm">Nothing goes out until you confirm.</div>
                <div className="cp-pluswrap" data-plus="1">
                  {plusOpen ? (
                    <div className="cp-plusmenu" role="menu">
                      <button type="button" role="menuitem" onClick={() => { setPlusOpen(false); photoRef.current?.click(); }}><PhotoIcon />Photo</button>
                      <button type="button" role="menuitem" onClick={() => { setPlusOpen(false); docRef.current?.click(); }}><DocIcon />Document</button>
                      <button type="button" role="menuitem" onClick={() => { setPlusOpen(false); setPictureMode(true); setSkillMode(false); setWebSearch(false); if (files.some((file) => file.kind === "photo")) setPictureModel((current) => (current === "draft" ? "edit" : current)); }}><PictureIcon />Make a picture</button>
                      <button type="button" role="menuitemcheckbox" aria-checked={webSearch} onClick={() => { setPlusOpen(false); setWebSearch((on) => !on); setPictureMode(false); setSkillMode(false); }}>
                        <GlobeIcon />Web search
                        {webSearch ? <CheckIcon /> : null}
                      </button>
                      <button type="button" role="menuitem" onClick={() => { setPlusOpen(false); setSkillMode(true); setWebSearch(false); setPictureMode(false); }}><SkillIcon />Create a skill</button>
                    </div>
                  ) : null}
                  <div className={`cp-composer${files.length ? " stacked" : ""}`}>
                    {files.length > 0 ? (
                      <div className="cp-tray">
                        {files.map((file) => (
                          <div key={file.id} className="cp-attach">
                            {file.kind === "photo" ? (
                              <img className="cp-thumb" src={file.url} alt="" />
                            ) : (
                              <div className="cp-doc">
                                <span className="ext">{file.ext}</span>
                                <span className="meta">
                                  <span className="name">{file.name}</span>
                                  <span className="size">{file.size}</span>
                                </span>
                              </div>
                            )}
                            <button type="button" className="cp-attach-x" aria-label="Remove attachment" onClick={() => removeFile(file.id)}>
                              <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                                <path d="M2 2l6 6M8 2L2 8" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="cp-composer-row">
                    <button type="button" className={`cp-iconbtn${plusOpen ? " open" : ""}`} aria-label="Add" aria-expanded={plusOpen} onClick={() => setPlusOpen((v) => !v)}>
                      <Plus />
                    </button>
                    <input ref={photoRef} type="file" accept="image/*" multiple hidden onChange={(e) => { takeFiles(e.target.files, "photo"); e.target.value = ""; }} />
                    <input ref={docRef} type="file" accept=".pdf,.doc,.docx,.txt,image/*" multiple hidden onChange={(e) => { takeFiles(e.target.files, "doc"); e.target.value = ""; }} />
                    {webSearch ? (
                      <span className="cp-skillchip">
                        Web search
                        <button type="button" aria-label="Turn off web search" onClick={() => setWebSearch(false)}>
                          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
                            <path d="M2 2l6 6M8 2L2 8" />
                          </svg>
                        </button>
                      </span>
                    ) : null}
                    {pictureMode ? (
                      <span className="cp-skillchip">
                        Make a picture
                        <button type="button" aria-label="Remove" onClick={() => setPictureMode(false)}>
                          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
                            <path d="M2 2l6 6M8 2L2 8" />
                          </svg>
                        </button>
                      </span>
                    ) : null}
                    {skillMode ? (
                      <span className="cp-skillchip">
                        Create a skill
                        <button type="button" aria-label="Remove" onClick={() => setSkillMode(false)}>
                          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
                            <path d="M2 2l6 6M8 2L2 8" />
                          </svg>
                        </button>
                      </span>
                    ) : null}
                    <textarea
                      ref={taRef}
                      rows={1}
                      placeholder={skillMode ? "Describe the skill" : pictureMode ? "Describe the picture" : webSearch ? "Search the web" : "Ask MRG"}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void send();
                        }
                      }}
                    />
                    <div className="cp-modelwrap" data-model="1">
                      {modelOpen ? (
                        <div className="cp-modelmenu" role="menu">
                          {(pictureMode ? PICTURE_MODELS : WORK_MODELS).map((row) => {
                            const locked = "needsPhoto" in row && row.needsPhoto && !hasPhoto;
                            const on = pictureMode ? row.id === activePicture : row.id === shownWork;
                            return (
                              <button
                                key={row.id}
                                type="button"
                                role="menuitemradio"
                                aria-checked={on}
                                disabled={locked}
                                onClick={() => {
                                  if (locked) return;
                                  if (pictureMode && (row.id === "draft" || row.id === "edit" || row.id === "client")) setPictureModel(row.id);
                                  if (!pictureMode && (row.id === "auto" || row.id === "haiku" || row.id === "sonnet" || row.id === "cursor")) setWorkModel(row.id);
                                  setModelOpen(false);
                                }}
                              >
                                <span>
                                  <strong>{row.name}</strong>
                                  <em>{locked ? "Add a photo first." : row.line}</em>
                                </span>
                                {"price" in row ? <b>{row.price}</b> : null}
                                {on ? <CheckIcon /> : <span className="cp-modelgap" />}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                      <button
                        type="button"
                        className="cp-modelbtn"
                        aria-expanded={modelOpen}
                        aria-haspopup="menu"
                        onClick={() => { setModelOpen((open) => !open); setPlusOpen(false); }}
                      >
                        {modelLabel}
                      </button>
                    </div>
                    <button
                      type="button"
                      className={`cp-up${pending || thinking ? " stop" : ""}`}
                      aria-label={pending || thinking ? "Stop" : "Send"}
                      disabled={!(pending || thinking) && !text.trim() && files.length === 0}
                      style={{ opacity: pending || thinking || text.trim() || files.length ? 1 : 0.45 }}
                      onMouseDown={() => { sendDown.current = true; }}
                      onClick={() => {
                        const fromHere = sendDown.current;
                        sendDown.current = false;
                        if (pending || thinking) {
                          if (fromHere) stopRun();
                          return;
                        }
                        void send();
                      }}
                    >
                      {pending || thinking ? <span className="sq" /> : <Up />}
                    </button>
                    </div>
                  </div>
                </div>
                <div className="cp-deskpad" />
                <div className="cp-homebar" />
              </div>
              )}
            </>
        </main>
        {stage && !inSettings ? (
          <aside className={`cp-stage${stage.control ? " control" : ""}`}>
            <div className="cp-stage-frame">
              {stage.kind === "pdf" ? (
                <>
                  <div className="cp-stage-bar">
                    <div className="cp-stage-file">
                      <strong>{stage.pdfName || "Document.pdf"}</strong>
                      <span>Opened in Copilot</span>
                    </div>
                    {stage.pdfUrl ? <a href={stage.pdfUrl} download={stage.pdfName || "document.pdf"}>Download</a> : null}
                    <button type="button" onClick={() => setStage(null)}>Close</button>
                  </div>
                  {stage.pdfUrl ? <iframe title={stage.pdfName || "PDF"} src={stage.pdfUrl} /> : <p className="cp-stage-empty">This PDF isn’t available to preview.</p>}
                </>
              ) : (
                <>
                  <div className="cp-stage-bar">
                    <div className="cp-stage-url">
                      <span className={stage.control ? "cp-pause" : "cp-pulse"} aria-hidden />
                      <Address url={stage.url} />
                    </div>
                    <button type="button" onClick={() => {
                      if (chatId) {
                        deskMemory.current[chatId] = stage;
                        closedBrowsers.current.add(chatId);
                      }
                      setStage(null);
                    }}>Close</button>
                  </div>
                  <div className={`cp-stage-page${stage.image ? " shot" : ""}`}>
                    {stage.image ? (
                      <div className="cp-shotwrap">
                        <img src={stage.image} alt="" />
                        {stage.pointer && !stage.control ? (
                          <span className="cp-agentcursor" style={{ left: `${stage.pointer.x}%`, top: `${stage.pointer.y}%` }}>
                            <Pointer />
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <p>Opening the browser</p>
                    )}
                    <div className="cp-stage-fade" />
                    <button
                      type="button"
                      className="cp-takeover"
                      onClick={() => setStage({ ...stage, control: !stage.control })}
                    >
                      <Pointer />
                      {stage.control ? "Resume" : "Take over"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </aside>
        ) : null}
        {report ? (
          <aside className="cp-panel">
            <div className="cp-panel-bar">
              <button type="button" className="cp-back" onClick={() => setReport(false)}>Chat</button>
              <strong>Sourcing report · PDF</strong>
              <span>Not ready</span>
            </div>
            <div className="cp-panel-body">
              <div className="cp-pdf">
                <div>
                  <div className="kicker">MANDEL REALTY GROUP</div>
                  <h3>Furniture sourcing</h3>
                </div>
                <p style={{ margin: 0, fontSize: 14 }}>
                  Attach the floor plan, the measurements, and photos of the unit. I will not invent a product, a price, or a layout that is not in those files.
                </p>
                <div className="fine">Draft. Not sent to the client.</div>
              </div>
            </div>
          </aside>
        ) : null}
        {sheet ? (
          <div className="cp-sheet">
            <header className="cp-mobilebar">
              <Mark size={22} />
              <Switcher onModeChange={onModeChange} />
              <button type="button" className="cp-theme" aria-label="Night mode" onClick={() => setThemeAndSave(theme === "dark" ? "light" : "dark")}>
                <Moon />
              </button>
            </header>
            <div className="cp-sheet-head">
              <span>Chats</span>
              <button type="button" className="cp-icon44" aria-label="Close" onClick={() => setSheet(false)}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
                  <path d="M4 4l10 10M14 4L4 14" />
                </svg>
              </button>
            </div>
            <div className="pad">{sideList()}</div>
            <div className="cp-safe" />
          </div>
        ) : null}
      </div>
      )}
      {pendingDelete ? (
        <div className="cp-dialog">
          <button type="button" className="dim" aria-label="Keep" onClick={() => setPendingDelete(null)} />
          <div className="card" role="dialog" aria-modal="true" aria-label={pendingDelete.kind === "chat" ? "Delete this chat?" : "Delete this skill?"}>
            <div>
              <h2>{pendingDelete.kind === "chat" ? "Delete this chat?" : "Delete this skill?"}</h2>
              <p>
                {pendingDelete.kind === "chat"
                  ? `“${pendingDelete.title}” will be removed for both partners.`
                  : `${pendingDelete.title} stops running and is removed for both partners.`}
              </p>
            </div>
            <div className="cp-modal-actions">
              <button type="button" className="cp-danger" onClick={() => void confirmDelete()}>Delete</button>
              <button type="button" className="cp-textbtn" onClick={() => setPendingDelete(null)}>Keep</button>
            </div>
          </div>
        </div>
      ) : null}
      {install ? (
        <div className="cp-install-sheet">
          <button type="button" className="cp-dim" aria-label="Close" onClick={() => setInstall(false)} />
          <div className="cp-install-card">
            <div className="cp-grab" />
            <div className="cp-install-id">
              <img src="/mrg-logo.png" alt="" />
              <div>
                <strong>Add Copilot to your home screen.</strong>
                <div><span>This installs Copilot only.</span></div>
              </div>
            </div>
            {chromeOnPhone ? (
              <div className="cp-steps">
                <p style={{ margin: 0 }}>Open this page in Safari first. On iPhone, apps can only be added to the home screen from Safari.</p>
                <button
                  type="button"
                  className="cp-full"
                  onClick={() => {
                    navigator.clipboard?.writeText(window.location.href).then(() => setCopied(true)).catch(() => setCopied(true));
                  }}
                >
                  {copied ? "Link copied. Paste it in Safari." : "Copy link instead"}
                </button>
              </div>
            ) : (
              <div className="cp-steps">
                <div className="cp-step-row">
                  <span className="cp-num">1</span>
                  <p>Tap <span className="cp-ico" aria-hidden>↑</span> Share in the Safari bar</p>
                </div>
                <div className="cp-step-row">
                  <span className="cp-num">2</span>
                  <p>Choose <span className="cp-ico" aria-hidden>+</span> Add to Home Screen</p>
                </div>
                <div className="cp-step-row">
                  <span className="cp-num">3</span>
                  <p>Tap <strong>Add</strong> in the top right</p>
                </div>
                <button type="button" className="cp-full" onClick={() => setInstall(false)}>Close</button>
              </div>
            )}
            <div className="cp-safe" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
