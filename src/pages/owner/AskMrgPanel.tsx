import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { OwnerDashboardPayload } from "../../../shared/pm/ownerDashboardTypes";

type ChatMsg = { id: string; role: "user" | "assistant"; body: string };

async function ownerAsk<T>(
  op: string,
  opts?: { method?: "GET" | "POST"; body?: Record<string, unknown> },
): Promise<T> {
  const method = opts?.method ?? "GET";
  const params = new URLSearchParams({ op });
  const res = await fetch(`/api/owner?${params.toString()}`, {
    method,
    credentials: "include",
    headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
    body: method === "POST" ? JSON.stringify({ op, ...opts?.body }) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function chipsFor(dashboard: OwnerDashboardPayload | null): string[] {
  const e = dashboard?.earnings;
  if (!dashboard?.linked || !e) {
    return [
      "When do earnings show up here?",
      "What’s left to set up?",
      "Where is my agreement?",
    ];
  }
  const month = e.month_title.replace(/ \d{4}$/, "");
  return [
    "How many bookings do I have this month?",
    `What’s my projected revenue for ${e.projected_year}?`,
    "When is my next payout?",
    `How did ${month} compare to last year?`,
  ];
}

function SendArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 13V3M8 3L3.5 7.5M8 3l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function Composer({
  value,
  busy,
  onChange,
  onSend,
}: {
  value: string;
  busy: boolean;
  onChange: (v: string) => void;
  onSend: () => void;
}) {
  return (
    <form
      className="flex items-center gap-3 border border-white/10 bg-[#1c1c1c] py-3 pl-4 pr-3"
      onSubmit={(ev) => {
        ev.preventDefault();
        onSend();
      }}
    >
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ask about your property…"
        maxLength={400}
        disabled={busy}
        className="min-w-0 flex-1 bg-transparent text-sm text-[#f5f5f5] outline-none placeholder:text-[#6f6a65] disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={busy || !value.trim()}
        className="flex h-[34px] w-[34px] flex-none items-center justify-center bg-[#c4a35a] text-[#0a0a0a] disabled:opacity-40 hover:bg-[#dcc084]"
        aria-label="Send"
      >
        <SendArrow />
      </button>
    </form>
  );
}

function ChatUi({
  messages,
  busy,
  emptyTitle,
  chips,
  error,
  draft,
  propertyLabel,
  preview,
  onChip,
  onDraft,
  onSend,
  bottomRef,
}: {
  messages: ChatMsg[];
  busy: boolean;
  emptyTitle: string;
  chips: string[];
  error: string;
  draft: string;
  propertyLabel: string;
  preview?: boolean;
  onChip: (q: string) => void;
  onDraft: (v: string) => void;
  onSend: () => void;
  bottomRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-7 py-7">
        <Thread
          messages={messages}
          busy={busy}
          emptyTitle={emptyTitle}
          chips={chips}
          onChip={onChip}
          bottomRef={bottomRef}
        />
      </div>
      <div className="flex flex-col gap-3.5 border-t border-white/8 px-7 pb-6 pt-5">
        {error ? <p className="text-xs text-[#cf7f7b]">{error}</p> : null}
        <Composer value={draft} busy={busy || Boolean(preview)} onChange={onDraft} onSend={onSend} />
        <div className="text-[11px] text-[#6f6a65]">
          {preview
            ? "Preview — Ask MRG sending is off."
            : `Based on your Mandel Realty data for ${propertyLabel}`}
        </div>
      </div>
    </>
  );
}

function Thread({
  messages,
  busy,
  emptyTitle,
  chips,
  onChip,
  bottomRef,
}: {
  messages: ChatMsg[];
  busy: boolean;
  emptyTitle: string;
  chips: string[];
  onChip: (q: string) => void;
  bottomRef: RefObject<HTMLDivElement | null>;
}) {
  if (!messages.length) {
    return (
      <div className="flex flex-1 flex-col justify-end gap-6">
        <div className="flex flex-col gap-3">
          <div className="mb-1 h-[26px] w-[26px] rotate-45 border border-[#c4a35a]" />
          <div className="text-[22px] font-medium leading-snug tracking-tight">{emptyTitle}</div>
          <p className="text-sm leading-relaxed text-[#9a9590]">
            Answers use MRG knowledge for this unit — bookings, payouts, statements and
            projections.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6f6a65]">
            Try asking
          </div>
          {chips.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChip(c)}
              className="border border-white/10 px-[15px] py-3 text-left text-[13.5px] text-[#e6e2dd] hover:border-[#c4a35a] hover:text-white"
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col justify-end gap-5 overflow-y-auto">
      {messages.map((m) =>
        m.role === "user" ? (
          <div
            key={m.id}
            className="max-w-[80%] self-end border border-white/10 bg-[#1c1c1c] px-4 py-3 text-sm leading-relaxed"
          >
            {m.body}
          </div>
        ) : (
          <div key={m.id} className="flex max-w-[92%] flex-col gap-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c4a35a]">
              MRG
            </div>
            <div className="whitespace-pre-wrap text-sm leading-[1.65] text-[#e6e2dd]">
              {m.body}
            </div>
          </div>
        ),
      )}
      {busy ? (
        <div className="flex max-w-[92%] flex-col gap-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c4a35a]">
            MRG
          </div>
          <div className="text-sm text-[#6f6a65]">Looking at your numbers…</div>
        </div>
      ) : null}
      <div ref={bottomRef} />
    </div>
  );
}

export function AskMrgPanel({
  propertyLabel,
  dashboard,
  preview,
}: {
  propertyLabel: string;
  dashboard: OwnerDashboardPayload | null;
  preview?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const chips = useMemo(() => chipsFor(dashboard), [dashboard]);
  const unitShort = propertyLabel.split("·")[0]?.trim() || propertyLabel;

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setSheet(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (preview) return;
    let cancelled = false;
    ownerAsk<{ messages: ChatMsg[] }>("ask_history")
      .then((data) => {
        if (!cancelled) setMessages(data.messages ?? []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [preview]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, busy, sheet]);

  const send = useCallback(async (raw?: string) => {
    if (preview) return;
    const text = (raw ?? draft).trim();
    if (!text || busy) return;
    setDraft("");
    setError("");
    const localId = `local-${Date.now()}`;
    setMessages((prev) => [...prev, { id: localId, role: "user", body: text }]);
    setBusy(true);
    try {
      const data = await ownerAsk<{ reply: string }>("ask", {
        method: "POST",
        body: { message: text },
      });
      setMessages((prev) => [
        ...prev,
        { id: `${localId}-a`, role: "assistant", body: data.reply },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send.");
    } finally {
      setBusy(false);
    }
  }, [busy, draft, preview]);

  const ui = (
    <ChatUi
      messages={messages}
      busy={busy}
      emptyTitle={`Ask anything about ${unitShort}.`}
      chips={chips}
      error={error}
      draft={draft}
      propertyLabel={propertyLabel}
      onChip={(q) => void send(q)}
      onDraft={setDraft}
      onSend={() => void send()}
      bottomRef={bottomRef}
      preview={preview}
    />
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-[min(452px,38vw)] shrink-0 flex-col border-l border-white/9 bg-[#141414] lg:flex">
        <div className="flex items-center justify-between border-b border-white/8 px-7 py-6">
          <div className="text-[19px] font-semibold tracking-tight">Ask MRG</div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9a9590]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#4ea882]" />
            Live
          </div>
        </div>
        {sheet ? null : ui}
      </aside>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/90 to-transparent px-[22px] pb-6 pt-10 lg:hidden">
        <div className="pointer-events-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSheet(true)}
            className="flex min-w-0 flex-1 items-center gap-2.5 border border-white/12 bg-[#1c1c1c] px-4 py-[13px] text-left text-sm text-[#9a9590]"
          >
            <span className="h-1.5 w-1.5 flex-none rounded-full bg-[#4ea882]" />
            <span className="truncate">Ask MRG about {unitShort}</span>
          </button>
          <button
            type="button"
            onClick={() => setSheet(true)}
            className="flex h-11 w-11 flex-none items-center justify-center bg-[#c4a35a] text-[#0a0a0a]"
            aria-label="Open Ask MRG"
          >
            <SendArrow />
          </button>
        </div>
      </div>

      {sheet ? (
        <div className="fixed inset-0 z-40 flex flex-col bg-[#141414] text-[#f5f5f5] lg:hidden">
          <div className="flex flex-col gap-3.5 border-b border-white/8 px-[22px] pb-3.5 pt-4">
            <div className="h-[3px] w-[38px] self-center rounded-full bg-white/18" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="text-lg font-semibold">Ask MRG</div>
                <span className="h-1.5 w-1.5 rounded-full bg-[#4ea882]" />
              </div>
              <button
                type="button"
                className="text-sm text-[#9a9590]"
                onClick={() => setSheet(false)}
              >
                Close
              </button>
            </div>
          </div>
          {ui}
        </div>
      ) : null}
    </>
  );
}
