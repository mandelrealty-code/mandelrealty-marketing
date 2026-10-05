import { useEffect, useMemo, useRef, useState } from "react";
import type { AdminProductMode } from "../clients/mode";
import type { BriefCard, BriefPayload, ConnectorRow, CopilotChat, CopilotMessage } from "../../../shared/copilot/types";
import "./copilot.css";

type Boot = {
  brief: BriefPayload;
  chats: CopilotChat[];
  connectors: ConnectorRow[];
  billing: string;
};

const SUGGESTIONS = [
  "Email the next guest at 20 Blue Jays Way",
  "How much is unit 606 making this month?",
  "Did Elizabeth get her contract?",
  "Add a new client",
];

async function api<T>(op: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(body ? "/api/admin/copilot" : `/api/admin/copilot?op=${op}`, {
    method: body ? "POST" : "GET",
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify({ op, ...body }) : undefined,
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

function Paperclip() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14.5 8.5l-5.6 5.6a3.5 3.5 0 01-5-5l6-6a2.3 2.3 0 013.3 3.3l-6 6a1.2 1.2 0 01-1.7-1.7l5.5-5.5" />
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
  const [screen, setScreen] = useState<"brief" | "empty" | "chat" | "connectors">("brief");
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
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

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
    const data = await api<{ messages: CopilotMessage[] }>(`messages&chatId=${encodeURIComponent(id)}`);
    setMessages(data.messages);
  }

  async function openCard(cardText: string, action: string) {
    setBusy(true);
    setError(null);
    setSheet(false);
    try {
      const data = await api<{ chat: CopilotChat; messages: CopilotMessage[] }>("card", {
        text: cardText,
        action,
      });
      setChatId(data.chat.id);
      setMessages(data.messages);
      setScreen("chat");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open the draft.");
    } finally {
      setBusy(false);
    }
  }

  async function send(preset?: string) {
    const attached = files.length ? `\nAttached: ${files.join(", ")}` : "";
    const value = `${(preset ?? text).trim()}${preset ? "" : attached}`.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    if (!preset) {
      setText("");
      setFiles([]);
    }
    try {
      const data = await api<{ chatId: string; messages: CopilotMessage[] }>("send", {
        text: value,
        chatId: preset ? null : chatId,
        kind: "chat",
      });
      setChatId(data.chatId);
      setMessages(data.messages);
      setScreen("chat");
      setSheet(false);
      if (/floor plan|sourcing|furniture report/i.test(value)) setReport(true);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send.");
      if (!preset) setText(value);
    } finally {
      setBusy(false);
    }
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

  const title = useMemo(() => {
    if (screen === "connectors") return "Connectors";
    if (screen === "brief") return "Overview";
    if (screen === "empty") return "New chat";
    return boot?.chats.find((c) => c.id === chatId)?.title || "Chat";
  }, [boot, chatId, screen]);

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

  function card(item: BriefCard) {
    return (
      <article key={item.id} className="cp-card">
        <div className="cp-card-top">
          <span className="cp-tag">{item.source}</span>
          <div className="cp-people">
            <span className="cp-avatar">{initial(item.source)}</span>
          </div>
          <button type="button" className="cp-x" aria-label="Remove card" onClick={() => setHidden((ids) => [...ids, item.id])}>
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
        {(boot?.chats ?? []).map((chat) => (
          <button
            key={chat.id}
            type="button"
            className={`cp-row${chat.id === chatId && screen === "chat" ? " on" : ""}`}
            onClick={() => void openChat(chat.id)}
          >
            <span className="cp-chat-title">{chat.title}</span>
            <span className="cp-time">{when(chat.updated_at)}</span>
          </button>
        ))}
      </div>
      <div className="cp-bill">
        <span className="quiet">Cursor · this cycle</span>
        <span className="used">{boot?.billing ?? "Loading…"}</span>
      </div>
      <button type="button" className={`cp-footbtn${screen === "connectors" ? " on" : ""}`} onClick={() => { setScreen("connectors"); setSheet(false); }}>
        Connectors
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
          {screen === "connectors" ? (
            <header className="cp-mhead">
              <button type="button" className="cp-icon44" onClick={() => setSheet(true)} style={{ width: "auto", padding: "0 12px 0 6px", gap: 4 }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 4.5L6.5 10l5.5 5.5" />
                </svg>
                Chats
              </button>
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

          {screen !== "connectors" ? (
            <>
              {screen === "brief" ? null : (
                <header className="cp-dhead">
                  <span className="who">{title}</span>
                  {waiting ? (
                    <span className="cp-waitbadge">
                      <span className="cp-count">1</span>Waiting
                    </span>
                  ) : null}
                </header>
              )}
              <div className="cp-scroll" ref={scrollRef}>
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
                        <div key={message.id} className="cp-user">{message.body}</div>
                      ) : (
                        <div key={message.id} className="cp-bot">
                          {message.draft?.status === "waiting" ? (
                            <button type="button" className="cp-trail" onClick={() => setTrail((prev) => ({ ...prev, [message.id]: !prev[message.id] }))}>
                              Checked this and drafted it
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d={trail[message.id] ? "M3 7.5L6 4.5l3 3" : "M3 4.5L6 7.5l3-3"} />
                              </svg>
                            </button>
                          ) : null}
                          {message.draft?.status === "waiting" && trail[message.id] ? (
                            <div className="cp-step">
                              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M3 7.5l2.5 2.5L11 4.5" />
                              </svg>
                              <span>Nothing was sent.</span>
                            </div>
                          ) : null}
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
                  </div>
                ) : null}
              </div>
              <div className="cp-composer-wrap">
                <div className="cp-confirm">Nothing goes out until you confirm.</div>
                {files.length > 0 ? <div className="cp-files">{files.join(", ")}</div> : null}
                <div className="cp-composer">
                  <button type="button" className="cp-iconbtn" aria-label="Attach" onClick={() => fileRef.current?.click()}>
                    <Paperclip />
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,.pdf"
                    multiple
                    hidden
                    onChange={(e) => {
                      setFiles(Array.from(e.target.files ?? []).map((file) => file.name));
                      e.target.value = "";
                    }}
                  />
                  <textarea
                    ref={taRef}
                    rows={1}
                    placeholder="Ask MRG"
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
                <div className="cp-deskpad" />
                <div className="cp-homebar" />
              </div>
            </>
          ) : (
            <div className="cp-scroll">
              <div className="cp-connectors">
                <div>
                  <h1>Connectors</h1>
                  <p className="lead">Accounts this chat can use.</p>
                </div>
                {(boot?.connectors ?? []).map((row) => (
                  <div key={row.id} className="cp-crow">
                    <div className="cp-crow-copy">
                      <strong>{row.name}</strong>
                      {row.detail ? <div className="desc">{row.detail}</div> : null}
                      <div className={row.status === "connected" ? "ok" : "off"}>{row.statusLabel}</div>
                      {row.note ? <div className="note">{row.note}</div> : null}
                    </div>
                    {row.id === "hospitable" && row.status !== "connected" ? (
                      <button type="button" className="cp-linkish" onClick={() => onModeChange("ops")}>Open OPS Settings</button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}
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
