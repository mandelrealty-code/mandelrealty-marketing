import { useEffect, useState } from "react";
import { Icon } from "../clients/icons";
import { ConfirmModal, ErrorBanner } from "../clients/uiBits";
import { RedactorFrame } from "./SopsFrames";
import {
  EDITOR_CATEGORIES,
  ROLE_OPTIONS,
  fmtDraftTime,
  newStep,
  renumber,
  type SopCategory,
  type SopItem,
  type SopStep,
  type SopTargetRole,
} from "./sopsBits";

type Props = {
  phone?: boolean;
  sop: SopItem;
  onChange: (next: SopItem) => void;
  /** True when there are edits since the editor opened (drives the "Close without saving?" confirm). */
  dirty: boolean;
  /** Last time the local draft was written. */
  draftSavedAt: Date | null;
  saving: boolean;
  /** Screenshot upload progress while publishing. */
  progress: { done: number; total: number } | null;
  /** Save / delete failure to show inside the panel (the old panel used alert()). */
  error?: string;
  onDismissError?: () => void;
  onClose: () => void;
  onDiscard: () => void;
  onPublish: () => void;
  onDelete: (sop: SopItem) => void;
  onDownload: () => void;
  /** Same hand-off SopsPanel does: close the editor, open Video Studio with this SOP. */
  onVideoStudio?: () => void;
};

type Extras = { script?: boolean; tip?: boolean; warn?: boolean };

function CloseConfirm({ phone, onCancel, onConfirm }: { phone?: boolean; onCancel: () => void; onConfirm: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  const title = "Close without saving?";
  const body = phone
    ? "You have unsaved changes. These edits will be lost."
    : "You have unsaved changes. Your last draft is kept, but these edits will be lost.";
  return (
    <div className={`scrim${phone ? " bottom" : ""} sp-scrim-top`} style={{ position: "fixed" }} onClick={onCancel}>
      {phone ? (
        <div className="sheet frost" onClick={(e) => e.stopPropagation()}>
          <h2 style={{ fontSize: 18, fontWeight: 650 }}>{title}</h2>
          <p className="lede" style={{ fontSize: "var(--t-sm)", margin: "6px 0 16px" }}>
            {body}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button type="button" className="btn primary" style={{ height: 48 }} onClick={onConfirm}>
              Close anyway
            </button>
            <button type="button" className="btn" style={{ height: 48 }} onClick={onCancel}>
              Keep editing
            </button>
          </div>
        </div>
      ) : (
        <div className="modal frost" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
          <h2>{title}</h2>
          <p className="lede">{body}</p>
          <div className="mfoot">
            <button type="button" className="btn" onClick={onCancel}>
              Keep editing
            </button>
            <button type="button" className="btn primary" onClick={onConfirm}>
              Close anyway
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SopsEditor(p: Props) {
  const { sop, phone, saving } = p;
  const [redactorIdx, setRedactorIdx] = useState<number | null>(null);
  const [extras, setExtras] = useState<Record<string, Extras>>({});
  const [confirm, setConfirm] = useState<null | "close" | "delete">(null);

  const isNew = !sop.id;
  const steps = sop.steps || [];
  const canPublish = sop.title.trim().length > 0 && !saving;

  const requestClose = () => {
    if (saving) return;
    if (p.dirty) setConfirm("close");
    else p.onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || redactorIdx !== null || confirm) return;
      requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redactorIdx, confirm, p.dirty, saving]);

  const updateStep = (idx: number, updates: Partial<SopStep>) => {
    const next = [...steps];
    next[idx] = { ...next[idx], ...updates };
    p.onChange({ ...sop, steps: next });
  };

  const addStep = () => {
    p.onChange({ ...sop, steps: renumber([...steps, newStep(steps.length + 1)]) });
  };

  const deleteStepAt = (idx: number) => {
    p.onChange({ ...sop, steps: renumber(steps.filter((_, i) => i !== idx)) });
  };

  const openExtra = (step: SopStep, key: keyof Extras) => {
    setExtras((prev) => ({ ...prev, [step.id]: { ...prev[step.id], [key]: true } }));
  };
  const closeExtra = (idx: number, step: SopStep, key: keyof Extras) => {
    setExtras((prev) => ({ ...prev, [step.id]: { ...prev[step.id], [key]: false } }));
    if (key === "script") updateStep(idx, { copy_snippets: undefined });
    else if (key === "tip") updateStep(idx, { pro_tip: undefined });
    else updateStep(idx, { warning: undefined });
  };

  const activeStep = redactorIdx !== null ? steps[redactorIdx] : undefined;

  const videoBtn = p.onVideoStudio ? (
    phone ? (
      <button type="button" className="iconbtn bd" aria-label="Video Studio" disabled={saving} onClick={p.onVideoStudio}>
        <Icon name="play" className="i sm" />
      </button>
    ) : (
      <button type="button" className="btn sm" disabled={saving} onClick={p.onVideoStudio}>
        <Icon name="play" className="i xs" />
        Video Studio
      </button>
    )
  ) : null;

  const downloadBtn = phone ? (
    <button type="button" className="iconbtn bd" aria-label="Download backup" onClick={p.onDownload}>
      <Icon name="down" className="i sm" />
    </button>
  ) : (
    <button type="button" className="btn sm" onClick={p.onDownload}>
      <Icon name="down" className="i xs" />
      Download backup
    </button>
  );

  return (
    <>
      <div className="scrim sp-scrim" style={{ position: "fixed", justifyContent: "flex-end" }} onClick={requestClose} />
      <div className="sp-panel" role="dialog" aria-label={isNew ? "New SOP" : "Edit SOP"}>
        <div className="ptopbar">
          <button type="button" className="iconbtn" aria-label="Close editor" onClick={requestClose}>
            <Icon name="x" />
          </button>
          <div className="t">
            <b>{isNew ? "New SOP" : "Edit SOP"}</b>
            <span className="meta">
              {p.draftSavedAt ? (
                <>
                  <Icon name="check" className="i xs" /> Draft saved {fmtDraftTime(p.draftSavedAt)}
                </>
              ) : (
                "Not saved yet"
              )}
            </span>
          </div>
          {videoBtn}
          {downloadBtn}
        </div>

        <div className="pbody2">
          {p.error ? <ErrorBanner title={p.error} onDismiss={p.onDismissError} /> : null}
          <div className="card">
            <div className="cardbody">
              <div className="fgrid sp-details">
                <div className="field sp-title">
                  <label htmlFor="sop-title">Title</label>
                  <input
                    id="sop-title"
                    className="input"
                    value={sop.title}
                    placeholder="Title"
                    disabled={saving}
                    onChange={(e) => p.onChange({ ...sop, title: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="sop-cat">Category</label>
                  <select
                    id="sop-cat"
                    className="input"
                    value={sop.category}
                    disabled={saving}
                    onChange={(e) => p.onChange({ ...sop, category: e.target.value as SopCategory })}
                  >
                    {EDITOR_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                    {/* A guide made in Video Studio can be Maintenance; keep it selectable so it isn't rewritten. */}
                    {sop.category === "maintenance" ? <option value="maintenance">Maintenance</option> : null}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="sop-role">Target role</label>
                  <select
                    id="sop-role"
                    className="input"
                    value={sop.target_role}
                    disabled={saving}
                    onChange={(e) => p.onChange({ ...sop, target_role: e.target.value as SopTargetRole })}
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="sop-min">Est. minutes</label>
                  <input
                    id="sop-min"
                    className="input"
                    type="number"
                    value={sop.estimated_minutes}
                    disabled={saving}
                    onChange={(e) => p.onChange({ ...sop, estimated_minutes: parseInt(e.target.value) || 15 })}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flabel" style={{ margin: "4px 0 -6px" }}>
            Steps <span className="meta">· {steps.length}</span>
          </div>

          {steps.length === 0 ? (
            <div className="card">
              <div className="empty" style={{ padding: "30px 16px" }}>
                <span className="eic">
                  <Icon name="text" />
                </span>
                <b style={{ fontSize: "var(--t-sm)" }}>No steps yet</b>
                <span className="meta">Add the first step: a title, instructions and a screenshot.</span>
              </div>
            </div>
          ) : (
            steps.map((step, idx) => {
              const ex = extras[step.id] || {};
              const script = step.copy_snippets?.[0]?.template ?? "";
              const showScript = Boolean(script) || ex.script;
              const showTip = Boolean(step.pro_tip) || ex.tip;
              const showWarn = Boolean(step.warning) || ex.warn;
              return (
                <div key={step.id || idx} className="step">
                  <div className="steph">
                    <span className="stepn">{step.step_number || idx + 1}</span>
                    <input
                      className="input"
                      style={{ height: 36, fontWeight: 600 }}
                      value={step.title}
                      placeholder="Step title"
                      aria-label={`Step ${idx + 1} title`}
                      disabled={saving}
                      onChange={(e) => updateStep(idx, { title: e.target.value })}
                    />
                    <button
                      type="button"
                      className="iconbtn"
                      title="Delete Step"
                      aria-label="Delete Step"
                      disabled={saving}
                      onClick={() => deleteStepAt(idx)}
                    >
                      <Icon name="trash" className="i sm" />
                    </button>
                  </div>
                  <div className="stepb">
                    <textarea
                      className="input"
                      style={{ minHeight: 56 }}
                      value={step.description}
                      placeholder="Instructions for this step…"
                      aria-label={`Step ${idx + 1} instructions`}
                      disabled={saving}
                      onChange={(e) => updateStep(idx, { description: e.target.value })}
                    />

                    {step.image_url ? (
                      <div className="shot">
                        <img src={step.image_url} alt={step.title || `Step ${idx + 1} screenshot`} />
                        <button type="button" className="btn sm ov" disabled={saving} onClick={() => setRedactorIdx(idx)}>
                          <Icon name="edit" className="i xs" />
                          Edit in Redactor
                        </button>
                      </div>
                    ) : (
                      <button type="button" className="drop sp-drop" disabled={saving} onClick={() => setRedactorIdx(idx)}>
                        <Icon name="img" className="i sm" />
                        <b>Add screenshot</b>
                        <span className="meta">Opens the Redactor</span>
                      </button>
                    )}

                    {showScript ? (
                      <div className="xbox script">
                        <div className="xh">
                          <Icon name="text" className="i xs" />
                          <span>Script</span>
                          <span className="meta">Tags: {"{host_name}"} {"{property_address}"}</span>
                          <button type="button" className="xclose" aria-label="Remove script" disabled={saving} onClick={() => closeExtra(idx, step, "script")}>
                            <Icon name="x" className="i xs" />
                          </button>
                        </div>
                        <textarea
                          rows={3}
                          value={script}
                          placeholder="Type script template here with {host_name} tags…"
                          aria-label={`Step ${idx + 1} script`}
                          disabled={saving}
                          onChange={(e) =>
                            updateStep(idx, {
                              copy_snippets: [{ id: `cs-${idx}`, title: "Script", template: e.target.value }],
                            })
                          }
                        />
                      </div>
                    ) : null}
                    {showTip ? (
                      <div className="xbox tip">
                        <div className="xh">
                          <Icon name="spark" className="i xs" />
                          <span>Pro tip</span>
                          <button type="button" className="xclose" aria-label="Remove pro tip" disabled={saving} onClick={() => closeExtra(idx, step, "tip")}>
                            <Icon name="x" className="i xs" />
                          </button>
                        </div>
                        <input
                          value={step.pro_tip || ""}
                          placeholder="Pro tip (optional)…"
                          aria-label={`Step ${idx + 1} pro tip`}
                          disabled={saving}
                          onChange={(e) => updateStep(idx, { pro_tip: e.target.value })}
                        />
                      </div>
                    ) : null}
                    {showWarn ? (
                      <div className="xbox warn">
                        <div className="xh">
                          <Icon name="alert" className="i xs" />
                          <span>Warning</span>
                          <button type="button" className="xclose" aria-label="Remove warning" disabled={saving} onClick={() => closeExtra(idx, step, "warn")}>
                            <Icon name="x" className="i xs" />
                          </button>
                        </div>
                        <input
                          value={step.warning || ""}
                          placeholder="Never / Warning (optional)…"
                          aria-label={`Step ${idx + 1} warning`}
                          disabled={saving}
                          onChange={(e) => updateStep(idx, { warning: e.target.value })}
                        />
                      </div>
                    ) : null}

                    {showScript && showTip && showWarn ? null : (
                      <div className="addx">
                        {showScript ? null : (
                          <button type="button" className="btn" disabled={saving} onClick={() => openExtra(step, "script")}>
                            <Icon name="plus" className="i xs" />
                            Script
                          </button>
                        )}
                        {showTip ? null : (
                          <button type="button" className="btn" disabled={saving} onClick={() => openExtra(step, "tip")}>
                            <Icon name="plus" className="i xs" />
                            Pro tip
                          </button>
                        )}
                        {showWarn ? null : (
                          <button type="button" className="btn" disabled={saving} onClick={() => openExtra(step, "warn")}>
                            <Icon name="plus" className="i xs" />
                            Warning
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          <button type="button" className="btn sp-addstep" disabled={saving} onClick={addStep}>
            <Icon name="plus" className="i sm" />
            Add Step
          </button>
          {sop.title.trim() ? null : (
            <div className="hint">Publish turns on once there’s a title. Publishing makes the public link live.</div>
          )}
        </div>

        <div className="pfoot">
          <button type="button" className="btn ghost sp-del" disabled={saving} onClick={() => setConfirm("delete")}>
            <Icon name="trash" className="i sm" />
            Delete Guide
          </button>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn" disabled={saving} onClick={p.onDiscard}>
            Discard Changes
          </button>
          <button type="button" className="btn primary sp-publish" disabled={!canPublish} onClick={p.onPublish}>
            {saving ? (
              <>
                <i className="spin sp-spin-on-dark" />
                {p.progress && p.progress.total > 0
                  ? `Uploading screenshots… ${Math.min(p.progress.done + 1, p.progress.total)} of ${p.progress.total}`
                  : "Publishing…"}
              </>
            ) : (
              <>
                <Icon name="up" className="i sm" />
                Publish SOP
              </>
            )}
          </button>
        </div>
      </div>

      {confirm === "close" ? (
        <CloseConfirm
          phone={phone}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null);
            p.onClose();
          }}
        />
      ) : null}
      {confirm === "delete" ? (
        <ConfirmModal
          phone={phone}
          title="Delete this guide?"
          body={
            phone
              ? "The guide and its public link are removed."
              : `${sop.title.trim() || "This guide"} and its public link are removed. It can’t be undone.`
          }
          confirmLabel="Delete Guide"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null);
            p.onDelete(sop);
          }}
        />
      ) : null}

      {redactorIdx !== null && activeStep ? (
        <RedactorFrame
          isOpen={true}
          initialImageUrl={activeStep.image_url}
          rawImageUrl={activeStep.raw_image_url}
          initialBoxes={activeStep.boxes}
          initialPins={activeStep.pins}
          onClose={() => setRedactorIdx(null)}
          onSave={(bakedDataUrl, boxes, pins, rawImageUrl) => {
            updateStep(redactorIdx, {
              image_url: bakedDataUrl,
              raw_image_url: rawImageUrl || activeStep.raw_image_url || bakedDataUrl,
              boxes,
              pins,
            });
            setRedactorIdx(null);
          }}
        />
      ) : null}
    </>
  );
}
