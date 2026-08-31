import { useEffect, useState } from "react";
import type { SopItem } from "../../../shared/pm/sopTypes";

interface PublicSopHubProps {
  initialSlug?: string | null;
}

export function PublicSopHub({ initialSlug }: PublicSopHubProps) {
  const [sop, setSop] = useState<SopItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"doc" | "guide">("doc");

  // Step Progress State (persisted in localStorage per SOP)
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});
  const [guideStepIdx, setGuideStepIdx] = useState(0);
  const [guideFinished, setGuideFinished] = useState(false);

  // Copy Feedback State
  const [copiedScriptId, setCopiedScriptId] = useState<string | null>(null);
  const [shareToast, setShareToast] = useState<string | null>(null);

  // Lightbox State
  const [lightboxImg, setLightboxImg] = useState<{ src: string; title: string } | null>(null);

  // Fetch only this individual SOP by slug
  useEffect(() => {
    async function load() {
      const slug = initialSlug?.trim();
      if (!slug) {
        setError("Guide not found");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/sop?slug=${encodeURIComponent(slug)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.sop) {
            setSop(data.sop);
            try {
              const key = `mrg_sop_progress_${data.sop.slug}`;
              const saved = localStorage.getItem(key);
              if (saved) {
                setCompletedSteps(JSON.parse(saved));
              }
            } catch {}
          } else {
            setError("Standard Operating Procedure not found or has been unpublished.");
          }
        } else {
          setError("Standard Operating Procedure not found or has been unpublished.");
        }
      } catch {
        setError("Unable to load procedure. Please check your network connection.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [initialSlug]);

  // Toggle Step Checkbox in Doc View
  const handleToggleStep = (stepId: string) => {
    if (!sop) return;
    setCompletedSteps((prev) => {
      const next = { ...prev, [stepId]: !prev[stepId] };
      try {
        localStorage.setItem(`mrg_sop_progress_${sop.slug}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Reset Progress
  const handleResetProgress = () => {
    if (!sop) return;
    setCompletedSteps({});
    try {
      localStorage.removeItem(`mrg_sop_progress_${sop.slug}`);
    } catch {}
    setGuideStepIdx(0);
    setGuideFinished(false);
  };

  // Copy Script Handler
  const handleCopyScript = (scriptText: string, scriptId: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(scriptText).catch(() => {});
    }
    setCopiedScriptId(scriptId);
    setTimeout(() => setCopiedScriptId(null), 2400);
  };

  // Share Link Handler
  const handleShareLink = () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
    setShareToast("Link copied to clipboard");
    setTimeout(() => setShareToast(null), 2500);
  };

  const stepsList = sop?.steps || [];
  const completedCount = stepsList.filter((s) => completedSteps[s.id]).length;
  const progressPct = stepsList.length ? Math.round((completedCount / stepsList.length) * 100) : 0;
  const guidePct = stepsList.length
    ? Math.round(((guideStepIdx + 1) / stepsList.length) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5] font-sans antialiased pb-24 selection:bg-[#c4a35a]/30 selection:text-white">
      {/* Top MRG Branded Sticky Header (No click-away back to all SOPs) */}
      <header className="sticky top-0 z-30 border-b border-white/8 bg-[#0c0c0c]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3 select-none">
            {/* Bowtie Mark */}
            <div className="flex items-center gap-[2px]">
              <div
                className="h-5 w-3.5 bg-[#c4a35a]"
                style={{ clipPath: "polygon(0 0, 100% 50%, 0 100%)" }}
              />
              <div
                className="h-5 w-3.5 bg-[#c4a35a]"
                style={{ clipPath: "polygon(100% 0, 0 50%, 100% 100%)" }}
              />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold tracking-wider text-[#f5f5f5]">
                MANDEL REALTY GROUP
              </span>
              <span className="text-[10.5px] text-[#6f6a65] tracking-tight">
                Standard Operating Procedure Guide
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded bg-[#c4a35a]/10 border border-[#c4a35a]/30 px-2.5 py-1 font-mono text-[10.5px] font-bold uppercase tracking-wider text-[#c4a35a]">
              Direct SOP Access
            </span>
          </div>
        </div>
      </header>

      {/* Loading state */}
      {loading && (
        <div className="mx-auto max-w-5xl px-6 py-24 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#c4a35a] border-t-transparent mb-3" />
          <p className="text-xs text-[#9a9590]">Loading procedure...</p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <main className="mx-auto max-w-lg px-6 pt-20 text-center animate-fade-in">
          <div className="rounded-xl border border-white/10 bg-[#121212] p-8 space-y-4 shadow-xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 border border-white/10 text-[#c4a35a] mx-auto text-lg">
              !
            </div>
            <h2 className="text-lg font-bold text-[#f5f5f5]">Guide Unavailable</h2>
            <p className="text-xs text-[#9a9590] leading-relaxed">
              {error}
            </p>
          </div>
        </main>
      )}

      {/* Detail SOP View */}
      {!loading && sop && (
        <main className="mx-auto max-w-5xl px-6 pt-4 animate-fade-in">
          {/* Action Sub-Header */}
          <div className="sticky top-[61px] z-20 flex flex-wrap items-center justify-between gap-3 border-b border-white/8 bg-[#0a0a0a]/95 backdrop-blur-md py-3.5 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#f5f5f5] truncate max-w-[240px] sm:max-w-md">
                {sop.title}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded border border-white/10 bg-[#161616] px-3 py-1.5 text-xs font-semibold text-[#cfc9c2] hover:bg-[#202020] transition"
              >
                Export PDF / Print
              </button>
              <button
                type="button"
                onClick={handleShareLink}
                className="rounded border border-white/10 bg-[#161616] px-3 py-1.5 text-xs font-semibold text-[#cfc9c2] hover:bg-[#202020] transition"
              >
                {shareToast ? "✓ Copied" : "Share Link"}
              </button>

              {/* View Mode Toggle */}
              <div className="flex gap-0.5 rounded-md border border-white/8 bg-[#141414] p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode("doc")}
                  className={`rounded px-3 py-1 text-xs font-bold transition ${
                    viewMode === "doc"
                      ? "bg-[#c4a35a] text-[#0a0a0a]"
                      : "text-[#9a9590] hover:text-[#f5f5f5]"
                  }`}
                >
                  Document View
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("guide")}
                  className={`rounded px-3 py-1 text-xs font-bold transition ${
                    viewMode === "guide"
                      ? "bg-[#c4a35a] text-[#0a0a0a]"
                      : "text-[#9a9590] hover:text-[#f5f5f5]"
                  }`}
                >
                  Guide Me Mode
                </button>
              </div>
            </div>
          </div>

          {/* Mode A: Full Document View */}
          {viewMode === "doc" && (
            <div className="max-w-3xl space-y-6">
              {/* Header Meta */}
              <div>
                <div className="flex items-center gap-2.5 text-xs text-[#6f6a65] mb-3">
                  <span className="rounded bg-[#c4a35a]/10 border border-[#c4a35a]/30 px-2 py-0.5 font-mono text-[10.5px] font-bold uppercase text-[#c4a35a]">
                    {sop.category}
                  </span>
                  <span>{sop.estimated_minutes} min read</span>
                  <span>·</span>
                  <span>Role: {sop.target_role.toUpperCase()}</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#f5f5f5] leading-tight">
                  {sop.title}
                </h1>
              </div>

              {/* Objective Box */}
              {sop.summary && (
                <div className="rounded-r-lg border-y border-r border-white/8 border-l-2 border-l-[#c4a35a] bg-[#121212] p-5 space-y-1.5 shadow-md">
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#c4a35a]">
                    Objective
                  </span>
                  <p className="text-sm text-[#cfc9c2] leading-relaxed">{sop.summary}</p>
                </div>
              )}

              {/* Video Walkthrough Player if present */}
              {sop.video_url && (
                <div className="rounded-xl border border-white/10 bg-[#121214] p-5 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#c4a35a]" />
                      <span className="text-xs font-bold uppercase tracking-wider text-[#c4a35a]">
                        Video Walkthrough &amp; Voice Guide
                      </span>
                    </div>
                    <span className="font-mono text-[10.5px] text-[#9a9590]">1080P HD · AUDIO</span>
                  </div>
                  <div className="rounded-lg overflow-hidden border border-white/8 bg-black">
                    <video
                      src={sop.video_url}
                      controls
                      playsInline
                      className="w-full max-h-[440px] object-contain"
                    />
                  </div>
                </div>
              )}

              {/* Progress Bar with Reset */}
              <div className="flex items-center gap-4 rounded-lg border border-white/8 bg-[#0f0f0f] px-5 py-3.5 shadow-sm">
                <div className="flex-1 h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden">
                  <div
                    className="h-full bg-[#4ea882] rounded-full transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-[#9a9590] whitespace-nowrap">
                  {completedCount} of {stepsList.length} completed ({progressPct}%)
                </span>
                <button
                  type="button"
                  onClick={handleResetProgress}
                  className="text-xs text-[#6f6a65] hover:text-[#c4a35a] underline"
                >
                  Reset
                </button>
              </div>

              {/* Step Cards List */}
              <div className="space-y-5">
                {stepsList.map((step, idx) => {
                  const isChecked = Boolean(completedSteps[step.id]);

                  return (
                    <div
                      key={step.id || idx}
                      className={`flex gap-4 rounded-lg border p-6 transition shadow-md ${
                        isChecked
                          ? "border-white/6 bg-[#0f0f0f] opacity-75"
                          : "border-white/10 bg-[#121212]"
                      }`}
                    >
                      {/* Checkbox + Step Number */}
                      <div className="flex flex-col items-center gap-3 pt-0.5">
                        <button
                          type="button"
                          onClick={() => handleToggleStep(step.id)}
                          className={`flex h-6 w-6 items-center justify-center rounded border transition ${
                            isChecked
                              ? "bg-[#4ea882] border-[#4ea882] text-black font-bold text-xs"
                              : "border-white/20 bg-[#0a0a0a] hover:border-[#c4a35a]"
                          }`}
                        >
                          {isChecked ? "✓" : ""}
                        </button>
                        <span className="font-mono text-[10px] text-[#4d4a47]">
                          0{step.step_number || idx + 1}
                        </span>
                      </div>

                      {/* Step Main Body */}
                      <div className="flex-1 space-y-4 min-w-0">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#c4a35a]">
                            Step {step.step_number || idx + 1}
                          </span>
                          <h3
                            className={`text-lg font-bold tracking-tight text-[#f5f5f5] ${
                              isChecked ? "line-through text-[#9a9590]" : ""
                            }`}
                          >
                            {step.title}
                          </h3>
                        </div>

                        {/* Description / Bullet Points */}
                        <div className="space-y-1.5 text-sm text-[#cfc9c2] leading-relaxed whitespace-pre-line">
                          {step.description}
                        </div>

                        {/* Screenshot / Annotated Media Preview */}
                        {step.image_url && (
                          <div className="space-y-3">
                            <div
                              onClick={() =>
                                setLightboxImg({ src: step.image_url!, title: step.title })
                              }
                              className="relative rounded-md border border-white/10 overflow-hidden cursor-zoom-in bg-[#151515] group"
                            >
                              <img
                                src={step.image_url}
                                alt={step.title}
                                className="w-full max-h-96 object-contain"
                              />
                              <div className="absolute right-3 bottom-3 rounded bg-black/85 border border-white/12 px-2.5 py-1 text-[10.5px] font-semibold text-[#9a9590] group-hover:text-white transition">
                                ⤢ Click to zoom
                              </div>
                            </div>

                            {/* Numbered Pin Legend & Captions */}
                            {step.pins && step.pins.length > 0 && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                {step.pins.map((pin) => (
                                  <div
                                    key={pin.id}
                                    className="flex items-center gap-2.5 rounded-md border border-white/8 bg-[#161616] px-3 py-2 text-xs text-[#cfc9c2]"
                                  >
                                    <span className="flex h-5 min-w-[20px] px-1 shrink-0 items-center justify-center rounded-full bg-[#c4a35a] font-mono text-[11px] font-bold text-black">
                                      {pin.number}
                                    </span>
                                    <span className="font-medium text-[#f5f5f5]">
                                      {pin.label || `Action ${pin.number}`}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Copyable Script Snippet */}
                        {step.copy_snippets?.[0] && (
                          <div className="rounded-md border border-[#c4a35a]/25 overflow-hidden">
                            <div className="flex items-center justify-between bg-[#161310] px-3.5 py-2 border-b border-[#c4a35a]/20">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#c4a35a]">
                                {step.copy_snippets[0].title || "Script Template"}
                              </span>
                              <span className="font-mono text-[10.5px] text-[#6f6a65]">
                                fill the {"{variables}"}
                              </span>
                            </div>
                            <div className="p-3.5 bg-[#0a0a0a] font-mono text-xs text-[#e8e4de] leading-relaxed whitespace-pre-wrap">
                              {step.copy_snippets[0].template}
                            </div>
                            <div className="flex justify-end p-2 bg-[#0f0f0f] border-t border-white/6">
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopyScript(
                                    step.copy_snippets![0].template,
                                    step.copy_snippets![0].id
                                  )
                                }
                                className={`rounded px-3.5 py-1 text-xs font-bold transition ${
                                  copiedScriptId === step.copy_snippets[0].id
                                    ? "bg-[#4ea882] text-black"
                                    : "bg-[#c4a35a] text-[#0a0a0a] hover:bg-[#dcc084]"
                                }`}
                              >
                                {copiedScriptId === step.copy_snippets[0].id
                                  ? "✓ Copied"
                                  : "Copy Script"}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Pro Tip */}
                        {step.pro_tip && (
                          <div className="flex items-start gap-3 rounded-r-md border-l-2 border-l-[#c4a35a] bg-[#c4a35a]/5 p-3.5 text-xs text-[#cfc9c2]">
                            <span className="font-bold uppercase tracking-wider text-[#c4a35a] shrink-0">
                              Pro tip:
                            </span>
                            <span className="leading-relaxed">{step.pro_tip}</span>
                          </div>
                        )}

                        {/* Warning */}
                        {step.warning && (
                          <div className="flex items-start gap-3 rounded-r-md border-l-2 border-l-[#c0603c] bg-[#c0603c]/5 p-3.5 text-xs text-[#cfc9c2]">
                            <span className="font-bold uppercase tracking-wider text-[#d98a63] shrink-0">
                              Careful:
                            </span>
                            <span className="leading-relaxed">{step.warning}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Switch to Guide Mode Banner */}
              <div className="flex items-center justify-between gap-4 rounded-lg border border-white/8 bg-[#121212] p-5 shadow-lg">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-[#f5f5f5]">
                    Prefer to be walked through step-by-step?
                  </span>
                  <span className="text-xs text-[#9a9590]">
                    Guide Me mode shows one step at a time with scripts ready to copy.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setViewMode("guide")}
                  className="rounded bg-[#c4a35a] px-4 py-2 text-xs font-bold text-[#0a0a0a] hover:bg-[#dcc084] transition shrink-0"
                >
                  Start Guide Me →
                </button>
              </div>
            </div>
          )}

          {/* Mode B: Interactive "Guide Me" Mode */}
          {viewMode === "guide" && (
            <div className="max-w-3xl pb-16">
              {!guideFinished && stepsList[guideStepIdx] && (
                <div className="space-y-6">
                  {/* Top Progress Bar */}
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-1.5 rounded-full bg-[#161616] overflow-hidden">
                      <div
                        className="h-full bg-[#c4a35a] rounded-full transition-all duration-300"
                        style={{ width: `${guidePct}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs font-bold text-[#c4a35a]">
                      Step {guideStepIdx + 1} of {stepsList.length} ({guidePct}%)
                    </span>
                  </div>

                  {/* Active Step Card */}
                  <div className="rounded-xl border border-white/10 bg-[#121212] p-6 sm:p-8 space-y-6 shadow-2xl">
                    <div>
                      <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[#c4a35a]">
                        Step 0{guideStepIdx + 1}
                      </span>
                      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#f5f5f5] mt-1">
                        {stepsList[guideStepIdx].title}
                      </h2>
                    </div>

                    <div className="text-sm text-[#cfc9c2] leading-relaxed whitespace-pre-line">
                      {stepsList[guideStepIdx].description}
                    </div>

                    {/* Screenshot */}
                    {stepsList[guideStepIdx].image_url && (
                      <div
                        onClick={() =>
                          setLightboxImg({
                            src: stepsList[guideStepIdx].image_url!,
                            title: stepsList[guideStepIdx].title,
                          })
                        }
                        className="relative rounded-lg border border-white/10 overflow-hidden cursor-zoom-in bg-[#151515]"
                      >
                        <img
                          src={stepsList[guideStepIdx].image_url}
                          alt={stepsList[guideStepIdx].title}
                          className="w-full max-h-[440px] object-contain"
                        />
                      </div>
                    )}

                    {/* Script Snippet */}
                    {stepsList[guideStepIdx].copy_snippets?.[0] && (
                      <div className="rounded-lg border border-[#c4a35a]/30 overflow-hidden">
                        <div className="flex items-center justify-between bg-[#161310] px-4 py-2.5 border-b border-[#c4a35a]/20">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#c4a35a]">
                            {stepsList[guideStepIdx].copy_snippets[0].title || "Message Template"}
                          </span>
                          <span className="font-mono text-[10px] text-[#9a9590]">
                            fill the {"{variables}"}
                          </span>
                        </div>
                        <div className="p-4 bg-[#0a0a0a] font-mono text-xs text-[#f5f5f5] leading-relaxed whitespace-pre-wrap">
                          {stepsList[guideStepIdx].copy_snippets[0].template}
                        </div>
                        <div className="flex justify-end p-2.5 bg-[#0f0f0f] border-t border-white/6">
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyScript(
                                stepsList[guideStepIdx].copy_snippets![0].template,
                                stepsList[guideStepIdx].copy_snippets![0].id
                              )
                            }
                            className={`rounded px-4 py-1.5 text-xs font-bold transition ${
                              copiedScriptId === stepsList[guideStepIdx].copy_snippets[0].id
                                ? "bg-[#4ea882] text-black"
                                : "bg-[#c4a35a] text-[#0a0a0a] hover:bg-[#dcc084]"
                            }`}
                          >
                            {copiedScriptId === stepsList[guideStepIdx].copy_snippets[0].id
                              ? "✓ Copied to Clipboard"
                              : "Copy Script"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Pro Tip */}
                    {stepsList[guideStepIdx].pro_tip && (
                      <div className="rounded-r-md border-l-2 border-l-[#c4a35a] bg-[#c4a35a]/5 p-3.5 text-xs text-[#cfc9c2]">
                        <span className="font-bold uppercase tracking-wider text-[#c4a35a] mr-2">
                          Pro tip:
                        </span>
                        {stepsList[guideStepIdx].pro_tip}
                      </div>
                    )}
                  </div>

                  {/* Sticky Player Bottom Navigation Bar */}
                  <div className="flex items-center justify-between pt-4 border-t border-white/8">
                    <button
                      type="button"
                      onClick={() => setGuideStepIdx((prev) => Math.max(0, prev - 1))}
                      disabled={guideStepIdx === 0}
                      className="rounded border border-white/10 px-4 py-2 text-xs font-semibold text-[#9a9590] hover:text-[#f5f5f5] disabled:opacity-30"
                    >
                      ← Previous Step
                    </button>

                    <span className="font-mono text-xs text-[#6f6a65]">
                      Step {guideStepIdx + 1} of {stepsList.length}
                    </span>

                    {guideStepIdx < stepsList.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => {
                          handleToggleStep(stepsList[guideStepIdx].id);
                          setGuideStepIdx((prev) => prev + 1);
                        }}
                        className="rounded bg-[#c4a35a] px-5 py-2 text-xs font-bold text-[#0a0a0a] hover:bg-[#dcc084] transition"
                      >
                        Next Step →
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          handleToggleStep(stepsList[guideStepIdx].id);
                          setGuideFinished(true);
                        }}
                        className="rounded bg-[#4ea882] px-5 py-2 text-xs font-bold text-black hover:bg-[#5fc497] transition"
                      >
                        Complete SOP ✓
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Guide Completion Celebration Screen */}
              {guideFinished && (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#121212] p-12 text-center space-y-5 animate-fade-in shadow-2xl">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#4ea882]/20 text-[#4ea882] text-2xl font-bold border border-[#4ea882]/40">
                    ✓
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-[#f5f5f5]">SOP Completed</h2>
                    <p className="text-sm text-[#9a9590] mt-1">
                      You completed all {stepsList.length} steps in {sop.title}.
                    </p>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setGuideStepIdx(0);
                        setGuideFinished(false);
                      }}
                      className="rounded border border-white/10 bg-[#1a1a1a] px-5 py-2 text-xs font-semibold text-[#f5f5f5] hover:bg-[#222]"
                    >
                      Restart Walkthrough
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      )}

      {/* Screenshot Zoom Lightbox Modal */}
      {lightboxImg && (
        <div
          onClick={() => setLightboxImg(null)}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/92 backdrop-blur-md p-6 cursor-zoom-out animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] max-w-6xl overflow-hidden rounded-lg border border-white/10 bg-[#0e0e0e] shadow-2xl p-2"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/8 mb-2">
              <span className="text-xs font-semibold text-[#cfc9c2]">{lightboxImg.title}</span>
              <button
                type="button"
                onClick={() => setLightboxImg(null)}
                className="text-xs font-bold text-[#9a9590] hover:text-[#f5f5f5]"
              >
                ✕ Close
              </button>
            </div>
            <img
              src={lightboxImg.src}
              alt={lightboxImg.title}
              className="max-h-[80vh] w-auto object-contain mx-auto rounded"
            />
          </div>
        </div>
      )}
    </div>
  );
}
