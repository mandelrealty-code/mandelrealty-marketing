import type { PlaybookStep } from "../../../shared/playbookTypes";

export function PlaybookBlock({
  steps,
  busy,
  onComplete,
}: {
  steps: PlaybookStep[];
  busy: boolean;
  onComplete: () => void;
}) {
  if (!steps.length) {
    return <p className="mb-5 text-sm text-[#6f6a65]">No next steps yet.</p>;
  }
  const currentIdx = steps.findIndex((s) => s.status === "current");
  const doneCount = steps.filter((s) => s.status === "done").length;
  return (
    <div className="mb-5">
      <div className="mb-2.5 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7d7873]">
          Next steps
        </p>
        <p className="font-mono text-[10.5px] text-[#6f6a65]">
          {Math.min(doneCount + 1, steps.length)} of {steps.length}
        </p>
      </div>
      <div className="flex flex-col overflow-hidden rounded-[14px] border border-white/8">
        {steps.map((step, i) => {
          const current = step.status === "current";
          const done = step.status === "done";
          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 border-t border-white/8 px-3.5 py-3 first:border-t-0 ${
                current ? "border-l-2 border-l-[#c99a4b] bg-[rgba(201,154,75,0.08)]" : "bg-[#1a1a1a]"
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] ${
                  done
                    ? "border-[#4ea882] bg-[#4ea882] text-[#0a0a0a]"
                    : current
                      ? "border-[#c99a4b] text-[#c99a4b]"
                      : "border-white/20 text-transparent"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-[14.5px] ${
                    done
                      ? "text-[#6f6a65] line-through"
                      : current
                        ? "font-semibold text-[#f5f5f5]"
                        : "text-[#9a9590]"
                  }`}
                >
                  {step.title}
                </p>
                {current ? (
                  <p className="font-mono text-[10.5px] text-[#c99a4b]">Now</p>
                ) : null}
              </div>
              {current ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={onComplete}
                  className="shrink-0 text-[12.5px] font-semibold text-[#c4a35a]"
                >
                  Mark done
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      {currentIdx < 0 && doneCount === steps.length ? (
        <p className="mt-2 text-[12.5px] text-[#4ea882]">All steps done — ready to send the contract.</p>
      ) : null}
    </div>
  );
}
