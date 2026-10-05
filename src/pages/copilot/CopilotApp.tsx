import { useEffect, useMemo, useRef, useState } from "react";
import type { AdminProductMode } from "../clients/mode";
import type { BriefCard, BriefPayload, ConnectorRow, CopilotChat, CopilotMessage, CopilotSkill } from "../../../shared/copilot/types";
import "./copilot.css";

type Screen = "brief" | "empty" | "chat" | "settings" | "skills" | "skill" | "connectors" | "account";

type Boot = {
  brief: BriefPayload;
  chats: CopilotChat[];
  skills: CopilotSkill[];
  connectors: ConnectorRow[];
  billing: string;
};

type SkillForm = { name: string; when: string; reads: string; drafts: string; mustNot: string };

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

function workFor(message: CopilotMessage): { thought: string; steps: { text: string }[] } {
  const steps = [{ text: "Read your message" }];
  const draft = message.draft;
  if (draft?.channel === "skill") {
    steps.push({ text: "Wrote the skill and left it waiting" });
    return { thought: "This is a playbook. Saving it does not send anything.", steps };
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
  if (draft) {
    steps.push({ text: "Drafted the note" });
    if (draft.status === "held") {
      steps.push({ text: "You held it. Nothing was sent" });
      return { thought: "You held this. Nothing was sent.", steps };
    }
    if (draft.status === "approved_unsent") {
      steps.push({ text: "You approved it. It was not sent" });
      return { thought: "You approved this. Gmail is not connected, so it was not sent.", steps };
    }
    steps.push({ text: "Left it waiting. Nothing was sent" });
    return { thought: "I wrote the draft and stopped. It stays here until you confirm.", steps };
  }
  steps.push({ text: "Answered from what is already saved" });
  steps.push({ text: "Nothing was sent" });
  return { thought: "I used what is already in this account. I did not look outside it.", steps };
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

function Thinking({
  open,
  onToggle,
  title,
  summary,
  thought,
  steps,
  live,
  onStop,
}: {
  open: boolean;
  onToggle: () => void;
  title: string;
  summary: string;
  thought?: string;
  steps: { text: string; meta?: string }[];
  live?: boolean;
  onStop?: () => void;
}) {
  return (
    <div className="cp-think">
      <button type="button" className="cp-think-head" onClick={onToggle}>
        <span className="label">{title}</span>
        {summary ? <span className="count">{summary}</span> : null}
        <ThinkChevron open={open} />
      </button>
      {open ? (
        <div className="cp-think-body">
          {thought ? <p>{thought}</p> : null}
          {steps.length > 0 ? (
            <div className="cp-think-steps">
              {steps.map((step) => (
                <div key={step.text} className="cp-think-step">
                  <ThinkCheck />
                  <span>{step.text}</span>
                  {step.meta ? <span className="meta">{step.meta}</span> : null}
                </div>
              ))}
            </div>
          ) : null}
          {live ? (
            <div className="cp-think-live">
              <span className="cp-pulse" />
              <span className="cp-shimmer">Planning next moves</span>
            </div>
          ) : null}
        </div>
      ) : null}
      {live ? (
        <button type="button" className="cp-stop" onClick={onStop}>
          <span className="sq" />
          Stop
        </button>
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
  const [screen, setScreen] = useState<Screen>("brief");
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [install, setInstall] = useState(false);
  const [installHint, setInstallHint] = useState(false);
  const [copied, setCopied] = useState(false);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<string[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [trail, setTrail] = useState<Record<string, boolean>>({});
  const [report, setReport] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [skillMode, setSkillMode] = useState(false);
  const [viaPlus, setViaPlus] = useState<Record<string, boolean>>({});
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  const [pendingDelete, setPendingDelete] = useState<{ kind: "chat" | "skill"; id: string; title: string } | null>(null);
  const [skillId, setSkillId] = useState<string | null>(null);
  const [skillForm, setSkillForm] = useState<SkillForm>({ name: "", when: "", reads: "", drafts: "", mustNot: "" });
  const [skillSaved, setSkillSaved] = useState(false);
  const [pw, setPw] = useState({ cur: "", next: "", conf: "" });
  const [pwMsg, setPwMsg] = useState<"" | "err" | "current" | "server">("");
  const [pending, setPending] = useState<string | null>(null);
  const [runOpen, setRunOpen] = useState(true);
  const [stopped, setStopped] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const photoRef = useRef<HTMLInputElement | null>(null);
  const docRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    document.title = "Copilot | Mandel Realty Group";
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = "/copilot.webmanifest";
    document.head.appendChild(link);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/copilot-sw.js").catch(() => undefined);
    }
    return () => {
      link.remove();
      document.title = "CRM | Mandel Realty Group";
    };
  }, []);

  async function load() {
    const data = await api<Boot>("boot");
    setBoot(data);
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Could not load Copilot."));
  }, []);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "38px";
    el.style.height = `${Math.min(el.scrollHeight, 110)}px`;
  }, [text]);

  useEffect(() => {
    function down(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (menuFor && !target?.closest("[data-chat-menu]")) setMenuFor(null);
      if (plusOpen && !target?.closest("[data-plus]")) setPlusOpen(false);
    }
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [menuFor, plusOpen]);

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
  }

  function goEmpty() {
    setChatId(null);
    setMessages([]);
    setScreen("empty");
    setSheet(false);
    setReport(false);
  }

  async function openChat(id: string) {
    setChatId(id);
    setScreen("chat");
    setSheet(false);
    setReport(false);
    setStopped(false);
    const data = await api<{ messages: CopilotMessage[] }>(`messages&chatId=${encodeURIComponent(id)}`);
    setMessages(data.messages);
  }

  async function openCard(cardText: string, action: string) {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPending(cardText);
    setRunOpen(true);
    setStopped(false);
    setBusy(true);
    setError(null);
    setSheet(false);
    setScreen("chat");
    try {
      const data = await api<{ chat: CopilotChat; messages: CopilotMessage[] }>("card", {
        text: cardText,
        action,
      }, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setChatId(data.chat.id);
      setMessages(data.messages);
      setScreen("chat");
      await load();
    } catch (e) {
      if (ctrl.signal.aborted) setStopped(true);
      else setError(e instanceof Error ? e.message : "Could not open the draft.");
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
      setPending(null);
      setBusy(false);
    }
  }

  async function send(preset?: string) {
    const attached = files.length ? `\nAttached: ${files.join(", ")}` : "";
    const value = `${(preset ?? text).trim()}${preset ? "" : attached}`.trim();
    if (!value || busy) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPending(value);
    setRunOpen(true);
    setStopped(false);
    setBusy(true);
    setError(null);
    setScreen("chat");
    if (!preset) {
      setText("");
      setFiles([]);
    }
    try {
      const makingSkill = skillMode && !preset;
      const data = await api<{ chatId: string; messages: CopilotMessage[] }>("send", {
        text: value,
        chatId: preset ? null : chatId,
        kind: "chat",
        skillMode: makingSkill,
      }, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setChatId(data.chatId);
      setMessages(data.messages);
      if (makingSkill) {
        const user = [...data.messages].reverse().find((m) => m.role === "user");
        if (user) setViaPlus((prev) => ({ ...prev, [user.id]: true }));
        setSkillMode(false);
      }
      setScreen("chat");
      setSheet(false);
      setPlusOpen(false);
      if (/floor plan|sourcing|furniture report/i.test(value)) setReport(true);
      await load();
    } catch (e) {
      if (ctrl.signal.aborted) {
        setStopped(true);
        if (!preset) setText(value);
      } else {
        setError(e instanceof Error ? e.message : "Could not send.");
        if (!preset) setText(value);
      }
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
      setPending(null);
      setBusy(false);
    }
  }

  function stopRun() {
    abortRef.current?.abort();
  }

  async function act(message: CopilotMessage, action: "send" | "hold") {
    setBusy(true);
    try {
      await api("draft", {
        messageId: message.id,
        action,
        edited: edits[message.id] ?? message.draft?.body ?? "",
      });
      if (chatId) await openChat(chatId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the draft.");
    } finally {
      setBusy(false);
    }
  }

  const inSettings = screen === "settings" || screen === "skills" || screen === "skill" || screen === "connectors" || screen === "account";
  const skills = boot?.skills ?? [];
  const openSkillRecord = skills.find((s) => s.id === skillId) ?? null;

  const title = useMemo(() => {
    if (screen === "brief") return "Overview";
    if (screen === "empty") return "New chat";
    return boot?.chats.find((c) => c.id === chatId)?.title || "New chat";
  }, [boot, chatId, screen]);

  const backLabel =
    screen === "skills" || screen === "connectors" || screen === "account"
      ? "Settings"
      : screen === "skill"
        ? "Skills"
        : "Chats";

  function back() {
    if (screen === "skill") setScreen("skills");
    else if (screen === "skills" || screen === "connectors" || screen === "account") setScreen("settings");
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
    });
    setSkillSaved(false);
    setScreen("skill");
    setSheet(false);
  }

  async function persistSkill(enabled: boolean) {
    if (!skillForm.name.trim()) return;
    setBusy(true);
    try {
      const data = await api<{ skills: CopilotSkill[] }>("skill", {
        id: skillId,
        name: skillForm.name,
        when: skillForm.when,
        reads: skillForm.reads,
        drafts: skillForm.drafts,
        mustNot: skillForm.mustNot,
        enabled,
      });
      setBoot((prev) => (prev ? { ...prev, skills: data.skills } : prev));
      setSkillSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the skill.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleSkill(skill: CopilotSkill) {
    const data = await api<{ skills: CopilotSkill[] }>("skill", {
      id: skill.id,
      name: skill.name,
      when: skill.when_text,
      reads: skill.reads,
      drafts: skill.drafts,
      mustNot: skill.must_not,
      enabled: !skill.enabled,
    });
    setBoot((prev) => (prev ? { ...prev, skills: data.skills } : prev));
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
    const data = await api<{ skills: CopilotSkill[] }>("skill", { action: "delete", id: target.id });
    setBoot((prev) => (prev ? { ...prev, skills: data.skills } : prev));
    setScreen("skills");
  }

  async function saveSkillCard(message: CopilotMessage) {
    const draft = message.draft;
    if (!draft) return;
    setBusy(true);
    try {
      const data = await api<{ skills: CopilotSkill[] }>("draft", {
        messageId: message.id,
        action: "save-skill",
        name: draft.skillName,
        when: draft.skillWhen,
        reads: draft.skillReads,
        drafts: draft.skillDrafts,
        mustNot: draft.skillMustNot,
      });
      setBoot((prev) => (prev ? { ...prev, skills: data.skills } : prev));
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

  function takeFiles(list: FileList | null) {
    setFiles(Array.from(list ?? []).map((file) => file.name));
    setPlusOpen(false);
  }

  const waiting = messages.some((m) => m.draft?.status === "waiting");
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
        <button type="button" className="cp-cta" disabled={busy} onClick={() => void openCard(item.text, item.action)}>
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
                    <span className="cp-chat-title">{chat.title}</span>
                    <span className="cp-time">{when(chat.updated_at)}</span>
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
      <div className="cp-bill">
        <span className="quiet">Cursor · this cycle</span>
        <span className="used">Usage from the team bill.</span>
      </div>
      <button type="button" className={`cp-footbtn${inSettings ? " on" : ""}`} onClick={() => { setScreen("settings"); setSheet(false); }}>
        Settings
      </button>
      <button type="button" className="cp-install" onClick={askInstall}>
        Install Copilot
      </button>
      {installHint ? <div className="cp-hint">Open this page on your phone, then tap Install Copilot.</div> : null}
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
      <div className="cp-body">
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
              <button type="button" className="cp-icon44" aria-label="Chats" onClick={() => setSheet(true)}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
                  <path d="M3 6h14M3 10h14M3 14h9" />
                </svg>
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
                          <span><strong>Skills</strong><em>Playbooks Copilot prepares overnight.</em></span>
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
                      </>
                    ) : null}
                    {screen === "skills" ? (
                      <>
                        <div className="cp-sethead split">
                          <div>
                            <h1>Skills</h1>
                            <p>Playbooks Copilot prepares overnight.</p>
                          </div>
                          <button type="button" className="cp-newskill-desk" onClick={startSkill}>New skill</button>
                        </div>
                        {skills.length === 0 ? (
                          <div className="cp-empty-skill">
                            <strong>No skills yet.</strong>
                            <button type="button" className="cp-goldlink" onClick={startSkill}>New skill</button>
                          </div>
                        ) : skills.map((skill) => (
                          <div key={skill.id} className="cp-skillrow" onClick={() => openSkill(skill)}>
                            <span className="copy">
                              <strong className={skill.enabled ? undefined : "off"}>{skill.name}</strong>
                              <em>{skill.when_text}</em>
                            </span>
                            <button
                              type="button"
                              className={`cp-pill${skill.enabled ? "" : " off"}`}
                              aria-label={skill.enabled ? "Turn off" : "Turn on"}
                              onClick={(e) => {
                                e.stopPropagation();
                                void toggleSkill(skill);
                              }}
                            >
                              {skill.enabled ? "On" : "Off"}
                            </button>
                            <Chevron />
                          </div>
                        ))}
                      </>
                    ) : null}
                    {screen === "skill" && openSkillRecord ? (
                      <>
                        <div className="cp-sethead">
                          <h1>{skillForm.name || openSkillRecord.name}</h1>
                          <p style={{ color: openSkillRecord.enabled ? "var(--muted)" : "var(--quiet)" }}>
                            {openSkillRecord.enabled ? "On · runs overnight" : "Off · will not run"}
                          </p>
                        </div>
                        <div className="cp-skillbox">
                          {(
                            [
                              ["Name", "name"],
                              ["When it runs", "when"],
                              ["What it reads", "reads"],
                              ["What it drafts", "drafts"],
                              ["It must not", "mustNot"],
                            ] as const
                          ).map(([label, key]) => (
                            <label key={key} className="cp-field">
                              <span>{label}</span>
                              <textarea className="box" rows={key === "name" ? 1 : 3} value={skillForm[key]} onChange={(e) => { setSkillForm((f) => ({ ...f, [key]: e.target.value })); setSkillSaved(false); }} />
                            </label>
                          ))}
                        </div>
                        <div className="cp-skill-actions">
                          <button type="button" className="cp-gold" disabled={busy} onClick={() => void persistSkill(openSkillRecord.enabled)}>{skillSaved ? "Saved" : "Save"}</button>
                          <button type="button" className="cp-textbtn" disabled={busy} onClick={() => void toggleSkill(openSkillRecord)}>{openSkillRecord.enabled ? "Turn off" : "Turn on"}</button>
                          <button type="button" className="cp-textbtn danger" onClick={() => setPendingDelete({ kind: "skill", id: openSkillRecord.id, title: openSkillRecord.name })}>Delete</button>
                        </div>
                        <p className="cp-note">Saving does not send anything. The next run only prepares a draft.</p>
                      </>
                    ) : null}
                    {screen === "connectors" ? (
                      <>
                        <div className="cp-sethead">
                          <h1>Connectors</h1>
                          <p>Accounts this chat can use.</p>
                        </div>
                        {(boot?.connectors ?? []).map((row) => (
                          <div key={row.id} className="cp-crow">
                            <div className="cp-crow-copy">
                              <strong>{row.name}</strong>
                              {row.detail ? <div className="desc">{row.detail}</div> : null}
                              <div className={row.status === "connected" ? "ok" : "off"}>{row.statusLabel}</div>
                              {row.note ? <div className="note">{row.note}</div> : null}
                            </div>
                            {(row.id === "gmail" || row.id === "whatsapp") && row.status !== "connected" ? (
                              <button type="button" className="cp-gold" style={{ height: 36, padding: "0 18px" }}>Connect</button>
                            ) : null}
                            {row.id === "hospitable" ? (
                              <button type="button" className="cp-linkish" onClick={() => onModeChange("ops")}>Open OPS Settings</button>
                            ) : null}
                          </div>
                        ))}
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
                          {viaPlus[message.id] ? <span className="cp-via">Create a skill</span> : null}
                          <div className="cp-user">{message.body}</div>
                        </div>
                      ) : message.draft?.channel === "skill" ? (
                        <div key={message.id} className="cp-bot">
                          <Thinking
                            open={!!trail[message.id]}
                            onToggle={() => setTrail((prev) => ({ ...prev, [message.id]: !prev[message.id] }))}
                            title="Worked"
                            summary={`${workFor(message).steps.length} steps`}
                            thought={workFor(message).thought}
                            steps={workFor(message).steps}
                          />
                          <p>{message.body}</p>
                          <div className="cp-skillcard">
                            {(
                              [
                                ["Name", message.draft.skillName],
                                ["When it runs", message.draft.skillWhen],
                                ["What it reads", message.draft.skillReads],
                                ["What it drafts", message.draft.skillDrafts],
                                ["It must not", message.draft.skillMustNot],
                              ] as const
                            ).map(([label, value]) => (
                              <div key={label} className="row">
                                <span className="k">{label}</span>
                                <span className="v">{value}</span>
                              </div>
                            ))}
                            {message.draft.status === "approved_unsent" ? (
                              <div className="cp-saved">
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                  <path d="M3 7.5l2.5 2.5L11 4.5" />
                                </svg>
                                Saved to Skills
                              </div>
                            ) : null}
                          </div>
                          {message.draft.status === "waiting" ? (
                            <>
                              <div className="cp-waiting">Waiting for you</div>
                              <div className="cp-actions">
                                <button type="button" className="cp-send" disabled={busy} onClick={() => void saveSkillCard(message)}>Save skill</button>
                                <button type="button" className="cp-hold" disabled={busy} onClick={() => void discardSkillCard(message)}>Discard</button>
                              </div>
                              <p className="cp-quietline">Saving keeps the playbook. It still will not send until you approve a draft.</p>
                            </>
                          ) : null}
                          {message.draft.status === "approved_unsent" ? <p>Saved. Tonight it only prepares a draft. Nothing sends until you approve it.</p> : null}
                          {message.draft.status === "held" ? <p className="cp-muted">Discarded. Nothing was saved.</p> : null}
                        </div>
                      ) : (
                        <div key={message.id} className="cp-bot">
                          <Thinking
                            open={!!trail[message.id]}
                            onToggle={() => setTrail((prev) => ({ ...prev, [message.id]: !prev[message.id] }))}
                            title="Worked"
                            summary={`${workFor(message).steps.length} steps`}
                            thought={workFor(message).thought}
                            steps={workFor(message).steps}
                          />
                          {message.draft?.status === "waiting" ? <p>{message.body}</p> : <p className={message.draft ? "cp-muted" : undefined}>{message.body}</p>}
                          {message.draft?.status === "waiting" ? (
                            <>
                              <div className="cp-mail">
                                <div className="cp-mail-meta">
                                  <div className="cp-meta-row">
                                    <span className="cp-meta-k">From</span>
                                    <span className="cp-meta-v">Gmail is not connected</span>
                                  </div>
                                  <div className="cp-meta-row">
                                    <span className="cp-meta-k">To</span>
                                    <span className="cp-chip">{message.draft.to || "Not set"}</span>
                                  </div>
                                  <div className="cp-meta-row">
                                    <span className="cp-meta-k">Subject</span>
                                    <span className="cp-subject">{message.draft.subject}</span>
                                  </div>
                                </div>
                                <textarea
                                  value={edits[message.id] ?? message.draft.body}
                                  onChange={(e) => setEdits((prev) => ({ ...prev, [message.id]: e.target.value }))}
                                />
                              </div>
                              <div className="cp-waiting">Waiting for you</div>
                              <div className="cp-actions">
                                <button type="button" className="cp-send" disabled={busy} onClick={() => void act(message, "send")}>Send</button>
                                <button type="button" className="cp-hold" disabled={busy} onClick={() => void act(message, "hold")}>Hold</button>
                              </div>
                            </>
                          ) : null}
                        </div>
                      ),
                    )}
                    {pending ? (
                      <>
                        <div className="cp-userwrap">
                          <div className="cp-user">{pending}</div>
                        </div>
                        <Thinking
                          open={runOpen}
                          onToggle={() => setRunOpen((open) => !open)}
                          title="Exploring"
                          summary="1 step"
                          steps={[{ text: "Read your message" }]}
                          live
                          onStop={stopRun}
                        />
                      </>
                    ) : null}
                    {stopped && !pending ? <p className="cp-muted">Stopped. Nothing was sent.</p> : null}
                  </div>
                ) : null}
              </div>
              {inSettings ? null : (
              <div className="cp-composer-wrap">
                <div className="cp-confirm">Nothing goes out until you confirm.</div>
                {files.length > 0 ? <div className="cp-files">{files.join(", ")}</div> : null}
                <div className="cp-pluswrap" data-plus="1">
                  {plusOpen ? (
                    <div className="cp-plusmenu" role="menu">
                      <button type="button" role="menuitem" onClick={() => photoRef.current?.click()}><PhotoIcon />Photo</button>
                      <button type="button" role="menuitem" onClick={() => docRef.current?.click()}><DocIcon />Document</button>
                      <button type="button" role="menuitem" onClick={() => { setPlusOpen(false); setSkillMode(true); }}><SkillIcon />Create a skill</button>
                    </div>
                  ) : null}
                  <div className="cp-composer">
                    <button type="button" className={`cp-iconbtn${plusOpen ? " open" : ""}`} aria-label="Add" aria-expanded={plusOpen} onClick={() => setPlusOpen((v) => !v)}>
                      <Plus />
                    </button>
                    <input ref={photoRef} type="file" accept="image/*" multiple hidden onChange={(e) => { takeFiles(e.target.files); e.target.value = ""; }} />
                    <input ref={docRef} type="file" accept=".pdf,.doc,.docx,.txt,image/*" multiple hidden onChange={(e) => { takeFiles(e.target.files); e.target.value = ""; }} />
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
                      placeholder={skillMode ? "Describe the skill" : "Ask MRG"}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void send();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="cp-up"
                      aria-label="Send"
                      disabled={busy || (!text.trim() && files.length === 0)}
                      style={{ opacity: text.trim() || files.length ? 1 : 0.45 }}
                      onClick={() => void send()}
                    >
                      <Up />
                    </button>
                  </div>
                </div>
                <div className="cp-deskpad" />
                <div className="cp-homebar" />
              </div>
              )}
            </>
        </main>
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
      {pendingDelete ? (
        <div className="cp-dialog">
          <button type="button" className="dim" aria-label="Keep" onClick={() => setPendingDelete(null)} />
          <div className="card" role="dialog" aria-modal="true" aria-label={pendingDelete.kind === "chat" ? "Delete this chat?" : "Delete this skill?"}>
            <div>
              <h2>{pendingDelete.kind === "chat" ? "Delete this chat?" : "Delete this skill?"}</h2>
              <p>
                {pendingDelete.kind === "chat"
                  ? `“${pendingDelete.title}” will be removed for both partners.`
                  : `${pendingDelete.title} will be removed for both partners.`}
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
