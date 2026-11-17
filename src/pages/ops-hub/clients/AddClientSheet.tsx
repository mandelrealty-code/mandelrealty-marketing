import { useEffect, useMemo, useRef, useState } from "react";
import type { CrmLead } from "../../clients/api";
import { Icon } from "./icons";
import { Avatar } from "./uiBits";

export type ClientForm = {
  name: string;
  email: string;
  phone: string;
  status: "active" | "paused";
};

export function AddClientSheet({
  phone,
  busy,
  form,
  setForm,
  leads,
  leadsLoading,
  initialLeadId = "",
  onCancel,
  onSaveOnly,
  onSaveAndSend,
}: {
  phone?: boolean;
  busy?: boolean;
  form: ClientForm;
  setForm: (next: ClientForm) => void;
  leads: CrmLead[];
  leadsLoading?: boolean;
  initialLeadId?: string;
  onCancel: () => void;
  onSaveOnly: () => void;
  onSaveAndSend: () => void;
}) {
  const [pick, setPick] = useState(false);
  const [q, setQ] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState(initialLeadId);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialLeadId) setSelectedLeadId(initialLeadId);
  }, [initialLeadId]);

  useEffect(() => {
    if (!pick) return;
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setPick(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [pick]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return leads;
    return leads.filter(
      (l) =>
        (l.name && l.name.toLowerCase().includes(needle)) ||
        (l.email && l.email.toLowerCase().includes(needle)) ||
        (l.phone && l.phone.toLowerCase().includes(needle)) ||
        (l.address && l.address.toLowerCase().includes(needle)) ||
        (l.listing_title && l.listing_title.toLowerCase().includes(needle)),
    );
  }, [leads, q]);

  const selected = leads.find((l) => l.id === selectedLeadId) || null;
  const filled = Boolean(selectedLeadId || form.name || form.email || form.phone);

  const selectLead = (lead: CrmLead) => {
    setSelectedLeadId(lead.id);
    setForm({
      name: lead.name || "",
      email: lead.email || "",
      phone: lead.phone || "",
      status: "active",
    });
    setPick(false);
    setQ("");
  };

  const clearLead = () => {
    setSelectedLeadId("");
    setForm({ name: "", email: "", phone: "", status: "active" });
    setPick(false);
    setQ("");
  };

  const fields = (
    <div className="fgrid" style={phone ? { gridTemplateColumns: "1fr" } : undefined}>
      <div className="field full">
        <label>
          Name <em>(required)</em>
        </label>
        <input
          className="input"
          disabled={busy}
          value={form.name}
          placeholder="Full name"
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <div className={`field${phone ? " full" : ""}`}>
        <label>Email</label>
        <input
          className="input"
          type="email"
          disabled={busy}
          value={form.email}
          placeholder="name@example.com"
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </div>
      <div className={`field${phone ? " full" : ""}`}>
        <label>Phone</label>
        <input
          className="input"
          disabled={busy}
          value={form.phone}
          placeholder="(000) 000-0000"
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
      </div>
      <div className="field full">
        <label>Status</label>
        <div className="aiseg" style={{ maxWidth: phone ? "none" : 260 }}>
          <button
            type="button"
            className={form.status === "active" ? "on" : undefined}
            disabled={busy}
            onClick={() => setForm({ ...form, status: "active" })}
          >
            Active
          </button>
          <button
            type="button"
            className={form.status === "paused" ? "on" : undefined}
            disabled={busy}
            onClick={() => setForm({ ...form, status: "paused" })}
          >
            Paused
          </button>
        </div>
      </div>
    </div>
  );

  const leadbox = (
    <div className="leadbox" ref={boxRef}>
      <h5>
        <span>Start from a CRM lead</span>
        {filled ? (
          <button type="button" className="clear" style={{ fontSize: "var(--t-xs)" }} onClick={clearLead}>
            Clear
          </button>
        ) : null}
      </h5>
      <button
        type="button"
        className={`input fakesel${pick ? " focus" : ""}`}
        disabled={busy}
        onClick={() => setPick((v) => !v)}
      >
        {selected ? (
          <span style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ink)", fontWeight: 500 }}>
            <Avatar name={selected.name} seed={selected.id} className="sm" />
            {selected.name}
          </span>
        ) : (
          <span style={{ color: "oklch(0.55 0.008 285)" }}>
            {leadsLoading ? "Loading leads…" : "Choose a lead…"}
          </span>
        )}
        <Icon name="chev" className="i sm" />
      </button>
      {pick ? (
        <div className="picker frost">
          <div className="search" style={{ maxWidth: "none", marginBottom: 6 }}>
            <Icon name="search" className="i sm" />
            <input
              className="input"
              value={q}
              placeholder="Search leads by name or phone"
              onChange={(e) => setQ(e.target.value)}
              autoFocus
            />
          </div>
          {filtered.length === 0 ? (
            <div className="meta" style={{ padding: "10px 8px" }}>
              No matching leads.
            </div>
          ) : (
            filtered.map((l) => (
              <button key={l.id} type="button" className="pi" onClick={() => selectLead(l)}>
                <Avatar name={l.name} seed={l.id} className="sm" />
                <div className="t">
                  <b>{l.name || "Unnamed lead"}</b>
                  <span className="meta">
                    {[l.phone, l.status].filter(Boolean).join(" · ") || l.email || "No contact"}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      ) : null}
      {selected ? (
        <div className="hint good">
          <Icon name="check" className="i xs" />
          Filled from the lead. You can still edit every field.
        </div>
      ) : null}
    </div>
  );

  const foot = (
    <div
      className="mfoot"
      style={
        phone
          ? {
              position: "sticky",
              bottom: -28,
              margin: "16px -18px -28px",
              padding: "12px 18px 24px",
              background: "oklch(98% 0 0 / .94)",
              borderTop: "1px solid var(--line-2)",
              flexDirection: "column-reverse",
              gap: 8,
            }
          : { marginTop: "auto", paddingTop: 16, borderTop: "1px solid var(--line-2)" }
      }
    >
      <button type="button" className="btn" disabled={busy} style={phone ? { height: 44 } : undefined} onClick={onCancel}>
        Cancel
      </button>
      <button
        type="button"
        className="btn"
        disabled={busy || !form.name.trim()}
        style={phone ? { height: 44 } : undefined}
        onClick={onSaveOnly}
      >
        Save client only
      </button>
      <button
        type="button"
        className="btn primary"
        disabled={busy || !form.name.trim()}
        style={phone ? { height: 48 } : undefined}
        onClick={onSaveAndSend}
      >
        {busy ? (
          <>
            <i className="spin" style={{ borderColor: "rgb(255 255 255 / .3)", borderTopColor: "#fff" }} />
            Saving…
          </>
        ) : (
          <>
            Save & send contract
            <Icon name="arrow" className="i sm" />
          </>
        )}
      </button>
    </div>
  );

  const inner = (
    <>
      <h2 style={{ fontSize: phone ? 18 : 20, fontWeight: 650 }}>Add client</h2>
      <p className="lede" style={{ fontSize: "var(--t-sm)", margin: "4px 0 0" }}>
        Save & send contract saves the client, then opens the portal invite.
      </p>
      {phone ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
          {leadbox}
          {pick ? null : fields}
        </div>
      ) : (
        <div className="sbody" style={{ marginTop: 16, flex: 1, overflow: "auto" }}>
          {leadbox}
          <div style={{ marginTop: 14 }}>{fields}</div>
        </div>
      )}
      {phone && pick ? null : foot}
    </>
  );

  return (
    <div
      className={`scrim${phone ? " bottom" : ""}`}
      style={{ position: "fixed", justifyContent: phone ? undefined : "flex-end" }}
      onClick={onCancel}
    >
      <div
        className={`${phone ? "sheet" : "side-sheet"} frost`}
        style={phone ? { maxHeight: "90dvh", overflow: "auto" } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {inner}
      </div>
    </div>
  );
}
