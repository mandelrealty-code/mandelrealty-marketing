import { useState } from "react";
import type { PlaybookStep } from "../../../shared/playbookTypes";
import {
  addPlaybookStep,
  COMMON_PLAYBOOK_STEPS,
  ownerForStepTitle,
  setCurrentPlaybookStep,
} from "../../../shared/playbookTypes";

export function PlaybookBlock({
  steps,
  busy,
  hostFirstName,
  draftMode,
  onComplete,
  onSkip,
  onChange,
}: {
  steps: PlaybookStep[];
  busy: boolean;
  hostFirstName?: string;
  draftMode?: boolean;
  onComplete: () => void;
  onSkip?: () => void;
  onChange?: (steps: PlaybookStep[]) => void;
}) {
  const host = hostFirstName?.trim() || "Host";
  const [adding, setAdding] = useState("");
  const currentIdx = steps.findIndex((s) => s.status === "current");
  const doneCount = steps.filter((s) => s.status === "done").length;
  const ownerLabel = (step: PlaybookStep) =>
    (step.owner || ownerForStepTitle(step.title)) === "mrg" ? "MRG" : host;

  if (!steps.length) {
    return (
      <div className="mb-5">
        <p className="mb-3 text-[15px] font-bold tracking-[-0.02em]">Next steps</p>
        <div className="rounded-xl border border-dashed border-white/14 px-[18px] py-[18px]">
          <p className="text-[15px] font-semibold">Nothing to chase yet</p>
          <p className="mt-2 text-[13px] leading-relaxed text-[#9a9590]">
            Add what they have to do next. AI will chase the current step by SMS.
          </p>
          {onChange ? (
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
                <p className="crm-mono min-w-0 flex-1 text-[10.5px] text-[#6f6a65]">{step.title} — done</p>
                {onChange ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onChange(setCurrentPlaybookStep(steps, step.id))}
                    className="shrink-0 text-[11px] text-[#6f6a65]"
                  >
                    Reopen
                  </button>
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
                {current ? (
                  <div className="flex gap-3.5 pt-1.5 text-[12px]">
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
                  </div>
                ) : onChange ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onChange(setCurrentPlaybookStep(steps, step.id))}
                    className="pt-1.5 text-[12px] text-[#c4a35a]"
                  >
                    Chase this
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      {onChange ? (
        <form
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            const next = addPlaybookStep(steps, adding);
            if (next !== steps) {
              onChange(next);
              setAdding("");
            }
          }}
        >
          <input
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            placeholder="Add a step…"
            disabled={busy}
            className="h-10 w-full rounded-[9px] border border-white/10 bg-[#141414] px-3 text-[13.5px] text-[#f5f5f5] outline-none placeholder:text-[#6f6a65] focus:border-[#c4a35a]/40"
          />
        </form>
      ) : null}
      {currentIdx < 0 && doneCount === steps.length ? (
        <p className="mt-3 text-[12.5px] text-[#4ea882]">All steps done — ready to send the contract.</p>
      ) : (
        <div className="mt-3.5 flex items-start gap-2.5">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#4ea882]" />
          <p className="text-[12px] leading-relaxed text-[#9a9590]">
            {draftMode
              ? "AI follows up on the current step via SMS — drafts land in this thread for your OK."
              : "AI follows up on the current step via SMS. Update the current step so it knows where they are."}
          </p>
        </div>
      )}
    </div>
  );
}
