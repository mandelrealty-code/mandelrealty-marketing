import { useEffect, useMemo, useState } from "react";
import type { ReviewFact, ReviewQueueRow } from "../../../shared/copilot/reviewTypes";

type Local = {
  draft: string;
  previous: string;
  source: string;
  showPrev: boolean;
  editing: boolean;
  working: boolean;
  status: "" | "posted" | "skipped" | "posting";
  error: string;
  dispute: string;
  facts: ReviewFact[];
  factsOpen: boolean;
  postedAt: string;
};

function stars(n: number) {
  return { filled: "★".repeat(n), empty: "★".repeat(Math.max(0, 5 - n)), label: n === 1 ? "1 star" : `${n} stars` };
}

function summary(waiting: number, care: number, property: string) {
  const where = property ? ` at ${property}` : "";
  if (waiting === 0) return `No reviews waiting${where}.`;
  const nWord = waiting === 1 ? "1 review waiting" : `${waiting} reviews waiting`;
  const careWord = care === 0 ? "None need care." : care === 1 ? "1 needs care." : `${care} need care.`;
  return `${nWord}${where}. ${careWord}`;
}

export function ReviewsQueue({
  rows,
  postedToday = [],
  disconnected = "",
  loading = false,
  onRegenerate,
  onSubmit,
  onPrepare,
  onSkip,
  onUndo,
}: {
  rows: ReviewQueueRow[];
  postedToday?: { text: string; at: string }[];
  disconnected?: string;
  loading?: boolean;
  onRegenerate?: (row: ReviewQueueRow, current: string) => Promise<{ draft: string; previous: string; sourceLine: string; dispute: string; facts: ReviewFact[]; error: string }>;
  onSubmit?: (row: ReviewQueueRow, text: string) => Promise<void>;
  onPrepare?: (row: ReviewQueueRow) => Promise<{ dispute: string; facts: ReviewFact[]; error: string }>;
  onSkip?: (row: ReviewQueueRow) => Promise<void>;
  onUndo?: (row: ReviewQueueRow) => Promise<void>;
}) {
  const [local, setLocal] = useState<Record<string, Local>>({});
  const [filter, setFilter] = useState("all");
  const [shown, setShown] = useState(10);

  useEffect(() => {
    setLocal((prev) => {
      const next = { ...prev };
      for (const row of rows) {
        if (!next[row.id]) {
          next[row.id] = {
            draft: row.draft,
            previous: row.previous ?? "",
            source: row.sourceLine ?? "",
            showPrev: false,
            editing: false,
            working: false,
            status: "",
            error: "",
            dispute: row.dispute,
            facts: row.facts,
            factsOpen: false,
            postedAt: "",
          };
        }
      }
      return next;
    });
  }, [rows]);

  const properties = useMemo(() => {
    const names = new Map<string, string>();
    for (const row of rows) names.set(row.propertyId, row.property);
    return [...names.entries()].map(([id, name]) => ({ id, name }));
  }, [rows]);

  function stateOf(row: ReviewQueueRow): Local {
    return local[row.id] ?? {
      draft: row.draft, previous: "", source: "", showPrev: false, editing: false, working: false,
      status: "", error: "", dispute: row.dispute, facts: row.facts, factsOpen: false, postedAt: "",
    };
  }

  function waitingCount(propertyId: string) {
    return rows.filter((row) => (propertyId === "all" || row.propertyId === propertyId) && stateOf(row).status === "").length;
  }

  const visible = rows.filter((row) => filter === "all" || row.propertyId === filter);
  const page = visible.slice(0, shown);
  const waiting = waitingCount(filter);
  const care = visible.filter((row) => stateOf(row).status === "" && stateOf(row).dispute).length;
  const propertyName = filter === "all" ? "" : properties.find((item) => item.id === filter)?.name || "";
  const rest = Math.max(0, visible.length - page.length);

  function nextOpen(currentId: string) {
    const index = visible.findIndex((row) => row.id === currentId);
    return visible.slice(index + 1).find((row) => stateOf(row).status === "")?.id;
  }

  function focusSubmit(id: string | undefined) {
    if (!id) return;
    window.setTimeout(() => {
      document.querySelector<HTMLButtonElement>(`[data-review-id="${CSS.escape(id)}"]`)?.focus();
    }, 40);
  }

  async function regenerate(row: ReviewQueueRow) {
    const current = stateOf(row);
    if (current.working || !onRegenerate) return;
    setLocal((prev) => ({ ...prev, [row.id]: { ...stateOf(row), working: true, editing: false, showPrev: false, error: "" } }));
    try {
      const result = await onRegenerate(row, current.draft);
      setLocal((prev) => ({
        ...prev,
        [row.id]: {
          ...stateOf(row),
          working: false,
          draft: result.error ? current.draft : result.draft,
          previous: result.error ? current.previous : result.previous || current.draft,
          source: result.error ? "" : result.sourceLine,
          error: result.error,
          dispute: result.dispute || current.dispute,
          facts: result.facts.length ? result.facts : current.facts,
          showPrev: false,
          editing: false,
        },
      }));
    } catch (err) {
      setLocal((prev) => ({
        ...prev,
        [row.id]: { ...stateOf(row), working: false, error: err instanceof Error ? err.message : "Couldn't read Hospitable. Your draft is unchanged." },
      }));
    }
  }

  async function submit(row: ReviewQueueRow) {
    const current = stateOf(row);
    if (current.working || current.status === "posting" || !onSubmit) return;
    setLocal((prev) => ({ ...prev, [row.id]: { ...current, status: "posting", error: "" } }));
    try {
      await onSubmit(row, current.draft);
      const time = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" });
      const next = nextOpen(row.id);
      setLocal((prev) => ({ ...prev, [row.id]: { ...current, status: "posted", postedAt: time, error: "" } }));
      focusSubmit(next);
    } catch (err) {
      setLocal((prev) => ({
        ...prev,
        [row.id]: { ...current, status: "", error: err instanceof Error ? err.message : "Couldn't reach Airbnb. Nothing posted." },
      }));
    }
  }

  if (loading) {
    return (
      <div className="cp-rv-page">
        <div className="cp-rv">
          <h1>Reviews</h1>
          <p className="cp-rv-summary">Loading reviews.</p>
        </div>
      </div>
    );
  }

  if (disconnected) {
    return (
      <div className="cp-rv-page">
        <div className="cp-rv">
        <h1>Reviews</h1>
        <p className="cp-rv-summary">Hospitable is not connected.</p>
        <p className="cp-rv-quiet">{disconnected}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cp-rv-page">
    <div className="cp-rv">
      <h1>Reviews</h1>
      <p className="cp-rv-summary">{summary(waiting, care, propertyName)}</p>
      <div className="cp-rv-filters">
        <button type="button" className={filter === "all" ? "on" : ""} onClick={() => { setFilter("all"); setShown(10); }}>
          All properties <span>{waitingCount("all")}</span>
        </button>
        {properties.map((item) => (
          <button key={item.id} type="button" className={filter === item.id ? "on" : ""} onClick={() => { setFilter(item.id); setShown(10); }}>
            {item.name} <span>{waitingCount(item.id)}</span>
          </button>
        ))}
      </div>
      {visible.length > 0 ? (
        <>
          {waiting > 0 ? (
            <div className="cp-rv-legend">
              <strong>Most damaging first</strong>
              <span>Nothing posts until you press Submit</span>
            </div>
          ) : null}
          {page.map((row) => {
            const current = stateOf(row);
            const star = stars(row.stars);
            if (current.status === "posted") {
              return (
                <div key={row.id} className="cp-rv-line">
                  <span>Posted</span>
                  <span>Reply to {row.guest}’s {row.stars}-star review, {row.property}</span>
                  <span>{current.postedAt}</span>
                </div>
              );
            }
            if (current.status === "skipped") {
              return (
                <div key={row.id} className="cp-rv-line">
                  <span>Skipped</span>
                  <span>{row.guest}, {row.property}. Back at the top tomorrow. Nothing posted.</span>
                  <button type="button" onClick={() => { setLocal((prev) => ({ ...prev, [row.id]: { ...current, status: "" } })); void onUndo?.(row); }}>Undo</button>
                </div>
              );
            }
            return (
              <article key={row.id} className="cp-rv-row">
                <div className="cp-rv-who">
                  <div>
                    {row.guestPhoto ? <img src={row.guestPhoto} alt="" /> : <span className="cp-rv-initials">{row.initials}</span>}
                    <span><strong>{row.guest}</strong><em>{row.when}</em></span>
                  </div>
                  <div>
                    {row.propertyPhoto ? <img className="prop" src={row.propertyPhoto} alt="" /> : <span className="cp-rv-tile" aria-hidden />}
                    <span>{row.property}</span>
                  </div>
                </div>
                <div className="cp-rv-body">
                  <div className="cp-rv-stars">
                    <span aria-label={star.label}><i>{star.filled}</i><b>{star.empty}</b></span>
                    <em>{star.label}</em>
                  </div>
                  <p>{row.review}</p>
                  {current.dispute ? (
                    <p className="cp-rv-flag"><i /> <strong>Possible dispute</strong> <span>{current.dispute}</span></p>
                  ) : null}
                  <div className="cp-rv-draft">
                    <span>Draft reply</span>
                    {current.editing ? (
                      <textarea aria-label="Draft reply" rows={6} value={current.draft} onChange={(event) => setLocal((prev) => ({ ...prev, [row.id]: { ...current, draft: event.target.value } }))} />
                    ) : (
                      <div className={current.working ? "dim" : ""} aria-busy={current.working}>{current.draft}</div>
                    )}
                    {current.working ? <p role="status">Reading the conversation, the reservation and the Knowledge Hub for this stay…</p> : null}
                    {current.source && !current.working && !current.editing ? (
                      <div className="cp-rv-source">
                        <span>{current.source}</span>
                        {current.previous ? (
                          <button type="button" aria-expanded={current.showPrev} onClick={() => setLocal((prev) => ({ ...prev, [row.id]: { ...current, showPrev: !current.showPrev } }))}>
                            {current.showPrev ? "Hide previous draft" : "Previous draft"}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    {current.showPrev && current.previous ? (
                      <div className="cp-rv-prev">
                        <span>Previous draft</span>
                        <p>{current.previous}</p>
                        <button type="button" onClick={() => setLocal((prev) => ({ ...prev, [row.id]: { ...current, draft: current.previous, previous: current.draft, showPrev: false } }))}>Use this draft instead</button>
                      </div>
                    ) : null}
                  </div>
                  <div className="cp-rv-actions">
                    <button type="button" className="submit" data-review-id={row.id} disabled={current.working || current.status === "posting"} onClick={() => void submit(row)}>{current.status === "posting" ? "Posting…" : "Submit"}</button>
                    <button type="button" disabled={current.working} onClick={() => setLocal((prev) => ({ ...prev, [row.id]: { ...current, editing: !current.editing } }))}>{current.editing ? "Done" : "Edit"}</button>
                    <button type="button" disabled={current.working} onClick={() => void regenerate(row)}>{current.working ? "Reading the conversation…" : "Regenerate with AI"}</button>
                    <button type="button" onClick={() => { const next = nextOpen(row.id); setLocal((prev) => ({ ...prev, [row.id]: { ...current, status: "skipped", editing: false, factsOpen: false } })); void onSkip?.(row); focusSubmit(next); }}>Skip for now</button>
                    {current.dispute ? (
                      <div className="cp-rv-dispute">
                        <button type="button" aria-expanded={current.factsOpen} onClick={() => {
                          if (!current.factsOpen && !current.facts.length && onPrepare) {
                            void onPrepare(row).then((result) => {
                              setLocal((prev) => ({ ...prev, [row.id]: { ...stateOf(row), factsOpen: true, dispute: result.dispute || current.dispute, facts: result.facts, error: result.error } }));
                            });
                            return;
                          }
                          setLocal((prev) => ({ ...prev, [row.id]: { ...current, factsOpen: !current.factsOpen } }));
                        }}>Prepare dispute</button>
                      </div>
                    ) : null}
                  </div>
                  <p className="cp-rv-note">Submit posts this reply to Airbnb. Nothing else does.</p>
                  {current.error ? (
                    <p className="cp-rv-fail">
                      {current.error}{" "}
                      {/unchanged|Nothing posted|not connected/i.test(current.error) ? (
                        <button type="button" onClick={() => void (current.error.includes("posted") ? submit(row) : regenerate(row))}>Try again</button>
                      ) : null}
                    </p>
                  ) : null}
                  {current.factsOpen ? (
                    <div className="cp-rv-facts">
                      <div><strong>Dispute facts</strong><button type="button" onClick={() => setLocal((prev) => ({ ...prev, [row.id]: { ...current, factsOpen: false } }))}>Close</button></div>
                      <div className="cp-rv-table">
                        <span>The review says</span><span>Our records show</span><span>Source</span>
                        {current.facts.map((fact) => (
                          <span key={fact.claim} className="cp-rv-fact">
                            <span>{fact.claim}</span>
                            <span>{fact.record}</span>
                            <span>{fact.source}</span>
                          </span>
                        ))}
                      </div>
                      <div>
                        <button type="button" onClick={() => {
                          const text = current.facts.map((fact) => `${fact.claim}\n${fact.record}\n${fact.source}`).join("\n\n");
                          void navigator.clipboard?.writeText(text);
                        }}>Copy facts</button>
                        <span>Nothing is filed from here. You file it in Airbnb’s Resolution Center. The reply above is separate.</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
          <div className="cp-rv-more">
            <span>{rest > 0 ? `${rest} more, in the same order.` : "That’s everything waiting."}</span>
            {rest > 0 ? <button type="button" onClick={() => setShown((count) => count + 10)}>Show next 10</button> : null}
          </div>
        </>
      ) : (
        <>
          <div className="cp-rv-empty">
            <p>All caught up. Every Airbnb review has a reply.</p>
            <p>New reviews without a reply land here with a draft ready, usually within an hour of posting.</p>
          </div>
          {postedToday.length ? <h2>Posted today</h2> : null}
          {postedToday.map((line) => (
            <div key={line.text} className="cp-rv-line">
              <span>Posted</span>
              <span>{line.text}</span>
              <span>{line.at}</span>
            </div>
          ))}
        </>
      )}
    </div>
    </div>
  );
}
