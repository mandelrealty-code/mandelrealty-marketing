import { useCallback, useEffect, useMemo, useState } from "react";
import { pmGet, pmPost } from "./api";
import { GoldButton } from "./ui";

export type ReviewReplyJobRow = {
  id: string;
  review_id: string;
  hospitable_review_id: string;
  property_id: string;
  listing_nickname: string;
  guest_first_name: string;
  stars: number | null;
  platform: string;
  class: string;
  status: "pending" | "posted" | "held";
  decision_json: {
    claims?: Array<{ claim: string; rating: string; evidence: string }>;
    violation?: { type: string | null; strength?: string };
  };
  draft_reply: string;
  edited_reply: string;
  posted_reply: string;
  posted_at: string | null;
  removal_packet_json: {
    summary: string;
    evidence: Array<{ t: string; text: string }>;
    violation_label: string;
  } | null;
  removal_filed: boolean;
  removal_filed_at: string | null;
  removal_outcome: string;
  confidence: string;
  needs_human: boolean;
  reason_for_escalation: string;
  sign_off: boolean;
  dry_run: boolean;
  created_at: string;
  public_review?: string;
  reviewed_at?: string | null;
};

type Filter = "pending" | "posted" | "held" | "removal";

type Props = {
  desktop: boolean;
  restoreJobId?: string | null;
  onJobIdChange?: (id: string | null) => void;
  onToast: (msg: string) => void;
  onError: (msg: string) => void;
};

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "pending", label: "Needs approval" },
  { id: "posted", label: "Posted" },
  { id: "held", label: "Held" },
  { id: "removal", label: "Removals" },
];

const EMPTY: Record<Filter, string> = {
  pending: "You're caught up",
  posted: "Nothing posted yet",
  held: "Nothing on hold",
  removal: "No removal requests",
};

const CHIP: Record<string, { bg: string; color: string }> = {
  Contradicted: { bg: "rgba(207,127,123,0.14)", color: "#e09a96" },
  Accurate: { bg: "rgba(78,168,130,0.14)", color: "#6cc39e" },
  "Accurate, resolved": { bg: "rgba(78,168,130,0.14)", color: "#6cc39e" },
  "Not raised": { bg: "rgba(255,255,255,0.06)", color: "#9a9590" },
  Disclosed: { bg: "rgba(255,255,255,0.06)", color: "#9a9590" },
  "Outside our control": { bg: "rgba(255,255,255,0.06)", color: "#9a9590" },
  Unverifiable: { bg: "rgba(255,255,255,0.06)", color: "#9a9590" },
};

function ageLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

function wordCount(s: string): number {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

export function ReviewsPanel({
  desktop,
  restoreJobId,
  onJobIdChange,
  onToast,
  onError,
}: Props) {
  const [filter, setFilter] = useState<Filter>("pending");
  const [jobs, setJobs] = useState<ReviewReplyJobRow[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(restoreJobId || null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [signOff, setSignOff] = useState(true);

  const selected = useMemo(
    () => jobs.find((j) => j.id === selectedId) || null,
    [jobs, selectedId],
  );

  const load = useCallback(
    async (status: Filter, preferId?: string | null) => {
      setLoading(true);
      try {
        const [listRes, pendingRes] = await Promise.all([
          pmGet<{ jobs: ReviewReplyJobRow[] }>("review_replies", { status }),
          status === "pending"
            ? Promise.resolve(null)
            : pmGet<{ jobs: ReviewReplyJobRow[] }>("review_replies", {
                status: "pending",
              }),
        ]);
        const list = listRes.jobs || [];
        setJobs(list);
        setPendingCount(
          status === "pending" ? list.length : pendingRes?.jobs?.length || 0,
        );
        const pick =
          (preferId && list.find((j) => j.id === preferId)?.id) ||
          list[0]?.id ||
          null;
        setSelectedId(pick);
        onJobIdChange?.(pick);
      } catch (e) {
        onError(e instanceof Error ? e.message : "Failed to load reviews.");
      } finally {
        setLoading(false);
      }
    },
    [onError, onJobIdChange],
  );

  useEffect(() => {
    void load(filter, restoreJobId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    if (!selected) {
      setDraft("");
      return;
    }
    setDraft(selected.edited_reply || selected.draft_reply || "");
    setSignOff(selected.sign_off !== false);
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const openJob = (id: string) => {
    setSelectedId(id);
    onJobIdChange?.(id);
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      const res = await pmPost<{ drafted: number; synced: number }>(
        "review_replies",
        { op: "process" },
      );
      onToast(
        `Synced ${res.synced || 0} · drafted ${res.drafted || 0}`,
      );
      await load(filter);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  };

  const persistDraft = async () => {
    if (!selected) return;
    if (draft === (selected.edited_reply || selected.draft_reply) && signOff === selected.sign_off) {
      return;
    }
    await pmPost("review_replies", {
      op: "update",
      id: selected.id,
      edited_reply: draft,
      sign_off: signOff,
    });
  };

  const approve = async () => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      await persistDraft();
      const res = await pmPost<{ job: ReviewReplyJobRow }>("review_replies", {
        op: "approve",
        id: selected.id,
        reply: draft,
        sign_off: signOff,
      });
      const dry = res.job.dry_run;
      onToast(
        dry
          ? `Dry-run saved · ${selected.guest_first_name}, ${selected.listing_nickname}`
          : `Posted · ${selected.guest_first_name}, ${selected.listing_nickname}`,
      );
      await load(filter);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Approve failed.");
    } finally {
      setBusy(false);
    }
  };

  const hold = async () => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      await persistDraft();
      await pmPost("review_replies", { op: "hold", id: selected.id });
      onToast(`Held · ${selected.guest_first_name}, ${selected.listing_nickname}`);
      await load(filter);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Hold failed.");
    } finally {
      setBusy(false);
    }
  };

  const resume = async () => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      await pmPost("review_replies", {
        op: "update",
        id: selected.id,
        status: "pending",
      });
      setFilter("pending");
      onToast("Moved to Needs approval");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Resume failed.");
    } finally {
      setBusy(false);
    }
  };

  const toggleFiled = async () => {
    if (!selected) return;
    try {
      const res = await pmPost<{ job: ReviewReplyJobRow }>("review_replies", {
        op: "update",
        id: selected.id,
        removal_filed: !selected.removal_filed,
      });
      setJobs((prev) => prev.map((j) => (j.id === res.job.id ? { ...j, ...res.job } : j)));
    } catch (e) {
      onError(e instanceof Error ? e.message : "Update failed.");
    }
  };

  const setOutcome = async (outcome: string) => {
    if (!selected) return;
    try {
      const res = await pmPost<{ job: ReviewReplyJobRow }>("review_replies", {
        op: "update",
        id: selected.id,
        removal_outcome: outcome,
        removal_filed: true,
      });
      setJobs((prev) => prev.map((j) => (j.id === res.job.id ? { ...j, ...res.job } : j)));
    } catch (e) {
      onError(e instanceof Error ? e.message : "Update failed.");
    }
  };

  const copyPacket = async () => {
    const p = selected?.removal_packet_json;
    if (!p) return;
    const text = `${p.summary}\n\n${(p.evidence || [])
      .map((e) => `• ${e.t} — ${e.text}`)
      .join("\n")}`;
    try {
      await navigator.clipboard.writeText(text);
      onToast("Packet copied");
    } catch {
      onError("Could not copy packet.");
    }
  };

  const charCount =
    draft.length + (signOff && !/— The MRG team\s*$/.test(draft) ? "\n\n— The MRG team".length : 0);

  const claims = selected?.decision_json?.claims || [];
  const showFacts =
    selected &&
    (selected.class === "B" ||
      selected.class === "C" ||
      selected.class === "D" ||
      claims.length > 0);
  const showRemoval = Boolean(selected?.removal_packet_json);
  const actionable = selected && selected.status !== "posted";
  const starColor =
    selected && selected.stars != null && selected.stars <= 3
      ? "#cf7f7b"
      : "#c4a35a";

  const filterBar = (
    <div className="flex gap-0.5 rounded-[9px] border border-white/8 bg-[#141414] p-0.5">
      {FILTERS.map((f) => {
        const active = filter === f.id;
        const showBadge = f.id === "pending" && pendingCount > 0;
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[7px] px-2 py-1.5 text-xs ${
              active
                ? "bg-[#262626] font-bold text-[#f5f5f5]"
                : "font-medium text-[#9a9590]"
            } ${f.id === "pending" ? "flex-[1.6]" : ""}`}
          >
            <span>{f.label}</span>
            {showBadge ? (
              <span className="min-w-[18px] rounded-full bg-[#c4a35a] px-1.5 py-px text-center text-[10.5px] font-bold text-[#0a0a0a]">
                {pendingCount}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );

  const rowList = (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {loading ? (
        <div className="px-4 py-10 text-center text-[13.5px] text-[#6f6a65]">
          Loading…
        </div>
      ) : jobs.length === 0 ? (
        <div className="px-4 py-12 text-center text-[13.5px] text-[#6f6a65]">
          {EMPTY[filter]}
        </div>
      ) : (
        jobs.map((j) => {
          const active = j.id === selectedId;
          const danger = Boolean(j.removal_packet_json) || (j.stars != null && j.stars <= 2);
          const gold = !danger && j.stars === 3;
          return (
            <button
              key={j.id}
              type="button"
              onClick={() => openJob(j.id)}
              className={`flex items-center gap-2.5 border-t border-white/8 py-3 pl-2.5 pr-4 text-left ${
                active ? "bg-[#171717] shadow-[inset_2px_0_0_#c4a35a]" : "hover:bg-[#101010]"
              }`}
            >
              <div className="flex w-1.5 justify-center">
                {danger ? (
                  <span className="h-[5px] w-[5px] rounded-full bg-[#cf7f7b]" />
                ) : gold ? (
                  <span className="h-[5px] w-[5px] rounded-full bg-[#c4a35a]" />
                ) : null}
              </div>
              <div className="flex w-8 shrink-0 items-baseline gap-px text-[14px] font-bold tabular-nums">
                {j.stars ?? "—"}
                <span className="text-[10.5px] text-[#6f6a65]">★</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold">
                  {j.listing_nickname || "Listing"}
                </div>
                <div className="text-[12px] text-[#9a9590]">
                  {j.guest_first_name || "Guest"}
                </div>
              </div>
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border border-white/10 font-mono text-[10.5px] text-[#9a9590]">
                {j.class}
              </div>
              <div className="w-7 shrink-0 text-right font-mono text-[11px] text-[#6f6a65]">
                {ageLabel(j.reviewed_at || j.created_at)}
              </div>
            </button>
          );
        })
      )}
    </div>
  );

  const detailBody = selected ? (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="crm-scroll-pane min-h-0 flex-1 overflow-y-auto px-4 py-5 lg:px-10 lg:py-7">
        <div className="mx-auto flex max-w-[720px] flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#9a9590]">
            <span className="font-bold text-[#f5f5f5]">
              {selected.stars ?? "—"}
              <span style={{ color: starColor }}>★</span>
            </span>
            <span className="text-[#4f4b47]">·</span>
            <span className="font-semibold text-[#f5f5f5]">
              {selected.listing_nickname}
            </span>
            <span className="text-[#4f4b47]">·</span>
            <span>{selected.guest_first_name || "Guest"}</span>
            <span className="text-[#4f4b47]">·</span>
            <span>Airbnb</span>
            <span className="text-[#4f4b47]">·</span>
            <span>{ageLabel(selected.reviewed_at || selected.created_at)} ago</span>
            <span
              className={`ml-auto font-mono text-[11px] ${
                selected.class === "E" ? "text-[#cf7f7b]" : "text-[#6f6a65]"
              }`}
            >
              Class {selected.class}
            </span>
          </div>

          {selected.public_review ? (
            <p className="text-[16px] leading-relaxed text-[#d8d3cd] lg:text-[17px]">
              “{selected.public_review}”
            </p>
          ) : (
            <p className="text-[14px] text-[#6f6a65]">No written review.</p>
          )}

          {selected.reason_for_escalation && selected.confidence === "low" ? (
            <p className="rounded-lg border border-[#cf7f7b]/40 bg-[#cf7f7b]/10 px-3 py-2 text-[13px] text-[#e09a96]">
              {selected.reason_for_escalation}
            </p>
          ) : null}

          {showFacts ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <div className="text-[13px] font-bold">Fact sheet</div>
              </div>
              <div className="overflow-hidden rounded-xl border border-white/8">
                {claims.length === 0 ? (
                  <div className="px-3.5 py-3 text-[13px] text-[#6f6a65]">
                    No claims extracted yet.
                  </div>
                ) : (
                  claims.map((c, i) => {
                    const chip = CHIP[c.rating] || CHIP.Unverifiable;
                    return (
                      <div
                        key={`${c.claim}-${i}`}
                        className={`flex flex-col gap-1 px-3.5 py-2.5 ${
                          i ? "border-t border-white/[0.07]" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2.5">
                          <div className="text-[14px] font-semibold tracking-tight">
                            {c.claim}
                          </div>
                          <span
                            className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold"
                            style={{ background: chip.bg, color: chip.color }}
                          >
                            {c.rating}
                          </span>
                        </div>
                        {c.evidence ? (
                          <div className="font-mono text-[11px] leading-snug text-[#9a9590]">
                            {c.evidence}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
              <div className="text-[13px] font-bold">
                {showRemoval ? "Your public reply" : "Your reply"}
              </div>
              <div className="text-[12px] text-[#6f6a65]">
                {selected.status === "posted"
                  ? "Posted"
                  : showFacts
                    ? `Calm · factual · ${wordCount(draft)} words`
                    : showRemoval
                      ? "Posts regardless of removal"
                      : "Tap to edit"}
              </div>
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 1000))}
              readOnly={selected.status === "posted"}
              rows={desktop ? 10 : 8}
              className="w-full resize-none rounded-xl border border-white/10 bg-[#141414] px-4 py-4 text-[15px] leading-relaxed text-[#f5f5f5] outline-none focus:border-[#c4a35a]/55 disabled:opacity-70"
            />
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSignOff((v) => !v)}
                disabled={selected.status === "posted"}
                className="flex items-center gap-2 text-[12.5px] text-[#9a9590]"
              >
                <span
                  className="flex h-[15px] w-[26px] rounded-full p-0.5"
                  style={{
                    background: signOff ? "#c4a35a" : "#2e2e2e",
                    justifyContent: signOff ? "flex-end" : "flex-start",
                  }}
                >
                  <span className="h-[11px] w-[11px] rounded-full bg-[#f5f5f5]" />
                </span>
                — The MRG team
              </button>
              <span className="font-mono text-[11px] text-[#6f6a65]">
                {charCount}/1000
              </span>
            </div>
          </div>

          {showRemoval && selected.removal_packet_json ? (
            <div className="flex flex-col overflow-hidden rounded-[14px] border border-[#cf7f7b]/28 bg-[#0f0d0d]">
              <div className="flex flex-col gap-2 px-3.5 pb-3 pt-3.5">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#cf7f7b]">
                    Removal request
                  </div>
                  <div className="text-[11.5px] font-bold text-[#f5f5f5]">
                    {selected.decision_json?.violation?.strength || "Strong"}
                  </div>
                </div>
                <div className="text-[16px] font-bold tracking-tight">
                  {selected.removal_packet_json.violation_label ||
                    selected.decision_json?.violation?.type ||
                    "Policy"}
                </div>
              </div>
              <div className="flex flex-col gap-2.5 border-t border-white/[0.07] px-3.5 py-3">
                <div className="flex items-baseline justify-between">
                  <div className="text-[12px] font-bold text-[#9a9590]">
                    Packet · {wordCount(selected.removal_packet_json.summary)} words
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyPacket()}
                    className="text-[12px] font-semibold text-[#c4a35a]"
                  >
                    Copy packet
                  </button>
                </div>
                <p className="text-[13px] leading-relaxed text-[#d8d3cd]">
                  {selected.removal_packet_json.summary}
                </p>
                <div className="flex flex-col gap-1.5">
                  {(selected.removal_packet_json.evidence || []).map((e, i) => (
                    <div
                      key={`${e.t}-${i}`}
                      className="grid grid-cols-[92px_minmax(0,1fr)] gap-2 text-[12px] leading-snug"
                    >
                      <div className="pt-px font-mono text-[11px] text-[#6f6a65]">
                        {e.t}
                      </div>
                      <div className="text-[#d8d3cd]">{e.text}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2.5 border-t border-white/[0.07] px-3.5 py-3.5">
                <button
                  type="button"
                  onClick={() => void toggleFiled()}
                  className="flex min-h-7 items-center gap-2.5"
                >
                  <span
                    className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border text-[12px] font-extrabold text-[#0a0a0a]"
                    style={{
                      borderColor: selected.removal_filed
                        ? "#c4a35a"
                        : "rgba(255,255,255,0.2)",
                      background: selected.removal_filed ? "#c4a35a" : "transparent",
                    }}
                  >
                    {selected.removal_filed ? "✓" : ""}
                  </span>
                  <span className="text-[13.5px] font-semibold">Filed in Airbnb</span>
                  {selected.removal_filed_at ? (
                    <span className="ml-auto font-mono text-[10.5px] text-[#6f6a65]">
                      {ageLabel(selected.removal_filed_at)} ago
                    </span>
                  ) : null}
                </button>
                <div
                  className={`flex gap-0.5 rounded-[9px] border border-white/8 bg-[#141414] p-0.5 ${
                    selected.removal_filed ? "" : "opacity-40"
                  }`}
                >
                  {(["Pending", "Removed", "Declined"] as const).map((o) => {
                    const active =
                      (selected.removal_outcome || "Pending") === o;
                    return (
                      <button
                        key={o}
                        type="button"
                        disabled={!selected.removal_filed}
                        onClick={() => void setOutcome(o)}
                        className={`flex-1 rounded-[7px] px-2 py-1.5 text-center text-xs ${
                          active
                            ? "bg-[#262626] font-bold text-[#f5f5f5]"
                            : "font-medium text-[#9a9590]"
                        }`}
                      >
                        {o}
                      </button>
                    );
                  })}
                </div>
                <div className="text-[11.5px] text-[#6f6a65]">
                  You file in Airbnb. This only tracks the outcome.
                </div>
              </div>
            </div>
          ) : null}

          {selected.dry_run ? (
            <p className="text-[12px] text-[#6f6a65]">
              Dry-run is on — Approve saves the reply locally and does not post to Airbnb
              yet. Set REVIEW_REPLY_DRY_RUN=false when ready.
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2.5 border-t border-white/8 bg-[#0a0a0a] px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:justify-end lg:px-10 lg:py-3.5">
        {selected.status === "posted" ? (
          <div className="flex h-[52px] items-center gap-2.5 lg:h-[42px]">
            <span className="h-[7px] w-[7px] rounded-full bg-[#4ea882]" />
            <span className="text-[15px] font-semibold text-[#4ea882] lg:text-[13.5px]">
              Posted to Airbnb
            </span>
          </div>
        ) : selected.status === "held" ? (
          <>
            <button
              type="button"
              onClick={() => void resume()}
              disabled={busy}
              className="flex h-[52px] flex-1 items-center justify-center rounded-xl border border-white/12 bg-[#141414] text-[15px] font-semibold lg:h-[42px] lg:flex-none lg:px-5 lg:text-[13.5px]"
            >
              Resume
            </button>
            <GoldButton
              className="h-[52px] flex-[2.2] lg:h-[42px] lg:flex-none lg:px-6"
              disabled={busy}
              onClick={() => void approve()}
            >
              Approve & post
            </GoldButton>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void hold()}
              disabled={busy}
              className="flex h-[52px] flex-1 items-center justify-center rounded-xl border border-white/12 bg-[#141414] text-[15px] font-semibold lg:h-[42px] lg:flex-none lg:px-5 lg:text-[13.5px]"
            >
              Hold
            </button>
            <GoldButton
              className="h-[52px] flex-[2.2] lg:h-[42px] lg:flex-none lg:px-6"
              disabled={busy || !actionable}
              onClick={() => void approve()}
            >
              Approve & post
            </GoldButton>
          </>
        )}
      </div>
    </div>
  ) : (
    <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-6">
      <div className="text-[16px] font-semibold">All caught up</div>
      <div className="text-[13.5px] text-[#6f6a65]">
        New reviews land here as guests post them.
      </div>
    </div>
  );

  if (!desktop) {
    if (selectedId && selected) {
      return (
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-white/8 px-4">
            <button
              type="button"
              onClick={() => {
                setSelectedId(null);
                onJobIdChange?.(null);
              }}
              className="text-[14px] font-semibold text-[#9a9590]"
            >
              ‹ Reviews
            </button>
            <span className="font-mono text-[11px] text-[#6f6a65]">
              {jobs.findIndex((j) => j.id === selectedId) + 1} of {jobs.length || 1}
            </span>
          </div>
          {detailBody}
        </div>
      );
    }
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 flex-col gap-3.5 px-4 pb-3.5 pt-[18px]">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight">Reviews</h1>
            <button
              type="button"
              onClick={() => void syncNow()}
              className="text-[12px] text-[#9a9590]"
            >
              {syncing ? "Syncing…" : "Refresh"}
            </button>
          </div>
          {filterBar}
        </div>
        {rowList}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="flex w-[400px] shrink-0 flex-col border-r border-white/8">
        <div className="flex shrink-0 flex-col gap-3.5 px-[18px] pb-3.5 pt-5">
          <div className="flex items-center justify-between">
            <h1 className="text-[22px] font-bold tracking-tight">Reviews</h1>
            <button
              type="button"
              onClick={() => void syncNow()}
              className="text-[12px] text-[#9a9590]"
            >
              {syncing ? "Syncing…" : "Refresh"}
            </button>
          </div>
          {filterBar}
        </div>
        {rowList}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">{detailBody}</div>
    </div>
  );
}
