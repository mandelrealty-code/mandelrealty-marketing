import { useState } from "react";
import type { PlaybookStep } from "../../../shared/playbookTypes";
import {
  addPlaybookStep,
  COMMON_PLAYBOOK_STEPS,
  ownerForStepTitle,
  removePlaybookStep,
  setCurrentPlaybookStep,
} from "../../../shared/playbookTypes";

export function PlaybookBlock({
  steps,
  busy,
  hostFirstName,
  draftMode,
  canFollowUp,
  onComplete,
  onSkip,
  onChange,
  onFollowUp,
}: {
  steps: PlaybookStep[];
  busy: boolean;
  hostFirstName?: string;
  draftMode?: boolean;
  canFollowUp?: boolean;
  onComplete: () => void;
  onSkip?: () => void;
  onChange?: (steps: PlaybookStep[]) => void;
  onFollowUp?: (stepId?: string) => void;
}) {
  const host = hostFirstName?.trim() || "Host";
  const [adding, setAdding] = useState("");
  const currentIdx = steps.findIndex((s) => s.status === "current");
  const doneCount = steps.filter((s) => s.status === "done").length;
  const ownerLabel = (step: PlaybookStep) =>
    (step.owner || ownerForStepTitle(step.title)) === "mrg" ? "MRG" : host;
  const canAdd = Boolean(onChange && adding.trim() && !busy);

  const submitAdd = () => {
    if (!onChange) return;
    const next = addPlaybookStep(steps, adding);
    if (next === steps) return;
    onChange(next);
    setAdding("");
  };

  const deleteStep = (id: string) => {
    if (!onChange) return;
    onChange(removePlaybookStep(steps, id));
  };

  const addRow = onChange ? (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submitAdd();
      }}
    >
      <input
        value={adding}
        onChange={(e) => setAdding(e.target.value)}
        placeholder="Add a step…"
        disabled={busy}
        className="h-10 min-w-0 flex-1 rounded-[9px] border border-white/10 bg-[#141414] px-3 text-[13.5px] text-[#f5f5f5] outline-none placeholder:text-[#6f6a65] focus:border-[#c4a35a]/40"
      />
      <button
        type="submit"
        disabled={!canAdd}
        className="h-10 shrink-0 rounded-[9px] bg-[#c4a35a] px-3.5 text-[13px] font-semibold text-[#0a0a0a] disabled:opacity-35 hover:bg-[#dcc084]"
      >
        Add
      </button>
    </form>
  ) : null;

  if (!steps.length) {
    return (
      <div className="mb-5">
        <p className="mb-3 text-[15px] font-bold tracking-[-0.02em]">Next steps</p>
        <div className="rounded-xl border border-dashed border-white/14 px-[18px] py-[18px]">
          <p className="text-[15px] font-semibold">Nothing to chase yet</p>
          <p className="mt-2 text-[13px] leading-relaxed text-[#9a9590]">
            Add what they have to do next. AI will chase the current step by SMS.
          </p>
          {canFollowUp && onFollowUp ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onFollowUp()}
              className="mt-3 h-10 rounded-[9px] bg-[#c4a35a] px-3.5 text-[13px] font-semibold text-[#0a0a0a] disabled:opacity-35 hover:bg-[#dcc084]"
            >
              Follow up
            </button>
          ) : null}
          {onChange ? (
            <>
              <div className="mt-3">{addRow}</div>
              <div className="mt-3 flex flex-col gap-1 overflow-hidden rounded-[10px] border border-white/8">
                {COMMON_PLAYBOOK_STEPS.map((title) => (
                  <button
                    key={title}
                    type="button"
                    disabled={busy}
                    onClick={() => onChange(addPlaybookStep(steps, title))}
                    className="flex items-center justify-between bg-[#141414] px-3.5 py-3 text-left text-[14px] hover:bg-[#1a1a1a]"
                  >
                    {title}
                    <span className="text-[#c4a35a]">+</span>
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-5">
      <div className="mb-3.5 flex items-baseline justify-between">
        <p className="text-[15px] font-bold tracking-[-0.02em]">Next steps</p>
        <p className="crm-mono text-[10px] text-[#6f6a65]">
          {Math.min(doneCount + 1, steps.length)} of {steps.length}
          {doneCount ? ` · ${doneCount} done` : ""}
        </p>
      </div>
      <div className="flex flex-col">
        {steps.map((step, i) => {
          const current = step.status === "current";
          const done = step.status === "done";
          if (done) {
            return (
              <div
                key={step.id}
                className="flex items-center gap-2.5 border-t border-white/[0.06] py-2.5 first:border-t-0 first:pt-0"
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border border-[rgba(78,168,130,0.5)] bg-[rgba(78,168,130,0.2)] text-[9px] font-bold text-[#4ea882]">
                  ✓
                </span>
                <p className="crm-mono min-w-0 flex-1 text-[10.5px] text-[#6f6a65]">
                  {step.title} — done
                </p>
                {onChange ? (
                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onChange(setCurrentPlaybookStep(steps, step.id))}
                      className="text-[11px] text-[#6f6a65]"
                    >
                      Reopen
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => deleteStep(step.id)}
                      className="text-[11px] text-[#cf7f7b]"
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>
            );
          }
          return (
            <div
              key={step.id}
              className={`flex items-start gap-[11px] border-t border-white/[0.06] py-[11px] first:border-t-0 first:pt-0 ${
                current
                  ? "border-l-2 border-l-[#c99a4b] bg-[linear-gradient(90deg,rgba(201,154,75,0.09),transparent)] py-[11px] pl-[13px]"
                  : "pl-[15px]"
              }`}
            >
              <span
                className={`crm-mono mt-0.5 flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[5px] border text-[9.5px] ${
                  current
                    ? "border-[rgba(201,154,75,0.7)] text-[#c99a4b]"
                    : "border-white/16 text-[#6f6a65]"
                }`}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-[14px] ${current ? "font-semibold text-[#f5f5f5]" : "text-[#e6e2dd]"}`}>
                  {step.title}
                </p>
                <p
                  className={`crm-mono mt-[5px] text-[10px] ${
                    current ? "text-[#c99a4b]" : "text-[#6f6a65]"
                  }`}
                >
                  {current ? (
                    <>
                      Now<span className="text-[#4f4b47]"> · </span>
                      <span className="text-[#6f6a65]">{ownerLabel(step)}</span>
                    </>
                  ) : (
                    ownerLabel(step)
                  )}
                </p>
                <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 pt-1.5 text-[12px]">
                  {current ? (
                    <>
                      {canFollowUp && onFollowUp ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onFollowUp()}
                          className="h-7 rounded-[8px] bg-[#c4a35a] px-2.5 text-[12px] font-semibold text-[#0a0a0a] disabled:opacity-35 hover:bg-[#dcc084]"
                        >
                          Follow up
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={onComplete}
                        className="font-medium text-[#c4a35a]"
                      >
                        Mark done
                      </button>
                      {onSkip ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={onSkip}
                          className="text-[#6f6a65]"
                        >
                          Skip
                        </button>
                      ) : null}
                    </>
                  ) : canFollowUp && onFollowUp ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onFollowUp(step.id)}
                      className="h-7 rounded-[8px] bg-[#c4a35a] px-2.5 text-[12px] font-semibold text-[#0a0a0a] disabled:opacity-35 hover:bg-[#dcc084]"
                    >
                      Follow up
                    </button>
                  ) : onChange ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onChange(setCurrentPlaybookStep(steps, step.id))}
                      className="text-[#6f6a65]"
                    >
                      Make current
                    </button>
                  ) : null}
                  {onChange ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => deleteStep(step.id)}
                      className="text-[#cf7f7b]"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {addRow ? <div className="mt-3">{addRow}</div> : null}
      {currentIdx < 0 && doneCount === steps.length ? (
        <p className="mt-3 text-[12.5px] text-[#4ea882]">All steps done — ready to send the contract.</p>
      ) : (
        <div className="mt-3.5 flex items-start gap-2.5">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#4ea882]" />
          <p className="text-[12px] leading-relaxed text-[#9a9590]">
            {draftMode
              ? "Follow up drafts a bump if they go quiet. AI sells in the thread from your knowledge base."
              : "AI texts them, follows up if they go quiet, and sells in-thread. Update the current step so it knows where they are."}
          </p>
        </div>
      )}
    </div>
  );
}
