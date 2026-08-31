import { useState } from "react";
import type { SopStep, SopCategory, SopTargetRole } from "../../../shared/pm/sopTypes";

interface AiDraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertSteps: (generatedSteps: SopStep[], metadata: { category: SopCategory; target_role: SopTargetRole }) => void;
}

const CATEGORIES: { id: SopCategory; label: string }[] = [
  { id: "outreach", label: "Outreach" },
  { id: "guest_ops", label: "Guest Ops" },
  { id: "turnover", label: "Turnover" },
  { id: "maintenance", label: "Maintenance" },
];

const TONES = ["Direct & Actionable", "Warm & Conversational", "Checklist only"];
const ROLES: { id: SopTargetRole; label: string }[] = [
  { id: "va", label: "VA" },
  { id: "cleaner", label: "Cleaner" },
  { id: "manager", label: "Manager" },
];

const DEFAULT_NOTES =
  "how to handle a guest asking for early check-in — check the cleaner slot first, dont promise anything until turnover confirmed, charge the early access fee if under 4hrs gap, always blur the door code before it goes in a guide, message the cleaner after, log it on the reservation not a separate invoice";

const SAMPLE_GENERATED_STEPS: SopStep[] = [
  {
    id: "gen-1",
    step_number: 1,
    title: "Confirm the turnover window before promising anything",
    description: "Open the unified inbox and pull the reservation for the requesting guest.\nCheck the prior checkout time and the cleaner’s scheduled slot in the turnover board.\nEarly check-in is only offered when the gap is 4+ hours.",
    media_type: "image",
  },
  {
    id: "gen-2",
    step_number: 2,
    title: "Redact the thread before it goes into the SOP",
    description: "Blur the guest name, phone number, and any door code visible in the list.\nBlackout payout and owner-net figures entirely — never blur financials.",
    media_type: "image",
  },
  {
    id: "gen-3",
    step_number: 3,
    title: "Reply with the early check-in decision",
    description: "Send within one hour of the request, even if the answer is no.\nNever quote a fee that is not in the property’s pricing sheet.",
    copy_snippets: [
      {
        id: "gen-cs-1",
        title: "Early Check-in Approval",
        template:
          "Hi {guest_first_name} — great news, we can get you in at {early_time} on {arrival_date}. There’s a {early_fee} early-access fee; reply “yes” and I’ll add it to your reservation and re-send the door code.",
      },
    ],
  },
  {
    id: "gen-4",
    step_number: 4,
    title: "Log the fee and update the reservation",
    description: "Add the early-access charge as a reservation alteration, not a manual invoice.\nSet arrival time on the reservation so the cleaner’s app reflects the new deadline.",
  },
  {
    id: "gen-5",
    step_number: 5,
    title: "Notify the cleaner and close the loop",
    description: "Message the assigned cleaner with the new hard deadline and confirm receipt.\nMark the thread “resolved — early check-in” so the owner report picks it up.",
    copy_snippets: [
      {
        id: "gen-cs-2",
        title: "Cleaner Deadline Alert",
        template:
          "Heads up {cleaner_name}: {property_name} now needs to be guest-ready by {early_time} on {arrival_date}. Confirm you can hit that — if not, reply now and I’ll reschedule the guest.",
      },
    ],
  },
];

export function AiDraftModal({ isOpen, onClose, onInsertSteps }: AiDraftModalProps) {
  const [notes, setNotes] = useState(DEFAULT_NOTES);
  const [selectedCat, setSelectedCat] = useState<SopCategory>("guest_ops");
  const [selectedTone, setSelectedTone] = useState("Direct & Actionable");
  const [selectedRole, setSelectedRole] = useState<SopTargetRole>("va");
  const [generatedSteps, setGeneratedSteps] = useState<SopStep[]>(SAMPLE_GENERATED_STEPS);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const charCount = notes.trim().length;
  const wordCount = notes.trim() ? notes.trim().split(/\s+/).length : 0;

  const handleGenerate = () => {
    setIsGenerating(true);
    // Parse notes into structured steps dynamically if custom notes provided
    setTimeout(() => {
      if (notes.trim() && notes !== DEFAULT_NOTES) {
        const lines = notes
          .split(/[\n,;]+/)
          .map((l) => l.trim())
          .filter((l) => l.length > 5);

        const customSteps: SopStep[] = (lines.length ? lines : ["First step", "Second step", "Third step"]).map(
          (line, idx) => ({
            id: `ai-step-${Date.now()}-${idx + 1}`,
            step_number: idx + 1,
            title: line.length > 45 ? `${line.slice(0, 42)}...` : line,
            description: `Execute: ${line}. Ensure all actions are verified before moving forward.`,
            media_type: idx === 0 || idx === 1 ? "image" : undefined,
            copy_snippets:
              idx === 2
                ? [
                    {
                      id: `ai-cs-${idx}`,
                      title: "Script Template",
                      template: `Hi {host_name} — confirming details for {property_address}. Please let us know if anything is needed.`,
                    },
                  ]
                : undefined,
          })
        );
        setGeneratedSteps(customSteps);
      } else {
        setGeneratedSteps(SAMPLE_GENERATED_STEPS);
      }
      setIsGenerating(false);
    }, 600);
  };

  const handleDropStep = (idx: number) => {
    const next = generatedSteps.filter((_, i) => i !== idx);
    next.forEach((s, i) => {
      s.step_number = i + 1;
    });
    setGeneratedSteps(next);
  };

  const handleInsert = () => {
    onInsertSteps(generatedSteps, {
      category: selectedCat,
      target_role: selectedRole,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/88 backdrop-blur-md p-4 sm:p-6">
      <div className="flex h-[760px] w-full max-w-4xl flex-col rounded-lg border border-white/10 bg-[#0e0e0e] shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 bg-[#141414] border-b border-white/8 shrink-0">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-[#c4a35a] text-sm">✦</span>
              <span className="text-[14.5px] font-bold text-[#f5f5f5]">Draft SOP with AI</span>
            </div>
            <span className="text-xs text-[#6f6a65]">
              Turn raw notes or a voice transcript into a structured, VA-ready playbook.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded border border-white/10 bg-[#1a1a1a] text-[#9a9590] hover:text-[#f5f5f5]"
          >
            ✕
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Notes Input Area */}
          <div className="flex flex-col gap-2">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#9a9590]">
              Raw notes, transcript, or bullets
            </span>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded border border-white/10 bg-[#0a0a0a] p-3.5 text-xs leading-relaxed text-[#e8e4df] outline-none focus:border-[#c4a35a]/50 resize-y"
            />
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNotes(DEFAULT_NOTES)}
                  className="rounded-full border border-white/10 bg-[#1a1a1a] px-3 py-1 text-[11px] font-semibold text-[#9a9590] hover:text-[#f5f5f5]"
                >
                  🎙 Paste sample transcript
                </button>
              </div>
              <span className="font-mono text-[10.5px] text-[#6f6a65]">
                {charCount} chars · {wordCount} words
              </span>
            </div>
          </div>

          {/* Config Chips Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6f6a65]">
                Category
              </span>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((cat) => {
                  const active = selectedCat === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCat(cat.id)}
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                        active
                          ? "bg-[#c4a35a] text-[#0a0a0a] font-bold"
                          : "border border-white/10 bg-[#141414] text-[#9a9590] hover:text-[#f5f5f5]"
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6f6a65]">
                Tone
              </span>
              <div className="flex flex-wrap gap-1.5">
                {TONES.map((tone) => {
                  const active = selectedTone === tone;
                  return (
                    <button
                      key={tone}
                      type="button"
                      onClick={() => setSelectedTone(tone)}
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                        active
                          ? "bg-[#c4a35a] text-[#0a0a0a] font-bold"
                          : "border border-white/10 bg-[#141414] text-[#9a9590] hover:text-[#f5f5f5]"
                      }`}
                    >
                      {tone}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6f6a65]">
                Target Role
              </span>
              <div className="flex flex-wrap gap-1.5">
                {ROLES.map((role) => {
                  const active = selectedRole === role.id;
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => setSelectedRole(role.id)}
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                        active
                          ? "bg-[#c4a35a] text-[#0a0a0a] font-bold"
                          : "border border-white/10 bg-[#141414] text-[#9a9590] hover:text-[#f5f5f5]"
                      }`}
                    >
                      {role.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="h-[1px] bg-white/7" />

          {/* Generated Preview Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#c4a35a]">
                Generated Draft
              </span>
              <span className="font-mono text-[10.5px] text-[#6f6a65]">
                {generatedSteps.length} steps · {selectedCat} · for {selectedRole.toUpperCase()}
              </span>
            </div>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="rounded border border-white/12 bg-[#1a1a1a] px-3 py-1.5 text-[11px] font-semibold text-[#f5f5f5] hover:border-[#c4a35a]/50 disabled:opacity-50"
            >
              {isGenerating ? "Generating..." : "↻ Regenerate"}
            </button>
          </div>

          {/* Generated Steps Cards */}
          <div className="space-y-3">
            {generatedSteps.map((step, idx) => (
              <div
                key={step.id || idx}
                className="flex gap-3.5 rounded-lg border border-white/8 bg-[#111111] p-4 hover:border-white/14 transition"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#c4a35a] text-xs font-bold text-[#0a0a0a]">
                  {step.step_number || idx + 1}
                </div>

                <div className="flex-1 flex flex-col gap-2 min-w-0">
                  <span className="text-[13.5px] font-semibold text-[#f5f5f5] leading-snug">
                    {step.title}
                  </span>

                  <p className="text-xs text-[#cfc9c2] leading-relaxed whitespace-pre-line">
                    {step.description}
                  </p>

                  {step.copy_snippets?.[0] && (
                    <div className="rounded border border-[#c4a35a]/22 overflow-hidden mt-1">
                      <div className="flex items-center justify-between bg-[#161310] px-3 py-1.5 border-b border-[#c4a35a]/18">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#c4a35a]">
                          Message template
                        </span>
                        <span className="font-mono text-[10px] text-[#9a9590]">
                          {"{variables}"}
                        </span>
                      </div>
                      <div className="p-2.5 bg-[#0a0a0a] font-mono text-xs text-[#cfc9c2] leading-relaxed">
                        {step.copy_snippets[0].template}
                      </div>
                    </div>
                  )}

                  {step.media_type === "image" && (
                    <div className="flex items-center gap-2.5 rounded border border-dashed border-white/14 bg-[#0a0a0a] p-2.5 mt-1">
                      <div className="flex h-8 w-14 items-center justify-center rounded bg-[#141414]">
                        <span className="font-mono text-[8px] text-[#6f6a65]">SHOT</span>
                      </div>
                      <span className="text-[11.5px] text-[#9a9590]">
                        Screenshot suggested for this step
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDropStep(idx)}
                    className="rounded border border-white/10 bg-[#1a1a1a] px-2.5 py-1 text-[10.5px] font-semibold text-[#cf7f7b] hover:border-[#cf7f7b]/45"
                  >
                    Drop
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#141414] border-t border-white/8 shrink-0">
          <span className="text-xs text-[#6f6a65]">
            Nothing is published until you review each step.
          </span>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#9a9590] hover:text-[#f5f5f5]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleInsert}
              className="px-5 py-2 bg-[#c4a35a] text-[#0a0a0a] text-xs font-bold rounded hover:bg-[#dcc084] transition"
            >
              Insert {generatedSteps.length} steps into builder
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
