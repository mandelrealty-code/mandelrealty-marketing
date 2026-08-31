import { useEffect, useMemo, useState } from "react";
import { pmGet, pmPost } from "./api";
import type { SopItem, SopStep, SopCategory, SopTargetRole } from "../../../shared/pm/sopTypes";
import { ImageRedactorModal } from "../../components/sop/ImageRedactorModal";
import { AiDraftModal } from "../../components/sop/AiDraftModal";

const CATS: { id: string; label: string; catKey?: SopCategory }[] = [
  { id: "All", label: "All" },
  { id: "Outreach & Leads", label: "Outreach & Leads", catKey: "outreach" },
  { id: "Guest Comms", label: "Guest Comms", catKey: "guest_ops" },
  { id: "Team & Cleaners", label: "Team & Cleaners", catKey: "team_comms" },
  { id: "Turnover", label: "Turnover", catKey: "turnover" },
  { id: "Software", label: "Software", catKey: "software" },
];

const ROLE_STYLE: Record<string, { fg: string; bg: string; border: string }> = {
  va: { fg: "#c4a35a", bg: "rgba(196,163,90,0.10)", border: "rgba(196,163,90,0.30)" },
  cleaner: { fg: "#9a9590", bg: "#1a1a1a", border: "rgba(255,255,255,0.12)" },
  manager: { fg: "#cfc9c2", bg: "#222222", border: "rgba(255,255,255,0.16)" },
  all: { fg: "#f5f5f5", bg: "#1c1c1c", border: "rgba(255,255,255,0.14)" },
};

export function SopsPanel() {
  const [sops, setSops] = useState<SopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCat, setSelectedCat] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [aiDraftOpen, setAiDraftOpen] = useState(false);
  const [editingSop, setEditingSop] = useState<SopItem | null>(null);
  const [activeRedactorStepIdx, setActiveRedactorStepIdx] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load from database (clean slate if empty)
  const fetchSops = async () => {
    setLoading(true);
    try {
      const data = await pmGet<{ sops: SopItem[] }>("sops");
      setSops(data.sops || []);
    } catch {
      setSops([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSops();
  }, []);

  const handleCopyLink = (sop: SopItem) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://mandelrealtygroup.com";
    const publicUrl = `${origin}/sop/${sop.slug}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(publicUrl).catch(() => {});
    }
    setToast(publicUrl);
    setCopiedSlug(sop.slug);
    setTimeout(() => {
      setToast(null);
      setCopiedSlug(null);
    }, 2500);
  };

  const handleOpenNew = () => {
    const newSop: SopItem = {
      id: "",
      slug: `sop-${Date.now()}`,
      title: "Untitled SOP",
      category: "outreach",
      target_role: "va",
      summary: "",
      estimated_minutes: 15,
      is_published: true,
      author: "Shane M.",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      steps: [
        {
          id: `step-${Date.now()}-1`,
          step_number: 1,
          title: "Step 1: First action",
          description: "Explain clearly what the team member needs to do here.",
          media_type: "image",
        },
      ],
    };
    setEditingSop(newSop);
    setEditorOpen(true);
  };

  const handleEditSop = (sop: SopItem) => {
    // Deep clone to allow safe editing
    setEditingSop(JSON.parse(JSON.stringify(sop)));
    setEditorOpen(true);
  };

  const handleSaveSop = async () => {
    if (!editingSop) return;
    setSaving(true);
    try {
      const res = await pmPost<{ sop: SopItem }>("sops", {
        op: "save",
        ...editingSop,
      });
      if (res.sop) {
        setSops((prev) => {
          const idx = prev.findIndex((s) => s.id === res.sop.id || s.slug === res.sop.slug);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = res.sop;
            return next;
          }
          return [res.sop, ...prev];
        });
      }
      setEditorOpen(false);
      setEditingSop(null);
    } catch (err: any) {
      alert(`Could not save SOP: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  const filteredSops = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sops.filter((sop) => {
      const matchCat =
        selectedCat === "All" ||
        CATS.find((c) => c.id === selectedCat)?.catKey === sop.category ||
        sop.category === selectedCat;
      const matchQuery =
        !q ||
        sop.title.toLowerCase().includes(q) ||
        sop.category.toLowerCase().includes(q) ||
        sop.target_role.toLowerCase().includes(q) ||
        sop.summary.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }, [sops, selectedCat, searchQuery]);

  const stats = useMemo(() => {
    return {
      total: sops.filter((s) => s.is_published).length,
      steps: sops.reduce((acc, s) => acc + (s.steps?.length || 0), 0),
      drafts: sops.filter((s) => !s.is_published).length,
    };
  }, [sops]);

  // Step editor actions
  const updateStep = (idx: number, updates: Partial<SopStep>) => {
    if (!editingSop) return;
    const steps = [...(editingSop.steps || [])];
    steps[idx] = { ...steps[idx], ...updates };
    setEditingSop({ ...editingSop, steps });
  };

  const addStep = (idx?: number) => {
    if (!editingSop) return;
    const steps = [...(editingSop.steps || [])];
    const newStep: SopStep = {
      id: `step-${Date.now()}`,
      step_number: idx !== undefined ? idx + 2 : steps.length + 1,
      title: "",
      description: "",
      media_type: "image",
    };
    if (idx !== undefined) {
      steps.splice(idx + 1, 0, newStep);
    } else {
      steps.push(newStep);
    }
    // Renumber
    steps.forEach((s, i) => {
      s.step_number = i + 1;
    });
    setEditingSop({ ...editingSop, steps });
  };

  const deleteStepAt = (idx: number) => {
    if (!editingSop) return;
    const steps = editingSop.steps.filter((_, i) => i !== idx);
    steps.forEach((s, i) => {
      s.step_number = i + 1;
    });
    setEditingSop({ ...editingSop, steps });
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#080808] text-[#f5f5f5] pb-24">
      {/* Top Title & Stats Bar */}
      <div className="px-6 sm:px-9 pt-8 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/8 bg-[#0a0a0a]">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6f6a65]">
              MRG OPS
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c4a35a]">
              SOPs &amp; Playbooks
            </span>
          </div>
          <h1 className="text-2xl sm:text-[26px] font-bold tracking-tight text-[#f5f5f5]">
            SOPs &amp; Playbooks
          </h1>
          <p className="text-xs sm:text-[13px] text-[#9a9590] max-w-xl">
            Every repeatable motion in the business, written once and shipped to the team as a step-by-step guide with screenshot redactions.
          </p>
        </div>

        <div className="flex items-center gap-7 sm:gap-9">
          <div className="flex flex-col gap-1">
            <span className="text-xl sm:text-2xl font-bold text-[#f5f5f5]">{stats.total}</span>
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#6f6a65]">
              Published
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xl sm:text-2xl font-bold text-[#f5f5f5]">{stats.steps}</span>
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#6f6a65]">
              Total Steps
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xl sm:text-2xl font-bold text-[#c4a35a]">{stats.drafts}</span>
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#6f6a65]">
              Drafts
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAiDraftOpen(true)}
              className="flex items-center gap-1.5 rounded-md border border-[#c4a35a]/35 bg-[#1a1814] px-3.5 py-2 text-[12px] font-bold text-[#c4a35a] hover:bg-[#c4a35a]/15 transition"
            >
              <span>✦</span>
              <span>Draft with AI</span>
            </button>
            <button
              type="button"
              onClick={handleOpenNew}
              className="rounded-md bg-[#c4a35a] px-4 py-2 text-[12.5px] font-bold text-[#0a0a0a] hover:bg-[#dcc084] transition shadow-md"
            >
              + New SOP
            </button>
          </div>
        </div>
      </div>

      {/* Filter Chips & Search Bar */}
      <div className="px-6 sm:px-9 py-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {CATS.map((chip) => {
            const active = selectedCat === chip.id;
            const count =
              chip.id === "All"
                ? sops.length
                : sops.filter((s) => s.category === chip.catKey || s.category === chip.id).length;

            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setSelectedCat(chip.id)}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wide transition ${
                  active
                    ? "bg-[#c4a35a] text-[#0a0a0a]"
                    : "border border-white/8 bg-[#141414] text-[#9a9590] hover:text-[#f5f5f5]"
                }`}
              >
                <span>{chip.label}</span>
                <span className={`text-[11px] ${active ? "opacity-70" : "opacity-45"}`}>{count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 rounded-md border border-white/8 bg-[#141414] px-3 py-1.5 w-full sm:w-64">
          <span className="text-xs text-[#6f6a65]">⌕</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search SOPs..."
            className="w-full bg-transparent text-xs text-[#f5f5f5] outline-none placeholder:text-[#6f6a65]"
          />
        </div>
      </div>

      {/* Table Head (Desktop) */}
      <div className="hidden md:grid mx-6 sm:mx-9 px-4 py-2.5 grid-cols-[1fr_120px_100px_90px_230px] gap-4 border-b border-white/8 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#6f6a65]">
        <span>SOP</span>
        <span>Role</span>
        <span>Time</span>
        <span>Steps</span>
        <span className="text-right">Actions</span>
      </div>

      {/* List Rows */}
      <div className="mx-6 sm:mx-9 flex flex-col divide-y divide-white/6">
        {loading ? (
          <div className="py-16 text-center text-xs text-[#6f6a65]">Loading playbooks...</div>
        ) : filteredSops.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 border border-white/8 text-[#c4a35a] mb-3">
              <span className="text-lg">✦</span>
            </div>
            <h3 className="text-base font-bold text-[#f5f5f5]">No SOPs created yet</h3>
            <p className="text-xs text-[#9a9590] mt-1 max-w-sm">
              Create your first step-by-step operating procedure, or draft one in seconds using AI from your notes.
            </p>
            <div className="flex items-center gap-3 mt-5">
              <button
                type="button"
                onClick={() => setAiDraftOpen(true)}
                className="flex items-center gap-1.5 rounded-md border border-[#c4a35a]/35 bg-[#1a1814] px-4 py-2 text-xs font-bold text-[#c4a35a] hover:bg-[#c4a35a]/15 transition"
              >
                <span>✦</span>
                <span>Draft with AI</span>
              </button>
              <button
                type="button"
                onClick={handleOpenNew}
                className="rounded-md bg-[#c4a35a] px-4 py-2 text-xs font-bold text-[#0a0a0a] hover:bg-[#dcc084] transition"
              >
                + Create SOP
              </button>
            </div>
          </div>
        ) : (
          filteredSops.map((sop) => {
            const roleKey = sop.target_role || "va";
            const rStyle = ROLE_STYLE[roleKey] || ROLE_STYLE.va;
            const isCopied = copiedSlug === sop.slug;

            return (
              <div
                key={sop.id || sop.slug}
                className="group py-4 px-3 sm:px-4 flex flex-col md:grid md:grid-cols-[1fr_120px_100px_90px_230px] items-start md:items-center gap-3 md:gap-4 hover:bg-[#111111] transition rounded-lg"
              >
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-[#f5f5f5] tracking-tight">
                      {sop.title}
                    </span>
                    {!sop.is_published && (
                      <span className="rounded border border-white/12 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.12em] text-[#9a9590]">
                        Draft
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[11.5px] text-[#6f6a65]">
                    {sop.category} · updated {new Date(sop.updated_at).toLocaleDateString()}
                  </span>
                </div>

                <div>
                  <span
                    className="rounded px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider"
                    style={{
                      color: rStyle.fg,
                      backgroundColor: rStyle.bg,
                      border: `1px solid ${rStyle.border}`,
                    }}
                  >
                    {sop.target_role.toUpperCase()}
                  </span>
                </div>

                <span className="text-xs text-[#9a9590]">{sop.estimated_minutes} min</span>

                <span className="text-xs text-[#9a9590]">{sop.steps?.length || 0} steps</span>

                <div className="flex items-center gap-2 w-full md:w-auto md:justify-end">
                  <button
                    type="button"
                    onClick={() => handleEditSop(sop)}
                    className="flex-1 md:flex-none rounded border border-white/10 bg-[#1a1a1a] px-3.5 py-1.5 text-xs font-semibold text-[#f5f5f5] hover:bg-[#222222] hover:border-white/20 transition"
                  >
                    Edit Guide
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyLink(sop)}
                    className={`flex-1 md:flex-none rounded px-3.5 py-1.5 text-xs font-bold transition ${
                      isCopied
                        ? "border border-[#c4a35a]/40 bg-[#1a1a1a] text-[#c4a35a]"
                        : "bg-[#c4a35a] text-[#0a0a0a] hover:bg-[#dcc084]"
                    }`}
                  >
                    {isCopied ? "✓ Copied" : "Copy VA Link"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Copy Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-md border border-[#c4a35a]/35 bg-[#1a1a1a] px-4 py-2.5 shadow-2xl animate-fade-in">
          <span className="text-[#c4a35a] text-sm">✓</span>
          <span className="text-xs text-[#f5f5f5]">Link copied</span>
          <span className="font-mono text-xs text-[#9a9590]">{toast}</span>
        </div>
      )}

      {/* Slide-over SOP Step Editor */}
      {editorOpen && editingSop && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/65 backdrop-blur-sm">
          <div className="flex-1" onClick={() => setEditorOpen(false)} />
          <div className="flex h-full w-full max-w-3xl flex-col border-l border-white/10 bg-[#0c0c0c] shadow-2xl overflow-hidden">
            {/* Editor Top Bar */}
            <div className="flex items-center justify-between border-b border-white/8 bg-[#111111] px-6 py-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#c4a35a]">
                  Edit Guide
                </span>
                <span className="font-mono text-xs text-[#6f6a65]">
                  mandelrealtygroup.com/sop/{editingSop.slug}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded border border-white/10 bg-[#141414] text-[#9a9590] hover:text-[#f5f5f5]"
              >
                ✕
              </button>
            </div>

            {/* Editor Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              {/* Metadata Box */}
              <div className="flex flex-col gap-3 rounded-lg border border-white/8 bg-[#111111] p-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#6f6a65]">
                    SOP Title
                  </label>
                  <input
                    type="text"
                    value={editingSop.title}
                    onChange={(e) => setEditingSop({ ...editingSop, title: e.target.value })}
                    className="rounded border border-white/10 bg-[#0a0a0a] px-3.5 py-2.5 text-base font-semibold text-[#f5f5f5] outline-none focus:border-[#c4a35a]/55"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#6f6a65]">
                      Category
                    </label>
                    <select
                      value={editingSop.category}
                      onChange={(e) =>
                        setEditingSop({ ...editingSop, category: e.target.value as SopCategory })
                      }
                      className="rounded border border-white/10 bg-[#0a0a0a] px-3 py-2 text-xs text-[#f5f5f5] outline-none"
                    >
                      <option value="outreach">Outreach &amp; Leads</option>
                      <option value="guest_ops">Guest Comms</option>
                      <option value="team_comms">Team &amp; Cleaners</option>
                      <option value="turnover">Turnover</option>
                      <option value="software">Software</option>
                      <option value="other">General</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#6f6a65]">
                      Target Role
                    </label>
                    <select
                      value={editingSop.target_role}
                      onChange={(e) =>
                        setEditingSop({ ...editingSop, target_role: e.target.value as SopTargetRole })
                      }
                      className="rounded border border-white/10 bg-[#0a0a0a] px-3 py-2 text-xs text-[#f5f5f5] outline-none"
                    >
                      <option value="va">VA</option>
                      <option value="cleaner">Cleaner</option>
                      <option value="manager">Manager</option>
                      <option value="all">All</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#6f6a65]">
                      Est. Duration (mins)
                    </label>
                    <input
                      type="number"
                      value={editingSop.estimated_minutes}
                      onChange={(e) =>
                        setEditingSop({
                          ...editingSop,
                          estimated_minutes: parseInt(e.target.value) || 15,
                        })
                      }
                      className="rounded border border-white/10 bg-[#0a0a0a] px-3 py-2 text-xs text-[#f5f5f5] outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Steps Header */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#9a9590]">
                  Steps · {editingSop.steps?.length || 0}
                </span>
                <button
                  type="button"
                  onClick={() => addStep()}
                  className="flex items-center gap-1.5 rounded border border-[#c4a35a]/40 bg-[#1a1814] px-3 py-1 text-xs font-bold text-[#c4a35a] hover:bg-[#c4a35a]/20 transition"
                >
                  <span>+</span>
                  <span>Add Step</span>
                </button>
              </div>

              {/* Steps List / Empty State */}
              {!editingSop.steps || editingSop.steps.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/10 bg-[#0d0d0d] p-10 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 border border-white/8 text-[#c4a35a] mb-2.5">
                    <span className="text-lg">+</span>
                  </div>
                  <span className="text-sm font-semibold text-[#f5f5f5]">No steps in this SOP yet</span>
                  <p className="text-xs text-[#9a9590] mt-1 max-w-xs leading-relaxed">
                    Add your first step to start building this step-by-step playbook.
                  </p>
                  <button
                    type="button"
                    onClick={() => addStep()}
                    className="mt-4 rounded-md bg-[#c4a35a] px-4 py-2 text-xs font-bold text-[#0a0a0a] hover:bg-[#dcc084] transition shadow-sm"
                  >
                    + Add Step 1
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {editingSop.steps.map((step, idx) => (
                    <div key={step.id || idx} className="flex flex-col">
                      <div className="flex gap-3.5 rounded-lg border border-white/8 bg-[#111111] p-4 sm:p-5 hover:border-white/14 transition">
                        <div className="flex flex-col items-center gap-2 pt-0.5">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#c4a35a] text-xs font-bold text-[#0a0a0a]">
                            {step.step_number || idx + 1}
                          </div>
                          <span className="text-sm text-[#444] cursor-grab">⣿</span>
                        </div>

                        <div className="flex-1 flex flex-col gap-3 min-w-0">
                          <input
                            type="text"
                            value={step.title}
                            onChange={(e) => updateStep(idx, { title: e.target.value })}
                            placeholder="Step title"
                            className="rounded border border-white/10 bg-[#0a0a0a] px-3 py-2 text-sm font-semibold text-[#f5f5f5] outline-none focus:border-[#c4a35a]/50"
                          />

                          <textarea
                            rows={3}
                            value={step.description}
                            onChange={(e) => updateStep(idx, { description: e.target.value })}
                            placeholder="Instructions for this step..."
                            className="rounded border border-white/10 bg-[#0a0a0a] p-3 text-xs leading-relaxed text-[#9a9590] outline-none focus:border-[#c4a35a]/50 resize-y"
                          />

                          {/* Screenshot / Redactor Area */}
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded border border-dashed border-white/14 bg-[#0a0a0a] p-3.5">
                            {step.image_url ? (
                              <img
                                src={step.image_url}
                                alt="Step visual"
                                className="h-16 w-28 rounded object-cover border border-white/10"
                              />
                            ) : (
                              <div className="flex h-16 w-28 items-center justify-center rounded bg-[#141414] border border-white/8">
                                <span className="font-mono text-[9px] uppercase tracking-wider text-[#6f6a65]">
                                  SCREENSHOT
                                </span>
                              </div>
                            )}

                            <div className="flex-1 flex flex-col gap-2">
                              <span className="text-xs text-[#9a9590]">
                                Paste Screenshot <kbd className="font-mono text-[#6f6a65]">(⌘V)</kbd> or launch Redactor
                              </span>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setActiveRedactorStepIdx(idx)}
                                  className="rounded border border-white/10 bg-[#1a1a1a] px-3 py-1.5 text-[11.5px] font-semibold text-[#f5f5f5] hover:bg-[#222222]"
                                >
                                  {step.image_url ? "Edit in Redactor" : "Open Redactor / Annotator"}
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Script Snippet Builder */}
                          <div className="rounded border border-[#c4a35a]/25 overflow-hidden">
                            <div className="flex items-center justify-between bg-[#161310] px-3 py-2 border-b border-[#c4a35a]/20">
                              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#c4a35a]">
                                Script Snippet (1-Click Copy for VA)
                              </span>
                              <div className="flex gap-1.5">
                                <span className="rounded border border-white/10 bg-[#0a0a0a] px-2 py-0.5 font-mono text-[10px] text-[#9a9590]">
                                  {"{host_name}"}
                                </span>
                                <span className="rounded border border-white/10 bg-[#0a0a0a] px-2 py-0.5 font-mono text-[10px] text-[#9a9590]">
                                  {"{property_address}"}
                                </span>
                              </div>
                            </div>
                            <textarea
                              rows={3}
                              value={step.copy_snippets?.[0]?.template || ""}
                              onChange={(e) => {
                                const template = e.target.value;
                                updateStep(idx, {
                                  copy_snippets: [
                                    {
                                      id: `cs-${idx}`,
                                      title: "Script",
                                      template,
                                    },
                                  ],
                                });
                              }}
                              placeholder="Type script template here with {host_name} tags..."
                              className="w-full bg-[#0a0a0a] p-3 font-mono text-xs leading-relaxed text-[#f5f5f5] outline-none resize-y"
                            />
                          </div>

                          {/* Pro Tip & Warning Inputs */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <input
                              type="text"
                              value={step.pro_tip || ""}
                              onChange={(e) => updateStep(idx, { pro_tip: e.target.value })}
                              placeholder="Pro tip (optional)..."
                              className="rounded border border-[#c4a35a]/20 bg-[#c4a35a]/5 px-3 py-2 text-xs text-[#cfc9c2] outline-none"
                            />
                            <input
                              type="text"
                              value={step.warning || ""}
                              onChange={(e) => updateStep(idx, { warning: e.target.value })}
                              placeholder="Never / Warning (optional)..."
                              className="rounded border border-[#c0603c]/20 bg-[#c0603c]/5 px-3 py-2 text-xs text-[#cfc9c2] outline-none"
                            />
                          </div>

                          {/* Step Delete action */}
                          <div className="flex justify-end pt-1">
                            <button
                              type="button"
                              onClick={() => deleteStepAt(idx)}
                              className="text-[11px] text-[#cf7f7b] hover:underline"
                            >
                              Delete Step
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Inline + Add Step divider */}
                      <div className="flex items-center gap-3 py-2 opacity-55 hover:opacity-100 transition">
                        <div className="flex-1 h-[1px] bg-white/8" />
                        <button
                          type="button"
                          onClick={() => addStep(idx)}
                          className="rounded-full border border-white/10 bg-[#141414] px-3 py-1 text-[11px] font-semibold text-[#9a9590] hover:text-[#c4a35a] hover:border-[#c4a35a]/40"
                        >
                          + Add Step
                        </button>
                        <div className="flex-1 h-[1px] bg-white/8" />
                      </div>
                    </div>
                  ))}

                  {/* Bottom Add Next Step button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => addStep()}
                      className="w-full py-2.5 rounded-lg border border-dashed border-white/15 bg-[#111111]/70 text-xs font-semibold text-[#cfc9c2] hover:border-[#c4a35a]/50 hover:text-[#c4a35a] hover:bg-[#151515] transition"
                    >
                      + Add Next Step
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Bottom Bar */}
            <div className="flex items-center justify-between border-t border-white/10 bg-[#111111] px-6 py-4">
              <span className="text-[11.5px] text-[#6f6a65]">Autosaved</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="rounded border border-white/10 px-4 py-2 text-xs font-semibold text-[#9a9590] hover:text-[#f5f5f5]"
                >
                  Discard Changes
                </button>
                <button
                  type="button"
                  onClick={handleSaveSop}
                  disabled={saving}
                  className="rounded bg-[#c4a35a] px-5 py-2 text-xs font-bold text-[#0a0a0a] hover:bg-[#dcc084] transition disabled:opacity-50"
                >
                  {saving ? "Publishing..." : "Publish SOP"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Redactor Modal Instance */}
      {activeRedactorStepIdx !== null && editingSop && (
        <ImageRedactorModal
          isOpen={true}
          initialImageUrl={editingSop.steps?.[activeRedactorStepIdx]?.image_url}
          onClose={() => setActiveRedactorStepIdx(null)}
          onSave={(bakedDataUrl, boxes, pins) => {
            updateStep(activeRedactorStepIdx, {
              image_url: bakedDataUrl,
              boxes,
              pins,
            });
            setActiveRedactorStepIdx(null);
          }}
        />
      )}

      {/* AI Draft Modal Instance */}
      <AiDraftModal
        isOpen={aiDraftOpen}
        onClose={() => setAiDraftOpen(false)}
        onInsertSteps={(generatedSteps, metadata) => {
          const newSop: SopItem = {
            id: "",
            slug: `sop-${Date.now()}`,
            title: generatedSteps[0]?.title || "AI Generated SOP",
            category: metadata.category,
            target_role: metadata.target_role,
            summary: "AI generated standard operating procedure playbook.",
            estimated_minutes: generatedSteps.length * 3,
            is_published: true,
            author: "Shane M. (AI)",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            steps: generatedSteps,
          };
          setEditingSop(newSop);
          setEditorOpen(true);
        }}
      />
    </div>
  );
}
