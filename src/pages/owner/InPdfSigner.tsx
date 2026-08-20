import { useEffect, useMemo, useRef, useState } from "react";
import { fieldStyle, FittedFieldText, PdfPages } from "../../lib/pdfPages";
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
  const custom = f.label?.trim();
  if (custom) return custom;
  if (f.type === "signature") return "Your signature";
  if (f.type === "name") return "Your printed name";
  return "Fill this line";
}

function stepHelp(f: SignField): string {
  if (f.type === "signature") {
    return "Draw your signature below — we’ll place it in the gold box on the agreement.";
  }
  if (f.type === "name") {
    return "Type your full legal name. It appears in the gold highlighted box on the agreement.";
  }
  return "Type what’s needed for the gold highlighted box on the agreement, then continue.";
}

function activeBadge(f: SignField): string {
  if (f.type === "signature") return "Sign here";
  if (f.type === "name") return "Name here";
  if (f.label?.trim()) return f.label.trim();
  return "Fill here";
}

/** Scroll containers Safari may yank when focusing a fixed bottom input. */
function scrollLockTargets(from: Element | null): Array<{ el: HTMLElement; top: number; left: number }> {
  const targets: Array<{ el: HTMLElement; top: number; left: number }> = [];
  let node: Element | null = from;
  while (node) {
    if (node instanceof HTMLElement) {
      const oy = getComputedStyle(node).overflowY;
      if (oy === "auto" || oy === "scroll" || oy === "overlay") {
        targets.push({ el: node, top: node.scrollTop, left: node.scrollLeft });
      }
    }
    node = node.parentElement;
  }
  return targets;
}

/** Keep PDF scroll put while the keyboard opens (iOS focus + visualViewport). */
function freezeDocumentScroll(from: Element | null): () => void {
  const parents = scrollLockTargets(from);
  const winX = window.scrollX;
  const winY = window.scrollY;
  const restore = () => {
    for (const p of parents) {
      p.el.scrollTop = p.top;
      p.el.scrollLeft = p.left;
    }
    if (window.scrollX !== winX || window.scrollY !== winY) {
      window.scrollTo(winX, winY);
    }
  };
  restore();
  const raf = requestAnimationFrame(() => {
    restore();
    requestAnimationFrame(restore);
  });
  const timers = [0, 50, 120, 250, 400].map((ms) => window.setTimeout(restore, ms));
  const vv = window.visualViewport;
  vv?.addEventListener("resize", restore);
  vv?.addEventListener("scroll", restore);
  return () => {
    cancelAnimationFrame(raf);
    for (const t of timers) window.clearTimeout(t);
    vv?.removeEventListener("resize", restore);
    vv?.removeEventListener("scroll", restore);
  };
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
  const scrollFreezeRef = useRef<(() => void) | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const queue = useMemo(() => hostActionOrder(draft), [draft]);
  /** stepIdx === queue.length means the finish screen */
  const showingFinish = started && stepIdx >= queue.length && queue.every(fieldDone);
  const active = started && stepIdx < queue.length ? queue[stepIdx] ?? null : null;
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

  const showOnAgreement = (fieldId?: string) => {
    const id = fieldId || active?.id;
    if (!id) return;
    const el = document.querySelector(`[data-sign-field="${id}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  };

  // Reveal the active box on the PDF when the step changes (not when typing — that stays locked).
  useEffect(() => {
    if (!started || !active || showingFinish) return;
    const t = window.setTimeout(() => showOnAgreement(active.id), 80);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when step field changes
  }, [started, active?.id, showingFinish]);

  // Sync draft text for the step — no auto-focus (that scrolls the PDF on mobile).
  useEffect(() => {
    if (!started || !active || showingFinish) return;

    if (active.type === "signature" && !active.signature_png) {
      const t = window.setTimeout(() => {
        setName((n) => n.trim() || signerHint);
        setSigningId(active.id);
      }, 200);
      return () => window.clearTimeout(t);
    }

    if (active.type === "name" || active.type === "text") {
      setDraftValue(active.value || "");
    }
    return undefined;
  }, [started, active?.id, active?.type, showingFinish, signerHint]);

  useEffect(() => {
    return () => {
      scrollFreezeRef.current?.();
      scrollFreezeRef.current = null;
    };
  }, []);

  const holdScrollWhileTyping = () => {
    // touchstart often fires first — keep that snapshot; don't re-lock after iOS already scrolled
    if (scrollFreezeRef.current) return;
    scrollFreezeRef.current = freezeDocumentScroll(rootRef.current);
  };

  const releaseScrollHold = () => {
    scrollFreezeRef.current?.();
    scrollFreezeRef.current = null;
  };

  const saveCurrentText = () => {
    if (!active || (active.type !== "name" && active.type !== "text")) return;
    const trimmed = draftValue.trim();
    if (!trimmed) return;
    patchHost(active.id, { value: trimmed });
    if (active.type === "name") setName(trimmed);
  };

  const goBack = () => {
    setLocalError("");
    saveCurrentText();
    if (showingFinish || stepIdx >= queue.length) {
      jumpTo(Math.max(0, queue.length - 1));
      return;
    }
    if (stepIdx > 0) jumpTo(stepIdx - 1);
  };

  const goToFinishOrNextOpen = (fromDraft: SignField[] = draft) => {
    const q = hostActionOrder(fromDraft);
    const nextOpen = q.findIndex((f) => !fieldDone(f));
    if (nextOpen >= 0) jumpTo(nextOpen);
    else setStepIdx(q.length);
  };

  const applyValueAndAdvance = (value: string) => {
    if (!active) return;
    const trimmed = value.trim();
    if (!trimmed) {
      setLocalError(
        active.type === "name" ? "Enter your printed name to continue." : "Fill this in to continue.",
      );
      inputRef.current?.focus({ preventScroll: true });
      return;
    }
    patchHost(active.id, { value: trimmed });
    if (active.type === "name") setName(trimmed);
    setLocalError("");

    const nextDraft = draft.map((f) =>
      f.id === active.id ? { ...f, value: trimmed } : f,
    );
    goToFinishOrNextOpen(nextDraft);
  };

  const continueStep = () => {
    if (showingFinish) return;
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
      goToFinishOrNextOpen();
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
    <div
      ref={rootRef}
      className={`relative flex flex-col gap-5 ${started ? "pb-56" : "pb-8"}`}
    >
      {!started ? (
        <div className="rounded-none border border-white/10 bg-[#121212] px-5 py-6 sm:px-7">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c4a35a]">
            Almost done
          </div>
          <h2 className="mt-2 text-[24px] font-semibold tracking-tight text-[#f5f5f5] sm:text-[28px]">
            Sign your agreement
          </h2>
          <p className="mt-3 max-w-[42ch] text-[15px] leading-relaxed text-[#9a9590]">
            We’ll highlight each spot in gold on the agreement. Fill it in the panel below, then
            Continue — you can scroll and read anytime.
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
                    const emptyHostSig = !isMrg && isSig && !f.signature_png;
                    const emptyHostText =
                      !isMrg &&
                      !isSig &&
                      !isDate &&
                      !isComplete &&
                      !(f.value || "").trim();
                    return (
                      <div
                        key={f.id}
                        data-sign-field={f.id}
                        style={fieldStyle(f)}
                        className={`absolute rounded-[2px] ${
                          isMrg
                            ? "pointer-events-none overflow-hidden border-0 bg-transparent"
                            : isActive
                              ? "z-40 overflow-visible border-2 border-[#c4a35a] bg-[#c4a35a]/28 shadow-[0_0_0_4px_rgba(196,163,90,0.45)]"
                              : isComplete
                                ? "pointer-events-none z-20 overflow-hidden border border-[#4ea882]/70 bg-white/85"
                                : isDate
                                  ? "pointer-events-none overflow-hidden border border-[#c4a35a]/30 bg-[#c4a35a]/06"
                                  : "pointer-events-none overflow-hidden border border-[#c4a35a]/55 bg-[#c4a35a]/14"
                        }`}
                      >
                        {isActive ? (
                          <div className="pointer-events-none absolute left-0 top-0 z-50 -translate-y-[110%] whitespace-nowrap rounded-sm bg-[#c4a35a] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#0a0a0a] shadow">
                            {activeBadge(f)}
                          </div>
                        ) : null}
                        {isMrg ? null : isSig && f.signature_png ? (
                          <img
                            src={f.signature_png}
                            alt=""
                            className="h-full w-full object-contain"
                          />
                        ) : emptyHostSig ? (
                          <div className="flex h-full w-full items-center justify-center px-0.5">
                            <span className="truncate text-center text-[9px] font-bold uppercase tracking-wide text-[#8a6a28] sm:text-[10px]">
                              Sign here
                            </span>
                          </div>
                        ) : emptyHostText && isActive ? (
                          <div className="flex h-full w-full items-center px-0.5">
                            <span className="truncate text-[9px] font-semibold text-[#8a6a28]">
                              Type below…
                            </span>
                          </div>
                        ) : (
                          <div className="flex h-full w-full items-center px-0.5">
                            <FittedFieldText
                              text={
                                isDate
                                  ? f.value || today
                                  : f.value || ""
                              }
                            />
                          </div>
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
                showOnAgreement(appliedId);
                window.setTimeout(() => {
                  if (open >= 0) setStepIdx(open);
                  else setStepIdx(q.length);
                }, 450);
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
            {showingFinish ? (
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
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={goBack}
                    className="shrink-0 border border-white/16 px-5 py-4 text-[16px] font-semibold text-[#9a9590] hover:text-[#f5f5f5]"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={busy || !canFinish}
                    onClick={finish}
                    className={`min-w-0 flex-1 py-4 text-[16px] font-bold ${
                      busy || !canFinish
                        ? "cursor-not-allowed bg-[#c4a35a]/25 text-[#6f6a65]"
                        : "bg-[#c4a35a] text-[#0a0a0a] hover:bg-[#dcc084]"
                    }`}
                  >
                    {busy ? "Submitting…" : "Finish signing"}
                  </button>
                </div>
              </>
            ) : active ? (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6f6a65]">
                    Step {Math.min(stepIdx + 1, queue.length)} of {queue.length} · page {active.page}
                  </div>
                  <button
                    type="button"
                    onClick={() => showOnAgreement()}
                    className="text-[12px] font-semibold text-[#c4a35a]"
                  >
                    Show on agreement →
                  </button>
                </div>
                <div className="text-[18px] font-semibold text-[#f5f5f5]">
                  {stepTitle(active)}
                </div>
                <p className="text-[14px] leading-snug text-[#9a9590]">
                  {active.type === "signature" && active.signature_png
                    ? "Signature is on the agreement (gold box). Continue, or redraw if you need to change it."
                    : stepHelp(active)}
                </p>

                {active.type === "name" || active.type === "text" ? (
                  <input
                    ref={inputRef}
                    type="text"
                    inputMode="text"
                    autoComplete={active.type === "name" ? "name" : "off"}
                    autoCapitalize={active.type === "name" ? "words" : "off"}
                    value={draftValue}
                    placeholder={
                      active.label?.trim() ||
                      (active.type === "name"
                        ? firstNameOf(signerHint) || "Full name"
                        : "Type here")
                    }
                    onFocus={holdScrollWhileTyping}
                    onBlur={releaseScrollHold}
                    onTouchStart={holdScrollWhileTyping}
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

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={stepIdx <= 0}
                    onClick={goBack}
                    className="shrink-0 border border-white/16 px-5 py-4 text-[16px] font-semibold text-[#9a9590] hover:text-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={continueStep}
                    className="min-w-0 flex-1 bg-[#c4a35a] py-4 text-[16px] font-bold text-[#0a0a0a] hover:bg-[#dcc084]"
                  >
                    {active.type === "signature" && !active.signature_png
                      ? "Open signature pad"
                      : active.type === "signature" && active.signature_png
                        ? "Continue"
                        : "Continue"}
                  </button>
                </div>
                {active.type === "signature" && active.signature_png ? (
                  <button
                    type="button"
                    onClick={() => {
                      setName(signatureName || signerHint);
                      setSigningId(active.id);
                    }}
                    className="text-center text-[13px] font-semibold text-[#c4a35a]"
                  >
                    Redraw signature
                  </button>
                ) : null}
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
