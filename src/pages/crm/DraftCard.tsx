import { useState } from "react";

export type PendingDraft = {
  id: string;
  created_at: string;
  body: string;
  step_title: string;
};

export function DraftCard({
  draft,
  busy,
  onApprove,
  onDiscard,
  onSave,
}: {
  draft: PendingDraft;
  busy: boolean;
  onApprove: (body: string) => void;
  onDiscard: () => void;
  onSave: (body: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(draft.body);

  return (
    <div className="rounded-xl border border-dashed border-[#c99a4b]/55 bg-[rgba(201,154,75,0.05)] p-3.5">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#c99a4b]" />
        <span className="flex-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[#c99a4b]">
          Draft — not sent
        </span>
        <span className="text-[10px] text-[#6f6a65]">
          {new Date(draft.created_at).toLocaleTimeString("en-CA", {
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
      </div>
      {editing ? (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          className="mb-2 w-full rounded-[10px] border border-[#c99a4b]/40 bg-[#0c0c0c] px-3 py-2.5 text-[14.5px] leading-relaxed text-[#f5f5f5] outline-none"
        />
      ) : (
        <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed text-[#f5f5f5]">
          {draft.body}
        </p>
      )}
      {draft.step_title ? (
        <p className="mt-2 text-[10.5px] text-[#6f6a65]">
          Step · {draft.step_title}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || !(editing ? body : draft.body).trim()}
          onClick={() => onApprove(editing ? body : draft.body)}
          className="flex-1 rounded-[9px] bg-[#c99a4b] py-2.5 text-[13.5px] font-bold text-[#0a0a0a] disabled:opacity-40"
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
            className="rounded-[9px] border border-white/16 px-4 py-2.5 text-[13.5px] font-semibold"
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
            className="rounded-[9px] border border-white/16 px-4 py-2.5 text-[13.5px] font-semibold"
          >
            Edit
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={onDiscard}
          className="px-1.5 text-[12.5px] text-[#6f6a65]"
        >
          Discard
        </button>
      </div>
    </div>
  );
}
