import { useEffect, useMemo, useState } from "react";
import type { SopItem } from "../../../shared/pm/sopTypes";

interface PublicSopHubProps {
  initialSlug?: string | null;
}

const CATEGORY_MAP: Record<string, string> = {
  All: "All",
  "Outreach & Leads": "outreach",
  "Guest Comms": "guest_ops",
  "Team & Cleaners": "team_comms",
  Turnover: "turnover",
  Maintenance: "maintenance",
  Software: "software",
};

const CATEGORIES = ["All", "Outreach & Leads", "Guest Comms", "Team & Cleaners", "Turnover", "Software"];
const ROLES = ["All", "VA", "Cleaner", "Manager"];

export function PublicSopHub({ initialSlug }: PublicSopHubProps) {
  const [sops, setSops] = useState<SopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSlug, setCurrentSlug] = useState<string | null>(initialSlug || null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCat, setSelectedCat] = useState("All");
  const [selectedRole, setSelectedRole] = useState("All");
  const [viewMode, setViewMode] = useState<"doc" | "guide">("doc");

  // Step Progress State (persisted in localStorage)
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});
  const [guideStepIdx, setGuideStepIdx] = useState(0);
  const [guideFinished, setGuideFinished] = useState(false);

  // Copy Feedback State
  const [copiedScriptId, setCopiedScriptId] = useState<string | null>(null);
  const [shareToast, setShareToast] = useState<string | null>(null);

  // Lightbox State
  const [lightboxImg, setLightboxImg] = useState<{ src: string; title: string } | null>(null);

  // Fetch SOPs on mount
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/sop");
        if (res.ok) {
          const data = await res.json();
          setSops(data.sops || []);
        } else {
          setSops([]);
        }
      } catch {
        setSops([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Listen for browser popstate
  useEffect(() => {
    const handlePopState = () => {
      const parts = window.location.pathname.split("/").filter(Boolean);
      if (parts[0] === "sop" && parts[1]) {
        setCurrentSlug(parts[1]);
      } else {
        setCurrentSlug(null);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Active SOP
  const activeSop = useMemo(() => {
    if (!currentSlug) return null;
    return sops.find((s) => s.slug.toLowerCase() === currentSlug.toLowerCase()) || null;
  }, [sops, currentSlug]);

  // Load progress from localStorage
  useEffect(() => {
    if (activeSop) {
      try {
        const key = `mrg_sop_progress_${activeSop.slug}`;
        const saved = localStorage.getItem(key);
        if (saved) {
          setCompletedSteps(JSON.parse(saved));
        } else {
          setCompletedSteps({});
        }
      } catch {
        setCompletedSteps({});
      }
      setGuideStepIdx(0);
      setGuideFinished(false);
    }
  }, [activeSop?.slug]);

  // Navigate to SOP
  const handleOpenSop = (slug: string) => {
    setCurrentSlug(slug);
    window.history.pushState(null, "", `/sop/${encodeURIComponent(slug)}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Navigate back to Hub
  const handleGoHub = () => {
    setCurrentSlug(null);
    window.history.pushState(null, "", "/sop");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Toggle Step Checkbox in Doc View
  const handleToggleStep = (stepId: string) => {
    if (!activeSop) return;
    setCompletedSteps((prev) => {
      const next = { ...prev, [stepId]: !prev[stepId] };
      try {
        localStorage.setItem(`mrg_sop_progress_${activeSop.slug}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Reset Progress
  const handleResetProgress = () => {
    if (!activeSop) return;
    setCompletedSteps({});
    try {
      localStorage.removeItem(`mrg_sop_progress_${activeSop.slug}`);
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

  // Filtered List on Hub
  const filteredSops = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sops.filter((sop) => {
      if (!sop.is_published) return false;
      const matchCat =
        selectedCat === "All" ||
        CATEGORY_MAP[selectedCat] === sop.category ||
        sop.category === selectedCat;
      const matchRole =
        selectedRole === "All" ||
        sop.target_role.toLowerCase() === selectedRole.toLowerCase();
      const matchQuery =
        !q ||
        sop.title.toLowerCase().includes(q) ||
        sop.summary.toLowerCase().includes(q) ||
        sop.category.toLowerCase().includes(q);
      return matchCat && matchRole && matchQuery;
    });
  }, [sops, selectedCat, selectedRole, searchQuery]);

  // Progress Calculations
  const stepsList = activeSop?.steps || [];
  const completedCount = stepsList.filter((s) => completedSteps[s.id]).length;
  const progressPct = stepsList.length ? Math.round((completedCount / stepsList.length) * 100) : 0;
  const guidePct = stepsList.length
    ? Math.round(((guideStepIdx + 1) / stepsList.length) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5] font-sans antialiased pb-24 selection:bg-[#c4a35a]/30 selection:text-white">
      {/* Top MRG Branded Sticky Header */}
      <header className="sticky top-0 z-30 border-b border-white/8 bg-[#0c0c0c]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div
            onClick={handleGoHub}
            className="flex items-center gap-3 cursor-pointer group select-none"
          >
            {/* Bowtie Mark */}
            <div className="flex items-center gap-[2px]">
              <div
                className="h-5 w-3.5 bg-[#c4a35a] transition group-hover:bg-[#dcc084]"
                style={{ clipPath: "polygon(0 0, 100% 50%, 0 100%)" }}
              />
              <div
                className="h-5 w-3.5 bg-[#c4a35a] transition group-hover:bg-[#dcc084]"
                style={{ clipPath: "polygon(100% 0, 0 50%, 100% 100%)" }}
              />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold tracking-wider text-[#f5f5f5]">
                MANDEL REALTY GROUP
              </span>
              <span className="text-[10.5px] text-[#6f6a65] tracking-tight">
                Standard Operating Procedures &amp; Guides
              </span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <span className="font-mono text-[11px] text-[#4d4a47]">
              {activeSop ? `/sop/${activeSop.slug}` : "/sop"}
            </span>
          </div>
        </div>
      </header>

      {/* VIEW 1: Central SOP Directory Hub */}
      {!activeSop && (
        <main className="mx-auto max-w-6xl px-6 pt-10 animate-fade-in">
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#f5f5f5] mb-2">
              SOP Library
            </h1>
            <p className="text-sm sm:text-base text-[#9a9590] max-w-2xl leading-relaxed">
              Every workflow we run, documented step by step with screenshots and copy-paste scripts.
              No login needed — open a guide and follow along.
            </p>
          </div>

          {/* Search & Filter Bar */}
          <div className="mb-6 rounded-lg border border-white/8 bg-[#121212] p-5 space-y-4 shadow-xl">
            {/* Search Input */}
            <div className="flex items-center gap-3 rounded-md border border-white/10 bg-[#0a0a0a] px-3.5 h-11">
              <span className="text-sm text-[#6f6a65]">⌕</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search SOPs, templates, keywords..."
                className="flex-1 bg-transparent text-sm text-[#f5f5f5] outline-none placeholder:text-[#4d4a47]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-xs text-[#6f6a65] hover:text-[#f5f5f5]"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-6 pt-1">
              {/* Role Filter */}
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6f6a65]">
                  Role
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {ROLES.map((role) => {
                    const active = selectedRole === role;
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setSelectedRole(role)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                          active
                            ? "bg-[#c4a35a] text-[#0a0a0a] font-bold"
                            : "border border-white/10 bg-[#141414] text-[#9a9590] hover:text-[#f5f5f5]"
                        }`}
                      >
                        {role}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Category Filter */}
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6f6a65]">
                  Category
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((cat) => {
                    const active = selectedCat === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCat(cat)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                          active
                            ? "bg-[#c4a35a] text-[#0a0a0a] font-bold"
                            : "border border-white/10 bg-[#141414] text-[#9a9590] hover:text-[#f5f5f5]"
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Result Count Header */}
          <div className="flex items-center justify-between pb-4 text-xs text-[#6f6a65]">
            <span>Showing {filteredSops.length} guides</span>
            <span>Sorted by most recently updated</span>
          </div>

          {/* Cards Grid / Empty State */}
          {loading ? (
            <div className="py-20 text-center text-xs text-[#6f6a65]">Loading playbooks...</div>
          ) : filteredSops.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center rounded-lg border border-white/8 bg-[#121212] p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 border border-white/8 text-[#c4a35a] mb-3">
                <span className="text-lg">✦</span>
              </div>
              <h3 className="text-base font-bold text-[#f5f5f5]">No playbooks published yet</h3>
              <p className="text-xs text-[#9a9590] mt-1 max-w-sm">
                Standard operating procedures published by Mandel Realty Group will appear here for the team to view.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSops.map((sop) => (
                <div
                  key={sop.id || sop.slug}
                  onClick={() => handleOpenSop(sop.slug)}
                  className="group flex flex-col rounded-lg border border-white/8 bg-[#121212] overflow-hidden hover:border-[#c4a35a]/40 hover:bg-[#161616] transition cursor-pointer shadow-lg"
                >
                  <div className="flex-1 p-5 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-base font-bold text-[#f5f5f5] leading-snug group-hover:text-[#c4a35a] transition">
                        {sop.title}
                      </h3>
                      <span className="rounded bg-[#c4a35a]/10 border border-[#c4a35a]/30 px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-wider text-[#c4a35a] shrink-0">
                        {sop.category}
                      </span>
                    </div>

                    <p className="text-xs text-[#9a9590] leading-relaxed line-clamp-3">
                      {sop.summary}
                    </p>

                    <div className="mt-auto pt-2 flex items-center gap-2">
                      <span className="rounded border border-white/10 bg-[#1a1a1a] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#9a9590]">
                        {sop.target_role.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/8 bg-[#0f0f0f] px-5 py-3 text-xs">
                    <span className="text-[#6f6a65]">
                      {sop.steps?.length || 0} steps · {sop.estimated_minutes} min
                    </span>
                    <span className="font-bold text-[#c4a35a] group-hover:translate-x-0.5 transition">
                      Open Guide →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* VIEW 2: Detail SOP View */}
      {activeSop && (
        <main className="mx-auto max-w-5xl px-6 pt-4 animate-fade-in">
          {/* Action Sub-Header */}
          <div className="sticky top-[61px] z-20 flex flex-wrap items-center justify-between gap-3 border-b border-white/8 bg-[#0a0a0a]/95 backdrop-blur-md py-3.5 mb-6">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleGoHub}
                className="rounded border border-white/10 bg-transparent px-3 py-1.5 text-xs font-semibold text-[#9a9590] hover:text-[#f5f5f5] hover:border-white/20 transition"
              >
                ← All SOPs
              </button>
              <span className="text-xs text-[#4d4a47]">/</span>
              <span className="text-xs font-semibold text-[#9a9590] truncate max-w-[200px] sm:max-w-sm">
                {activeSop.title}
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
                    {activeSop.category}
                  </span>
                  <span>{activeSop.estimated_minutes} min read</span>
                  <span>·</span>
                  <span>Role: {activeSop.target_role.toUpperCase()}</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#f5f5f5] leading-tight">
                  {activeSop.title}
                </h1>
              </div>

              {/* Objective Box */}
              {activeSop.summary && (
                <div className="rounded-r-lg border-y border-r border-white/8 border-l-2 border-l-[#c4a35a] bg-[#121212] p-5 space-y-1.5 shadow-md">
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#c4a35a]">
                    Objective
                  </span>
                  <p className="text-sm text-[#cfc9c2] leading-relaxed">{activeSop.summary}</p>
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
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#c4a35a] font-mono text-[11px] font-bold text-black">
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
                      You completed all {stepsList.length} steps in {activeSop.title}.
                    </p>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setGuideStepIdx(0);
                        setGuideFinished(false);
                      }}
                      className="rounded border border-white/10 bg-[#1a1a1a] px-4 py-2 text-xs font-semibold text-[#f5f5f5] hover:bg-[#222]"
                    >
                      Restart Walkthrough
                    </button>
                    <button
                      type="button"
                      onClick={handleGoHub}
                      className="rounded bg-[#c4a35a] px-5 py-2 text-xs font-bold text-[#0a0a0a] hover:bg-[#dcc084]"
                    >
                      Browse Other SOPs
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
