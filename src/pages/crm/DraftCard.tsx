import { useEffect, useState } from "react";

export type PendingDraft = {
  id: string;
  created_at: string;
  body: string;
  step_title: string;
};

function relativeAge(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff) || diff < 0) return "";
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}m ago`;
  if (diff < 86_400_000) return `${Math.max(1, Math.floor(diff / 3_600_000))}h ago`;
  return `${Math.max(1, Math.floor(diff / 86_400_000))}d ago`;
}

export function DraftCard({
  draft,
  busy,
  stepIndex,
  onApprove,
  onDiscard,
  onSave,
}: {
  draft: PendingDraft;
  busy: boolean;
  stepIndex?: number;
  onApprove: (body: string) => void;
  onDiscard: () => void;
  onSave: (body: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(draft.body);
  const live = editing ? body : draft.body;

  useEffect(() => {
    setBody(draft.body);
  }, [draft.id, draft.body]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== "Enter") return;
      if (!live.trim() || busy) return;
      e.preventDefault();
      onApprove(live);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [live, busy, onApprove]);

  const stepBit =
    stepIndex && stepIndex > 0 ? ` · step ${stepIndex}` : draft.step_title ? ` · ${draft.step_title}` : "";

  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border border-dashed border-[rgba(201,154,75,0.55)] bg-[rgba(201,154,75,0.05)] p-4 sm:p-[16px_18px]">
      <div className="flex items-center gap-2.5">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#c99a4b]" />
        <span className="crm-mono flex-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[#c99a4b]">
          Draft — not sent
        </span>
        <span className="crm-mono text-[10px] text-[#6f6a65]">
          AI wrote this · {relativeAge(draft.created_at)}
          {stepBit}
        </span>
      </div>
      {editing ? (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          className="w-full rounded-[10px] border border-[rgba(201,154,75,0.4)] bg-[#0c0c0c] px-3.5 py-3.5 text-[15px] leading-[1.55] text-[#f5f5f5] outline-none"
        />
      ) : (
        <p className="max-w-[62ch] whitespace-pre-wrap text-[15px] leading-[1.55] text-[#f5f5f5]">
          {draft.body}
        </p>
      )}
      {draft.step_title ? (
        <p className="crm-mono text-[10px] text-[#6f6a65]">
          {stepIndex ? `Step ${stepIndex} of next steps · ${draft.step_title}` : draft.step_title}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          disabled={busy || !live.trim()}
          onClick={() => onApprove(live)}
          className="rounded-[9px] bg-[#c99a4b] px-5 py-2.5 text-[13.5px] font-bold text-[#0a0a0a] disabled:opacity-40"
        >
          Approve & send
        </button>
        {editing ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              onSave(body);
              setEditing(false);
            }}
            className="rounded-[9px] border border-white/16 px-[18px] py-2.5 text-[13.5px] font-semibold"
          >
            Save
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setBody(draft.body);
              setEditing(true);
            }}
            className="rounded-[9px] border border-white/16 px-[18px] py-2.5 text-[13.5px] font-semibold"
          >
            Edit
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={onDiscard}
          className="px-1.5 py-2.5 text-[12.5px] text-[#6f6a65]"
        >
          Discard
        </button>
        <span className="crm-mono ml-auto hidden text-[10px] text-[#4f4b47] sm:inline">⌘⏎ to send</span>
      </div>
    </div>
  );
}
