import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Icon } from "../clients/icons";
import { Chip, formatHeadDate } from "../clients/uiBits";
import {
  CATS,
  categoryLabel,
  fmtUpdated,
  isVideoSop,
  ROLE_TONE,
  roleLabel,
  videoMarker,
  type SopItem,
} from "./sopsBits";

type ListProps = {
  phone?: boolean;
  loading: boolean;
  banner?: ReactNode;
  sops: SopItem[];
  filtered: SopItem[];
  stats: { total: number; drafts: number };
  selectedCat: string;
  onCat: (id: string) => void;
  query: string;
  onQuery: (q: string) => void;
  copiedSlug: string | null;
  onRecord: () => void;
  onImport: (file: File) => void;
  onNew: () => void;
  onEdit: (sop: SopItem) => void;
  onCopy: (sop: SopItem) => void;
  onDelete: (sop: SopItem) => void;
};

function rowKey(sop: SopItem): string {
  return sop.id || sop.slug;
}

function ImportButton({ onImport, small }: { onImport: (file: File) => void; small?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImport(file);
    e.target.value = "";
  };
  return (
    <>
      <button
        type="button"
        className={`btn${small ? " sm" : ""}`}
        style={small ? { height: 40 } : undefined}
        onClick={() => inputRef.current?.click()}
      >
        <Icon name="import" className={small ? "i xs" : "i sm"} />
        Import backup
      </button>
      <input ref={inputRef} type="file" accept="application/json" hidden onChange={onChange} />
    </>
  );
}

function Counts({ stats }: { stats: { total: number; drafts: number } }) {
  return (
    <span className="meta" style={{ fontSize: "var(--t-sm)" }}>
      {stats.total} published · {stats.drafts} {stats.drafts === 1 ? "draft" : "drafts"}
    </span>
  );
}

function RoleChip({ role }: { role: string }) {
  const [h, c] = ROLE_TONE[role] ?? ROLE_TONE.all;
  return (
    <Chip h={h} c={c}>
      {roleLabel(role)}
    </Chip>
  );
}

function LengthText({ sop }: { sop: SopItem }) {
  const steps = sop.steps?.length || 0;
  return (
    <>
      {sop.estimated_minutes} min{steps ? ` · ${steps} ${steps === 1 ? "step" : "steps"}` : ""}
    </>
  );
}

function VideoTag({ sop }: { sop: SopItem }) {
  const marker = videoMarker(sop);
  if (!marker) return null;
  return (
    <span className="vid">
      <Icon name="play" className="i xs" />
      {marker}
    </span>
  );
}

function CopyButton({ sop, copied, onCopy }: { sop: SopItem; copied: boolean; onCopy: (s: SopItem) => void }) {
  return (
    <button
      type="button"
      className={`btn sm${copied ? " copied" : ""}`}
      style={{ minWidth: 100 }}
      onClick={() => onCopy(sop)}
    >
      {copied ? (
        "✓ Copied"
      ) : (
        <>
          <Icon name="link" className="i xs" />
          Copy Link
        </>
      )}
    </button>
  );
}

/** 768–899: Copy Link + Delete fold into a "…" menu; Edit Guide stays. */
function RowMenu({ sop, onCopy, onDelete }: { sop: SopItem; onCopy: (s: SopItem) => void; onDelete: (s: SopItem) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <span ref={ref} className="sp-more">
      <button type="button" className="iconbtn bd" aria-label={`More actions for ${sop.title}`} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Icon name="more" className="i sm" />
      </button>
      {open ? (
        <span className="menu frost" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onCopy(sop);
            }}
          >
            <Icon name="link" className="i sm" />
            Copy Link
          </button>
          <hr />
          <button
            type="button"
            role="menuitem"
            className="dng"
            onClick={() => {
              setOpen(false);
              onDelete(sop);
            }}
          >
            <Icon name="trash" className="i sm" />
            Delete SOP
          </button>
        </span>
      ) : null}
    </span>
  );
}

function EmptyState({ phone, onNew }: { phone?: boolean; onNew: () => void }) {
  return (
    <div className={phone ? undefined : "card"}>
      <div className="empty" style={{ padding: phone ? "60px 12px" : "100px 24px" }}>
        <span className="eic">
          <Icon name="book" />
        </span>
        <b>No SOPs yet</b>
        <span style={{ maxWidth: 360 }}>Write a step-by-step guide, or record one in Video Studio.</span>
        <button type="button" className="btn primary" style={{ marginTop: 10 }} onClick={onNew}>
          <Icon name="plus" className="i sm" />
          Create SOP
        </button>
      </div>
    </div>
  );
}

function NoMatch({ phone, query, cat }: { phone?: boolean; query: string; cat: string }) {
  const q = query.trim();
  const inCat = cat !== "All";
  const title = q ? `No SOPs match “${q}”${inCat ? ` in ${cat}` : ""}` : `No SOPs in ${cat}`;
  return (
    <div className={phone ? undefined : "card"}>
      <div className="empty" style={{ padding: phone ? "50px 12px" : "90px 24px" }}>
        <span className="eic">
          <Icon name="search" />
        </span>
        <b>{title}</b>
        <span>{q ? "Try All, or a different search." : "Try All, or a different category."}</span>
      </div>
    </div>
  );
}

function Loading({ phone }: { phone?: boolean }) {
  return (
    <div className={phone ? undefined : "card"}>
      <div className="empty" style={{ padding: phone ? "60px 12px" : "100px 24px" }}>
        <span className="refreshing">
          <i className="spin" />
          Loading SOPs…
        </span>
      </div>
    </div>
  );
}

export function SopsList(p: ListProps) {
  const { phone, sops, filtered } = p;

  const searchBox = (
    <div className="search sp-search" style={phone ? { maxWidth: "none", flex: "none", marginBottom: 8 } : undefined}>
      <Icon name="search" className="i sm" />
      <input
        className="input"
        value={p.query}
        placeholder="Search SOPs…"
        aria-label="Search SOPs"
        onChange={(e) => p.onQuery(e.target.value)}
      />
    </div>
  );

  const body = p.loading ? (
    <Loading phone={phone} />
  ) : sops.length === 0 ? (
    <EmptyState phone={phone} onNew={p.onNew} />
  ) : filtered.length === 0 ? (
    <NoMatch phone={phone} query={p.query} cat={p.selectedCat} />
  ) : phone ? (
    <>
      {filtered.map((sop) => {
        const copied = p.copiedSlug === sop.slug;
        return (
          <div key={rowKey(sop)} className="mcard">
            <div className="l1">
              <b>{sop.title || "Untitled SOP"}</b>
              {!sop.is_published ? <span className="gapchip">Draft</span> : null}
            </div>
            <span className="meta" style={{ display: "block", margin: "2px 0 7px" }}>
              {categoryLabel(sop.category)} · {fmtUpdated(sop.updated_at)}
            </span>
            <div className="chips">
              <RoleChip role={sop.target_role} />
              <span className="count">
                <LengthText sop={sop} />
              </span>
              {isVideoSop(sop) ? (
                <span className="vid">
                  <Icon name="play" className="i xs" />
                  {videoMarker(sop) === "Video" ? "Video" : "Snapshots"}
                </span>
              ) : null}
            </div>
            <div className="ml" style={{ gap: 6 }}>
              <button type="button" className="btn sm" style={{ flex: 1 }} onClick={() => p.onEdit(sop)}>
                <Icon name={isVideoSop(sop) ? "play" : "edit"} className="i xs" />
                Edit Guide
              </button>
              <button
                type="button"
                className={`btn sm${copied ? " copied" : ""}`}
                style={{ flex: 1 }}
                onClick={() => p.onCopy(sop)}
              >
                {copied ? (
                  "✓ Copied"
                ) : (
                  <>
                    <Icon name="link" className="i xs" />
                    Copy Link
                  </>
                )}
              </button>
              <button type="button" className="iconbtn" aria-label={`Delete ${sop.title}`} onClick={() => p.onDelete(sop)}>
                <Icon name="trash" className="i sm" />
              </button>
            </div>
          </div>
        );
      })}
    </>
  ) : (
    <>
      <div className="listhead sp-listhead">
        <span>
          <b style={{ color: "var(--ink)" }}>
            {filtered.length} {filtered.length === 1 ? "SOP" : "SOPs"}
          </b>
          <span className="meta sp-copy-hint"> · Copy Link copies the public link</span>
        </span>
      </div>
      <div className="card" style={{ overflow: "hidden" }}>
        <table className="sopt">
          <thead>
            <tr>
              <th>SOP</th>
              <th>Role</th>
              <th>Length</th>
              <th className="sp-upd-col">Updated</th>
              <th className="r" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((sop) => {
              const copied = p.copiedSlug === sop.slug;
              return (
                <tr key={rowKey(sop)}>
                  <td className="soptitle">
                    <button type="button" className="soptitle-btn" onClick={() => p.onEdit(sop)}>
                      <b>
                        {sop.title || "Untitled SOP"}
                        {!sop.is_published ? <span className="gapchip">Draft</span> : null}
                        <VideoTag sop={sop} />
                      </b>
                      <span className="meta" style={{ fontSize: "var(--t-sm)" }}>
                        {categoryLabel(sop.category)}
                        <span className="sp-upd-fold"> · {fmtUpdated(sop.updated_at)}</span>
                      </span>
                    </button>
                  </td>
                  <td>
                    <RoleChip role={sop.target_role} />
                  </td>
                  <td className="num">
                    <LengthText sop={sop} />
                  </td>
                  <td className="sp-upd-col">{fmtUpdated(sop.updated_at)}</td>
                  <td className="r">
                    <span className="sp-acts">
                      <button type="button" className="btn sm" onClick={() => p.onEdit(sop)}>
                        <Icon name={isVideoSop(sop) ? "play" : "edit"} className="i xs" />
                        Edit Guide
                      </button>
                      <span className="sp-inline">
                        <CopyButton sop={sop} copied={copied} onCopy={p.onCopy} />
                        <button
                          type="button"
                          className="iconbtn"
                          aria-label={`Delete ${sop.title}`}
                          onClick={() => p.onDelete(sop)}
                        >
                          <Icon name="trash" className="i sm" />
                        </button>
                      </span>
                      <RowMenu sop={sop} onCopy={p.onCopy} onDelete={p.onDelete} />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );

  const chips = (
    <div className={phone ? "pfilters scroll" : "clientchips"}>
      {CATS.map((chip) => {
        const active = p.selectedCat === chip.id;
        return (
          <button key={chip.id} type="button" className={active ? "on" : undefined} onClick={() => p.onCat(chip.id)}>
            {chip.label}
          </button>
        );
      })}
    </div>
  );

  const showTools = !p.loading && sops.length > 0;

  if (phone) {
    return (
      <>
        <div className="ptitle">
          <h1>SOPs</h1>
          <Counts stats={p.stats} />
        </div>
        <div className="sp-pactions">
          <button type="button" className="btn sm" style={{ height: 40 }} onClick={p.onRecord}>
            <Icon name="rec" className="i xs" />
            Record
          </button>
          <ImportButton onImport={p.onImport} small />
        </div>
        {p.banner}
        {showTools ? (
          <>
            {searchBox}
            {chips}
          </>
        ) : null}
        {body}
      </>
    );
  }

  return (
    <>
      <div className="head">
        <div>
          <div className="date">{formatHeadDate()}</div>
          <h1 className="sp-heading">
            SOPs
            <Counts stats={p.stats} />
          </h1>
        </div>
        <div className="headacts">
          <button type="button" className="btn" onClick={p.onRecord}>
            <Icon name="rec" className="i sm" />
            Record
          </button>
          <ImportButton onImport={p.onImport} />
          <button type="button" className="btn primary" onClick={p.onNew}>
            <Icon name="plus" className="i sm" />
            New SOP
          </button>
        </div>
      </div>
      <div className="content" style={{ paddingTop: 16, overflow: "auto" }}>
        {p.banner}
        {showTools ? (
          <div className="filters sp-filters">
            {chips}
            {searchBox}
          </div>
        ) : null}
        {body}
      </div>
    </>
  );
}
