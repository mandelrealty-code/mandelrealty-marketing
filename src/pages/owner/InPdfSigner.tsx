import { useEffect, useMemo, useRef, useState } from "react";
import { fieldStyle, PdfPages } from "../../lib/pdfPages";
import { SignaturePad } from "../../lib/SignaturePad";
import {
  firstNameOf,
  todayIsoDate,
  type SignField,
} from "../../../shared/pm/signFields";

function hostActionOrder(fields: SignField[]): SignField[] {
  return fields
    .filter(
      (f) =>
        f.party !== "mrg" &&
        f.type !== "checkbox" &&
        f.type !== "date",
    )
    .slice()
    .sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
}

function fieldDone(f: SignField): boolean {
  if (f.type === "signature") return Boolean(f.signature_png);
  if (f.type === "name" || f.type === "text") return Boolean((f.value || "").trim());
  return true;
}

function stepTitle(f: SignField): string {
  if (f.type === "signature") return "Your signature";
  if (f.type === "name") return "Your printed name";
  return "This field";
}

function stepHelp(f: SignField): string {
  if (f.type === "signature") return "Draw your signature, then continue.";
  if (f.type === "name") return "Type your full legal name as it should appear on the agreement.";
  return "Type the information for this field, then continue.";
}

export function InPdfSigner({
  pdfUrl,
  fields,
  signerHint,
  busy,
  error,
  onFinish,
}: {
  pdfUrl: string;
  fields: SignField[];
  signerHint: string;
  busy: boolean;
  error: string;
  onFinish: (input: {
    signatureName: string;
    signaturePng: string;
    fields: SignField[];
  }) => void;
}) {
  const today = todayIsoDate();
  const [draft, setDraft] = useState<SignField[]>(() =>
    fields.map((f) => {
      if (f.party === "mrg") return { ...f };
      if (f.type === "date") return { ...f, value: today };
      return {
        ...f,
        value: f.value || (f.type === "name" ? signerHint : ""),
      };
    }),
  );
  const [name, setName] = useState(signerHint);
  const [signingId, setSigningId] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [draftValue, setDraftValue] = useState("");
  const [localError, setLocalError] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const queue = useMemo(() => hostActionOrder(draft), [draft]);
  const active = started && !queue.every(fieldDone) ? queue[stepIdx] ?? null : null;
  const doneCount = queue.filter(fieldDone).length;
  const allDone = queue.length > 0 && doneCount === queue.length;

  const host = draft.filter((f) => f.party !== "mrg");
  const primarySig = host.find((f) => f.type === "signature" && f.signature_png);
  const signatureName =
    host.find((f) => f.type === "name" && f.value?.trim())?.value?.trim() || name.trim();
  const canFinish =
    allDone &&
    Boolean(signatureName) &&
    host.filter((f) => f.type === "signature").every((f) => Boolean(f.signature_png));

  const patchHost = (id: string, next: Partial<SignField>) => {
    setDraft((prev) =>
      prev.map((f) => {
        if (f.id !== id || f.party === "mrg") return f;
        if (f.type === "date") return { ...f, value: today };
        if (f.type === "name" || f.type === "text" || f.type === "signature") {
          return { ...f, ...next };
        }
        return f;
      }),
    );
  };

  const jumpTo = (idx: number) => {
    const clamped = Math.max(0, Math.min(idx, Math.max(0, queue.length - 1)));
    setStepIdx(clamped);
    setLocalError("");
    const f = queue[clamped];
    if (f && (f.type === "name" || f.type === "text")) {
      setDraftValue(f.value || "");
    }
  };

  const start = () => {
    setStarted(true);
    const first = queue.findIndex((f) => !fieldDone(f));
    jumpTo(first >= 0 ? first : 0);
  };

  // Keep panel + PDF in sync with the active step
  useEffect(() => {
    if (!started || !active || allDone) return;
    const el = document.querySelector(`[data-sign-field="${active.id}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });

    if (active.type === "signature" && !active.signature_png) {
      const t = window.setTimeout(() => {
        setName((n) => n.trim() || signerHint);
        setSigningId(active.id);
      }, 200);
      return () => window.clearTimeout(t);
    }

    if (active.type === "name" || active.type === "text") {
      setDraftValue(active.value || "");
      const t = window.setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true });
        inputRef.current?.select();
      }, 220);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [started, active?.id, active?.type, allDone, signerHint]);

  const applyValueAndAdvance = (value: string) => {
    if (!active) return;
    const trimmed = value.trim();
    if (!trimmed) {
      setLocalError(
        active.type === "name" ? "Enter your printed name to continue." : "Fill this in to continue.",
      );
      inputRef.current?.focus();
      return;
    }
    patchHost(active.id, { value: trimmed });
    if (active.type === "name") setName(trimmed);
    setLocalError("");

    const nextDraft = draft.map((f) =>
      f.id === active.id ? { ...f, value: trimmed } : f,
    );
    const nextQueue = hostActionOrder(nextDraft);
    const nextOpen = nextQueue.findIndex((f) => !fieldDone(f));
    if (nextOpen >= 0) jumpTo(nextOpen);
    else setStepIdx(Math.max(0, nextQueue.length - 1));
  };

  const continueStep = () => {
    if (allDone) return;
    if (!active) {
      start();
      return;
    }
    if (active.type === "signature") {
      if (!active.signature_png) {
        setName(signatureName || signerHint);
        setSigningId(active.id);
        return;
      }
      const nextOpen = queue.findIndex((f) => !fieldDone(f));
      if (nextOpen >= 0) jumpTo(nextOpen);
      return;
    }
    applyValueAndAdvance(draftValue);
  };

  const finish = () => {
    if (!canFinish || busy) return;
    onFinish({
      signatureName,
      signaturePng: primarySig?.signature_png || "",
      fields: host.map((f) => (f.type === "date" ? { ...f, value: today } : f)),
    });
  };

  return (
    <div className={`relative flex flex-col gap-5 ${started ? "pb-56" : "pb-8"}`}>
      {!started ? (
        <div className="rounded-none border border-white/10 bg-[#121212] px-5 py-6 sm:px-7">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c4a35a]">
            Almost done
          </div>
          <h2 className="mt-2 text-[24px] font-semibold tracking-tight text-[#f5f5f5] sm:text-[28px]">
            Sign your agreement
          </h2>
          <p className="mt-3 max-w-[40ch] text-[15px] leading-relaxed text-[#9a9590]">
            We’ll take you through each required field one at a time. Just fill what’s asked,
            then tap Continue — no zooming or hunting on the page.
          </p>
          <button
            type="button"
            onClick={start}
            className="mt-6 w-full bg-[#c4a35a] py-4 text-[16px] font-bold text-[#0a0a0a] hover:bg-[#dcc084] sm:w-auto sm:px-12"
          >
            Start signing
          </button>
          {queue.length ? (
            <p className="mt-3 text-[13px] text-[#6f6a65]">
              {queue.length} step{queue.length === 1 ? "" : "s"} · takes about a minute
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
        <div className="min-w-[min(100%,560px)] opacity-95 sm:min-w-0">
          <PdfPages url={pdfUrl}>
            {(page) => (
              <div className="absolute inset-0">
                {draft
                  .filter((f) => f.page === page && f.type !== "checkbox")
                  .map((f) => {
                    const isMrg = f.party === "mrg";
                    const isSig = f.type === "signature";
                    const isDate = f.type === "date";
                    const isActive = Boolean(active && active.id === f.id);
                    const isComplete =
                      !isMrg &&
                      ((isSig && Boolean(f.signature_png)) ||
                        (isDate && Boolean(f.value)) ||
                        ((f.type === "name" || f.type === "text") && Boolean(f.value?.trim())));
                    return (
                      <div
                        key={f.id}
                        data-sign-field={f.id}
                        style={fieldStyle(f)}
                        className={`absolute overflow-hidden rounded-[1px] ${
                          isMrg
                            ? "pointer-events-none border-0 bg-transparent"
                            : isActive
                              ? "z-30 border border-[#c4a35a] bg-[#c4a35a]/20"
                              : isComplete
                                ? "pointer-events-none border border-[#4ea882]/50 bg-[#4ea882]/08"
                                : isDate
                                  ? "pointer-events-none border border-[#c4a35a]/30 bg-[#c4a35a]/06"
                                  : "pointer-events-none border border-[#c4a35a]/40 bg-white/70"
                        }`}
                      >
                        {isMrg ? null : isSig && f.signature_png ? (
                          <img
                            src={f.signature_png}
                            alt=""
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <span className="flex h-full items-center truncate px-1 text-[10px] text-[#1a1408] sm:text-[11px]">
                            {isDate
                              ? f.value || today
                              : f.value ||
                                (isSig ? "" : "")}
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </PdfPages>
        </div>
      </div>

      {signingId ? (
        <SignaturePad
          name={name}
          onNameChange={setName}
          onCancel={() => setSigningId(null)}
          onApply={(png) => {
            const appliedId = signingId;
            setSigningId(null);
            setDraft((prev) => {
              const next = prev.map((f) => {
                if (f.party === "mrg") return f;
                if (f.type === "date") return { ...f, value: today };
                if (f.type === "name" && !f.value?.trim()) {
                  return { ...f, value: name.trim() };
                }
                if (f.type !== "signature") return f;
                if (f.id === appliedId || !f.signature_png) {
                  return { ...f, signature_png: png, value: name.trim() || f.value };
                }
                return f;
              });
              const q = hostActionOrder(next);
              const open = q.findIndex((f) => !fieldDone(f));
              window.setTimeout(() => {
                setStepIdx(open >= 0 ? open : Math.max(0, q.length - 1));
              }, 0);
              return next;
            });
          }}
        />
      ) : null}

      {error ? <p className="text-sm text-[#cf7f7b]">{error}</p> : null}

      {started ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0c0c0c] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-4 sm:px-6">
          <div className="mx-auto flex max-w-[640px] flex-col gap-3">
            {allDone ? (
              <>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#4ea882]">
                    Ready to submit
                  </div>
                  <div className="mt-1 text-[18px] font-semibold text-[#f5f5f5]">
                    You’re all done
                  </div>
                  <p className="mt-1 text-[14px] text-[#9a9590]">
                    Tap below to finish. We’ll email you a signed copy.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy || !canFinish}
                  onClick={finish}
                  className={`w-full py-4 text-[16px] font-bold ${
                    busy || !canFinish
                      ? "cursor-not-allowed bg-[#c4a35a]/25 text-[#6f6a65]"
                      : "bg-[#c4a35a] text-[#0a0a0a] hover:bg-[#dcc084]"
                  }`}
                >
                  {busy ? "Submitting…" : "Finish signing"}
                </button>
              </>
            ) : active ? (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6f6a65]">
                    Step {Math.min(stepIdx + 1, queue.length)} of {queue.length}
                  </div>
                  <div className="text-[12px] text-[#6f6a65]">
                    {doneCount} done
                  </div>
                </div>
                <div className="text-[18px] font-semibold text-[#f5f5f5]">
                  {stepTitle(active)}
                </div>
                <p className="text-[14px] leading-snug text-[#9a9590]">{stepHelp(active)}</p>

                {active.type === "name" || active.type === "text" ? (
                  <input
                    ref={inputRef}
                    type="text"
                    inputMode="text"
                    autoComplete={active.type === "name" ? "name" : "off"}
                    autoCapitalize={active.type === "name" ? "words" : "off"}
                    value={draftValue}
                    placeholder={active.type === "name" ? firstNameOf(signerHint) || "Full name" : "Type here"}
                    onChange={(e) => {
                      setDraftValue(e.target.value);
                      if (localError) setLocalError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        continueStep();
                      }
                    }}
                    className="w-full border border-white/16 bg-[#141414] px-4 py-3.5 text-[16px] leading-normal text-[#f5f5f5] outline-none placeholder:text-[#6f6a65] focus:border-[#c4a35a]"
                  />
                ) : null}

                {localError ? (
                  <p className="text-[13px] text-[#cf7f7b]">{localError}</p>
                ) : null}

                <button
                  type="button"
                  onClick={continueStep}
                  className="w-full bg-[#c4a35a] py-4 text-[16px] font-bold text-[#0a0a0a] hover:bg-[#dcc084]"
                >
                  {active.type === "signature" && !active.signature_png
                    ? "Open signature pad"
                    : "Continue"}
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-center text-[13px] text-[#6f6a65]">
          Dates are filled automatically. Only your fields need attention.
        </p>
      )}
    </div>
  );
}
