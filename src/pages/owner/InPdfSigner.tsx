import { useEffect, useMemo, useRef, useState } from "react";
import { FittedFieldInput, fieldStyle, PartyChip, PdfPages } from "../../lib/pdfPages";
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
        f.type !== "date", // dates locked to today — no host step
    )
    .slice()
    .sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
}

function fieldDone(f: SignField): boolean {
  if (f.type === "signature") return Boolean(f.signature_png);
  if (f.type === "date") return Boolean((f.value || "").trim());
  if (f.type === "name" || f.type === "text") return Boolean((f.value || "").trim());
  return true;
}

function stepHint(f: SignField): string {
  if (f.type === "signature") return "Sign here";
  if (f.type === "name") return "Confirm your printed name";
  return "Fill this field";
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
  const [guided, setGuided] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const hostFirst = firstNameOf(signerHint) || "Host";

  const queue = useMemo(() => hostActionOrder(draft), [draft]);
  const active = guided ? queue[stepIdx] ?? null : null;

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

  const host = draft.filter((f) => f.party !== "mrg");
  const primarySig = host.find((f) => f.type === "signature" && f.signature_png);
  const namesReady = host
    .filter((f) => f.type === "name" || f.type === "text")
    .every((f) => (f.value || "").trim().length > 0);
  const sigsReady = host
    .filter((f) => f.type === "signature")
    .every((f) => Boolean(f.signature_png));
  const filled =
    sigsReady &&
    namesReady &&
    Boolean(primarySig || !host.some((f) => f.type === "signature"));
  const signatureName =
    host.find((f) => f.type === "name" && f.value?.trim())?.value?.trim() || name.trim();

  const advancePast = (fromId: string) => {
    const idx = queue.findIndex((f) => f.id === fromId);
    if (idx < 0) return;
    let next = idx + 1;
    while (next < queue.length && fieldDone(queue[next]!)) next += 1;
    if (next >= queue.length) {
      setStepIdx(Math.max(0, queue.length - 1));
      return;
    }
    setStepIdx(next);
  };

  useEffect(() => {
    if (!guided || !active) return;
    const el = document.querySelector(`[data-sign-field="${active.id}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (active.type === "signature" && !active.signature_png) {
      const t = window.setTimeout(() => {
        setSigningId(active.id);
      }, 280);
      return () => window.clearTimeout(t);
    }
    if (active.type === "name" || active.type === "text") {
      const t = window.setTimeout(() => {
        const input = inputRefs.current.get(active.id);
        input?.focus({ preventScroll: true });
      }, 320);
      return () => window.clearTimeout(t);
    }
    return undefined;
    // Only when the guided step changes — not on every keystroke
  }, [guided, active?.id, active?.type]);

  const startGuided = (focusId?: string) => {
    const idx =
      focusId != null
        ? queue.findIndex((f) => f.id === focusId)
        : queue.findIndex((f) => !fieldDone(f));
    setStepIdx(idx >= 0 ? idx : 0);
    setGuided(true);
  };

  const goNext = () => {
    if (!active) return;
    if (active.type === "signature" && !active.signature_png) {
      setName(signatureName || signerHint);
      setSigningId(active.id);
      return;
    }
    if ((active.type === "name" || active.type === "text") && !fieldDone(active)) {
      inputRefs.current.get(active.id)?.focus();
      return;
    }
    advancePast(active.id);
  };

  const allStepsDone = queue.length > 0 && queue.every(fieldDone);

  return (
    <div className="relative flex flex-col gap-4 pb-28">
      {!guided ? (
        <div className="sticky top-0 z-20 -mx-3 mb-2 border-b border-white/9 bg-[#0a0a0a]/95 px-3 py-4 backdrop-blur sm:-mx-0 sm:px-0">
          <p className="mb-3 max-w-[42ch] text-[14px] leading-relaxed text-[#9a9590]">
            Review the agreement, then we’ll walk you through each place you need to
            sign or fill — one step at a time.
          </p>
          <button
            type="button"
            onClick={() => startGuided()}
            className="w-full bg-[#c4a35a] py-[15px] text-[15px] font-bold text-[#0a0a0a] hover:bg-[#dcc084] sm:w-auto sm:px-10"
          >
            Ready to sign
          </button>
        </div>
      ) : null}

      <PdfPages url={pdfUrl}>
        {(page) => (
          <div className="absolute inset-0">
            {draft
              .filter((f) => f.page === page && f.type !== "checkbox")
              .map((f) => {
                const isMrg = f.party === "mrg";
                const isSig = f.type === "signature";
                const isDate = f.type === "date";
                const isActive = guided && active?.id === f.id;
                const lockedHost = !isMrg && isDate;
                const editable = !isMrg && !isDate && (f.type === "name" || f.type === "text");
                return (
                  <div
                    key={f.id}
                    data-sign-field={f.id}
                    style={fieldStyle(f)}
                    className={`@container overflow-visible rounded-[2px] border [container-type:size] ${
                      isActive
                        ? "z-30 border-2 border-[#c4a35a] bg-[#c4a35a]/22 shadow-[0_0_0_4px_rgba(196,163,90,0.35)] ring-2 ring-[#c4a35a]/50"
                        : isMrg
                          ? "pointer-events-none border-[#4ea882]/70 bg-transparent"
                          : lockedHost
                            ? "pointer-events-none border-[#c4a35a]/45 bg-[#c4a35a]/08"
                            : isSig
                              ? "border-2 border-dashed border-[#c4a35a] bg-[#c4a35a]/12"
                              : "border-[#c4a35a]/70 bg-white/80"
                    }`}
                  >
                    {isMrg || lockedHost ? null : (
                      <PartyChip party={f.party} hostLabel={hostFirst} />
                    )}
                    {isMrg ? (
                      <div className="h-full w-full" />
                    ) : (
                      <div className="flex h-full min-w-0 items-center overflow-hidden rounded-[1px]">
                        {isSig ? (
                          <button
                            type="button"
                            className="h-full w-full min-w-0 cursor-pointer"
                            onClick={() => {
                              if (!guided) startGuided(f.id);
                              setName(signatureName || signerHint);
                              setSigningId(f.id);
                            }}
                          >
                            {f.signature_png ? (
                              <img
                                src={f.signature_png}
                                alt="Signature"
                                className="h-full w-full object-contain"
                              />
                            ) : (
                              <span className="block truncate px-0.5 text-center font-semibold uppercase tracking-wide text-[#5a4a28] [font-size:clamp(5px,48cqh,11px)]">
                                Tap to sign
                              </span>
                            )}
                          </button>
                        ) : lockedHost ? (
                          <span className="w-full truncate px-0.5 text-[#1a1408] [font-size:clamp(5px,52cqh,13px)]">
                            {f.value || today}
                          </span>
                        ) : editable ? (
                          <FittedFieldInput
                            ref={(el) => {
                              if (el) inputRefs.current.set(f.id, el);
                              else inputRefs.current.delete(f.id);
                            }}
                            value={f.value || ""}
                            placeholder={
                              f.type === "name" ? "Printed name" : "Type here"
                            }
                            onFocus={() => {
                              if (!guided) startGuided(f.id);
                              else {
                                const idx = queue.findIndex((q) => q.id === f.id);
                                if (idx >= 0 && idx !== stepIdx) setStepIdx(idx);
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const value = e.target.value;
                              patchHost(f.id, { value });
                              if (f.type === "name") setName(value);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && guided) {
                                e.preventDefault();
                                goNext();
                              }
                            }}
                          />
                        ) : (
                          <span className="w-full truncate px-0.5 text-[#1a1408] [font-size:clamp(5px,52cqh,13px)]">
                            {f.value || ""}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </PdfPages>

      {signingId ? (
        <SignaturePad
          name={name}
          onNameChange={setName}
          onCancel={() => setSigningId(null)}
          onApply={(png) => {
            const appliedId = signingId;
            setDraft((prev) =>
              prev.map((f) => {
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
              }),
            );
            setSigningId(null);
            if (guided && appliedId) {
              window.setTimeout(() => advancePast(appliedId), 80);
            }
          }}
        />
      ) : null}

      {error ? <p className="text-sm text-[#cf7f7b]">{error}</p> : null}

      {guided ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0c0c0c]/96 px-4 py-3 backdrop-blur sm:px-6">
          <div className="mx-auto flex max-w-[820px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6f6a65]">
                {allStepsDone
                  ? "All set"
                  : `Step ${Math.min(stepIdx + 1, queue.length)} of ${queue.length}`}
              </div>
              <div className="truncate text-[14px] text-[#dcc084]">
                {allStepsDone
                  ? "Review below, then finish signing."
                  : active
                    ? stepHint(active)
                    : ""}
              </div>
            </div>
            <div className="flex gap-2">
              {!allStepsDone ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="flex-1 bg-[#c4a35a] px-6 py-3 text-[14px] font-bold text-[#0a0a0a] hover:bg-[#dcc084] sm:flex-none"
                >
                  {active?.type === "signature" && !active.signature_png
                    ? "Sign"
                    : "Next"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy || !filled || !signatureName}
                  onClick={() => {
                    if (!filled || !signatureName) return;
                    onFinish({
                      signatureName,
                      signaturePng: primarySig?.signature_png || "",
                      fields: host.map((f) =>
                        f.type === "date" ? { ...f, value: today } : f,
                      ),
                    });
                  }}
                  className={`flex-1 px-6 py-3 text-[14px] font-bold sm:flex-none ${
                    busy || !filled || !signatureName
                      ? "cursor-not-allowed bg-[#c4a35a]/25 text-[#6f6a65]"
                      : "bg-[#c4a35a] text-[#0a0a0a] hover:bg-[#dcc084]"
                  }`}
                >
                  {busy ? "Signing…" : "Finish signing"}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-center text-[12px] text-[#6f6a65]">
          Only {hostFirst}’s name and text can be edited. Dates are set to today. MRG
          boxes stay locked.
        </p>
      )}
    </div>
  );
}
