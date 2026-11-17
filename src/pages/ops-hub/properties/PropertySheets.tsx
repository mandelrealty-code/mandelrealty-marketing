import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ClientRow, PropertyDetail } from "../../clients/api";
import { formatDisplayDate, todayInputValue } from "../../clients/format";
import { Icon } from "../clients/icons";
import { Avatar } from "../clients/uiBits";
import { CoverThumb, formatListingName, pctLabel } from "./propertyBits";

export type HospitableUnit = { id: string; name: string; address: string };

/* ---------------- frame ---------------- */

function SheetFrame({
  phone,
  busy,
  onClose,
  children,
}: {
  phone?: boolean;
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  return (
    <div
      className={`scrim${phone ? " bottom" : ""}`}
      style={{ position: "fixed", justifyContent: phone ? undefined : "flex-end" }}
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className={`${phone ? "sheet" : "side-sheet"} frost`}
        style={phone ? { maxHeight: "90dvh", overflow: "auto" } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function SheetHead({
  title,
  lede,
  phone,
  onClose,
}: {
  title: string;
  lede?: string;
  phone?: boolean;
  onClose: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2 style={{ fontSize: phone ? 18 : 20, fontWeight: 650 }}>{title}</h2>
        {lede ? (
          <p className="lede" style={{ fontSize: "var(--t-sm)", margin: "4px 0 0" }}>
            {lede}
          </p>
        ) : null}
      </div>
      <button type="button" className="iconbtn" aria-label="Close" onClick={onClose}>
        <Icon name="x" />
      </button>
    </div>
  );
}

function SheetBody({ phone, children }: { phone?: boolean; children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        marginTop: 16,
        ...(phone ? {} : { flex: 1, minHeight: 0, overflow: "auto" }),
      }}
    >
      {children}
    </div>
  );
}

function footStyle(phone?: boolean, between = false) {
  return phone
    ? { flexDirection: "column-reverse" as const, gap: 8, marginTop: 16 }
    : {
        marginTop: "auto",
        paddingTop: 16,
        borderTop: "1px solid var(--line-2)",
        ...(between ? { justifyContent: "space-between" } : {}),
      };
}

function SheetFoot({ phone, children }: { phone?: boolean; children: ReactNode }) {
  return (
    <div className="mfoot" style={footStyle(phone)}>
      {children}
    </div>
  );
}

function Field({
  label,
  opt,
  req,
  hint,
  hintClass,
  full,
  children,
}: {
  label: string;
  opt?: boolean;
  req?: boolean;
  hint?: ReactNode;
  hintClass?: string;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`field${full ? " full" : ""}`}>
      <label>
        {label}
        {opt ? <em> (optional)</em> : null}
        {req ? <em> (required)</em> : null}
      </label>
      {children}
      {hint ? <div className={`hint${hintClass ? ` ${hintClass}` : ""}`}>{hint}</div> : null}
    </div>
  );
}

function Spinner() {
  return <i className="spin" style={{ borderColor: "rgb(255 255 255 / .3)", borderTopColor: "#fff" }} />;
}

const btnH = (phone: boolean | undefined, primary = false) => (phone ? { height: primary ? 48 : 44 } : undefined);

function ClientSelect({
  clients,
  value,
  onChange,
  disabled,
}: {
  clients: ClientRow[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <select className="input" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <option value="">Pick a client…</option>
      {clients.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

/* ---------------- 1. Add property ---------------- */

export type AddPropertyForm = {
  name: string;
  client_id: string;
  address: string;
  hospitable_property_id: string;
};

export function AddPropertySheet({
  phone,
  busy,
  clients,
  initialClientId,
  onClose,
  onSave,
}: {
  phone?: boolean;
  busy?: boolean;
  clients: ClientRow[];
  initialClientId: string;
  onClose: () => void;
  onSave: (form: AddPropertyForm) => void;
}) {
  const [form, setForm] = useState<AddPropertyForm>({
    name: "",
    client_id: initialClientId,
    address: "",
    hospitable_property_id: "",
  });
  const ok = form.name.trim() && form.client_id;
  return (
    <SheetFrame phone={phone} busy={busy} onClose={onClose}>
      <SheetHead
        title="Add property"
        lede="Adds a unit by hand. Import pulls it from Hospitable instead."
        phone={phone}
        onClose={onClose}
      />
      <SheetBody phone={phone}>
        <Field label="Name">
          <input
            className="input"
            autoFocus
            disabled={busy}
            value={form.name}
            placeholder="Property name"
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </Field>
        <Field label="Client" req>
          <ClientSelect
            clients={clients}
            value={form.client_id}
            disabled={busy}
            onChange={(client_id) => setForm((f) => ({ ...f, client_id }))}
          />
        </Field>
        <Field label="Address">
          <input
            className="input"
            disabled={busy}
            value={form.address}
            placeholder="Street, city"
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          />
        </Field>
        <Field label="Hospitable ID" opt hint="Leave empty to link later.">
          <input
            className="input"
            disabled={busy}
            value={form.hospitable_property_id}
            placeholder="Paste the listing UUID"
            style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
            onChange={(e) => setForm((f) => ({ ...f, hospitable_property_id: e.target.value.trim() }))}
          />
        </Field>
      </SheetBody>
      <SheetFoot phone={phone}>
        <button type="button" className="btn" disabled={busy} style={btnH(phone)} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={busy || !ok}
          style={btnH(phone, true)}
          onClick={() => onSave(form)}
        >
          {busy ? <Spinner /> : <Icon name="check" className="i sm" />}
          {busy ? "Saving…" : "Save property"}
        </button>
      </SheetFoot>
    </SheetFrame>
  );
}

/* ---------------- 2/3. Import from Hospitable ---------------- */

export function ImportSheet({
  phone,
  busy,
  loading,
  units,
  availableIds,
  clients,
  initialClientId,
  onClose,
  onImport,
}: {
  phone?: boolean;
  busy?: boolean;
  loading?: boolean;
  /** Every Hospitable listing on the account. */
  units: HospitableUnit[];
  /** Listings not yet linked to a property. Others show as Already imported. */
  availableIds: Set<string>;
  clients: ClientRow[];
  initialClientId: string;
  onClose: () => void;
  onImport: (unit: HospitableUnit, clientId: string) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [q, setQ] = useState("");
  const [unitId, setUnitId] = useState("");
  const [clientId, setClientId] = useState(initialClientId);

  const unit = units.find((u) => u.id === unitId) || null;
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle
      ? units.filter(
          (u) => u.name.toLowerCase().includes(needle) || (u.address || "").toLowerCase().includes(needle),
        )
      : units;
    return [...list].sort((a, b) => Number(!availableIds.has(a.id)) - Number(!availableIds.has(b.id)));
  }, [units, q, availableIds]);
  const openCount = units.filter((u) => availableIds.has(u.id)).length;

  return (
    <SheetFrame phone={phone} busy={busy} onClose={onClose}>
      <SheetHead
        title="Import from Hospitable"
        lede={
          step === 1 || !unit
            ? "Pick a listing, then the client it belongs to."
            : [unit.name, unit.address].filter(Boolean).join(" · ")
        }
        phone={phone}
        onClose={onClose}
      />
      <SheetBody phone={phone}>
        <div className="stepper">
          <span className={step === 1 ? "on" : "done"}>
            <b>{step === 1 ? "1" : <Icon name="check" className="i xs" />}</b> Listing
          </span>
          <hr />
          <span className={step === 2 ? "on" : undefined}>
            <b>2</b> Client
          </span>
        </div>
        {step === 1 ? (
          <>
            <div className="search" style={{ maxWidth: "none", flex: "none" }}>
              <Icon name="search" className="i sm" />
              <input
                className="input"
                value={q}
                placeholder="Search listings"
                disabled={loading}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            {loading ? (
              <div className="sel-list">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i}>
                    <span className="skel" style={{ width: 44, height: 32, borderRadius: 6 }} />
                    <div className="t">
                      <span className="skel" style={{ width: 150, marginBottom: 6 }} />
                      <span className="skel" style={{ width: 200, height: 10 }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : units.length === 0 ? (
              <div className="empty" style={{ padding: "30px 12px" }}>
                <b>No listings in Hospitable</b>
                <span>Add the listing in Hospitable first, then import it here.</span>
              </div>
            ) : shown.length === 0 ? (
              <div className="empty" style={{ padding: "30px 12px" }}>
                <b>No listings match “{q.trim()}”</b>
              </div>
            ) : (
              <>
                {openCount === 0 ? (
                  <div className="hint">Every Hospitable listing is already imported.</div>
                ) : null}
                <div className="sel-list">
                  {shown.map((u) => {
                    const done = !availableIds.has(u.id);
                    const on = u.id === unitId;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        className={[on ? "on" : "", done ? "dis" : ""].filter(Boolean).join(" ") || undefined}
                        disabled={done}
                        onClick={() => setUnitId(u.id)}
                      >
                        <span className={`radio${on ? " on" : ""}`} />
                        <CoverThumb width={44} height={32} radius={6} />
                        <div className="t">
                          <b>{formatListingName(u.name || "Untitled listing")}</b>
                          <span className="meta">{u.address || "No address"}</span>
                        </div>
                        {done ? <span className="meta">Already imported</span> : null}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </>
        ) : clients.length === 0 ? (
          <div className="empty" style={{ padding: "30px 12px" }}>
            <b>No clients yet</b>
            <span>Add a client first, then import the unit for them.</span>
          </div>
        ) : (
          <div className="sel-list">
            {clients.map((c) => {
              const on = c.id === clientId;
              return (
                <button key={c.id} type="button" className={on ? "on" : undefined} onClick={() => setClientId(c.id)}>
                  <span className={`radio${on ? " on" : ""}`} />
                  <Avatar name={c.name} seed={c.id} className="sm" />
                  <div className="t">
                    <b>{c.name}</b>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </SheetBody>
      <SheetFoot phone={phone}>
        {step === 1 ? (
          <>
            <button type="button" className="btn" style={btnH(phone)} onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={!unit || loading}
              style={btnH(phone, true)}
              onClick={() => setStep(2)}
            >
              Continue
              <Icon name="arrow" className="i sm" />
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn" disabled={busy} style={btnH(phone)} onClick={() => setStep(1)}>
              <Icon name="back" className="i sm" />
              Back
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={busy || !unit || !clientId}
              style={btnH(phone, true)}
              onClick={() => unit && onImport(unit, clientId)}
            >
              {busy ? <Spinner /> : <Icon name="import" className="i sm" />}
              {busy ? "Importing…" : "Import unit"}
            </button>
          </>
        )}
      </SheetFoot>
    </SheetFrame>
  );
}

/* ---------------- 4. Connect Hospitable ---------------- */

function SecretInput({
  value,
  onChange,
  placeholder,
  disabled,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="input fakesel" style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input
        type={show ? "text" : "password"}
        autoComplete="off"
        spellCheck={false}
        autoFocus={autoFocus}
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={show ? undefined : "masked"}
        style={{
          flex: 1,
          minWidth: 0,
          border: 0,
          outline: "none",
          background: "transparent",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 13,
        }}
      />
      <button
        type="button"
        className="iconbtn"
        style={{ width: 28, height: 28 }}
        aria-label={show ? "Hide token" : "Show token"}
        onClick={() => setShow((v) => !v)}
      >
        <Icon name="eye" className="i sm" />
      </button>
    </div>
  );
}

export function ConnectHospitableSheet({
  phone,
  busy,
  connected,
  onClose,
  onSave,
}: {
  phone?: boolean;
  busy?: boolean;
  connected?: boolean;
  onClose: () => void;
  onSave: (pat: string, mcp: string) => void;
}) {
  const [pat, setPat] = useState("");
  const [mcp, setMcp] = useState("");
  return (
    <SheetFrame phone={phone} busy={busy} onClose={onClose}>
      <SheetHead
        title={connected ? "Update Hospitable" : "Connect Hospitable"}
        lede="Import needs a Hospitable connection first. Tokens are stored for the app, not shown again."
        phone={phone}
        onClose={onClose}
      />
      <SheetBody phone={phone}>
        <Field label="Personal access token" hint="From Hospitable, Settings, API access.">
          <SecretInput value={pat} onChange={setPat} placeholder="Paste the token" disabled={busy} autoFocus />
        </Field>
        <Field label="MCP token" opt hint="From Hospitable, Settings, Integrations, MCP. Copilot uses it.">
          <SecretInput value={mcp} onChange={setMcp} placeholder="Paste the token" disabled={busy} />
        </Field>
      </SheetBody>
      <SheetFoot phone={phone}>
        <button type="button" className="btn" disabled={busy} style={btnH(phone)} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={busy || (!pat.trim() && !mcp.trim())}
          style={btnH(phone, true)}
          onClick={() => onSave(pat, mcp)}
        >
          {busy ? <Spinner /> : <Icon name="link" className="i sm" />}
          {busy ? "Verifying…" : "Save & connect"}
        </button>
      </SheetFoot>
    </SheetFrame>
  );
}

/* ---------------- 5. Edit property ---------------- */

export type EditPropertyForm = {
  name: string;
  address: string;
  client_id: string;
  str_permit_number: string;
  str_permit_applied_on: string;
  str_permit_issued_on: string;
  str_municipality: string;
  str_day_cap: string;
  mat_required: boolean;
};

export function editFormFrom(p: PropertyDetail, matRequired?: boolean): EditPropertyForm {
  return {
    name: p.name,
    address: p.address || "",
    client_id: p.client_id,
    str_permit_number: p.str_permit_number || "",
    str_permit_applied_on: p.str_permit_applied_on || "",
    str_permit_issued_on: p.str_permit_issued_on || "",
    str_municipality: p.str_municipality || "",
    str_day_cap: String(p.str_day_cap ?? 180),
    mat_required: matRequired ?? Boolean(p.mat_required),
  };
}

export function EditPropertySheet({
  phone,
  busy,
  property,
  initial,
  clients,
  onClose,
  onSave,
  onDeactivate,
  onReactivate,
}: {
  phone?: boolean;
  busy?: boolean;
  property: PropertyDetail;
  initial: EditPropertyForm;
  clients: ClientRow[];
  onClose: () => void;
  onSave: (form: EditPropertyForm) => void;
  onDeactivate: () => void;
  onReactivate: () => void;
}) {
  const [form, setForm] = useState<EditPropertyForm>(initial);
  const [confirm, setConfirm] = useState(false);
  const active = property.active !== false;
  const set = <K extends keyof EditPropertyForm>(k: K, v: EditPropertyForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const ok = form.name.trim() && form.client_id;

  return (
    <SheetFrame phone={phone} busy={busy} onClose={onClose}>
      <SheetHead title={`Edit ${property.name}`} phone={phone} onClose={onClose} />
      <SheetBody phone={phone}>
        <Field label="Name">
          <input className="input" disabled={busy} value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Client">
          <ClientSelect clients={clients} value={form.client_id} disabled={busy} onChange={(v) => set("client_id", v)} />
        </Field>
        <Field label="Address">
          <input className="input" disabled={busy} value={form.address} onChange={(e) => set("address", e.target.value)} />
        </Field>
        <div className="flabel" style={{ margin: "4px 0 -6px" }}>
          STR compliance
        </div>
        <div className="fgrid" style={phone ? { gridTemplateColumns: "1fr 1fr" } : undefined}>
          <Field label="Permit number">
            <input
              className="input"
              disabled={busy}
              value={form.str_permit_number}
              onChange={(e) => set("str_permit_number", e.target.value)}
            />
          </Field>
          <Field label="Municipality">
            <input
              className="input"
              disabled={busy}
              value={form.str_municipality}
              onChange={(e) => set("str_municipality", e.target.value)}
            />
          </Field>
          <Field label="Applied">
            <input
              className="input"
              type="date"
              disabled={busy}
              value={form.str_permit_applied_on}
              onChange={(e) => set("str_permit_applied_on", e.target.value)}
            />
          </Field>
          <Field label="Issued">
            <input
              className="input"
              type="date"
              disabled={busy}
              value={form.str_permit_issued_on}
              onChange={(e) => set("str_permit_issued_on", e.target.value)}
            />
          </Field>
          <Field label="Day cap" full hint="Nights per calendar year">
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={0}
              disabled={busy}
              value={form.str_day_cap}
              onChange={(e) => set("str_day_cap", e.target.value)}
            />
          </Field>
        </div>
        <label className="cbrow" style={{ marginTop: 0, cursor: "pointer" }}>
          <input
            type="checkbox"
            hidden
            disabled={busy}
            checked={form.mat_required}
            onChange={(e) => set("mat_required", e.target.checked)}
          />
          <span className={`cbx${form.mat_required ? " on" : ""}`}>
            {form.mat_required ? <Icon name="check" className="i xs" /> : null}
          </span>
          MAT required
        </label>
        {confirm ? (
          <div className="inconfirm">
            <b>Deactivate {property.name}?</b>
            <div style={{ margin: "4px 0 10px" }}>It will be hidden from month close. It stays in the list as Paused.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn sm" disabled={busy} onClick={() => setConfirm(false)}>
                Keep active
              </button>
              <button type="button" className="btn sm danger" disabled={busy} onClick={onDeactivate}>
                Deactivate
              </button>
            </div>
          </div>
        ) : null}
      </SheetBody>
      <div className="mfoot" style={footStyle(phone, true)}>
        {active ? (
          <button
            type="button"
            className="btn dangerline"
            disabled={busy || confirm}
            style={btnH(phone)}
            onClick={() => setConfirm(true)}
          >
            Deactivate
          </button>
        ) : (
          <button type="button" className="btn" disabled={busy} style={btnH(phone)} onClick={onReactivate}>
            <Icon name="play" className="i sm" />
            Reactivate
          </button>
        )}
        <span style={{ display: "flex", gap: 8, ...(phone ? { flexDirection: "column-reverse" as const } : {}) }}>
          <button type="button" className="btn" disabled={busy} style={btnH(phone)} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={busy || !ok}
            style={btnH(phone, true)}
            onClick={() => onSave(form)}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </span>
      </div>
    </SheetFrame>
  );
}

/* ---------------- 6. Change rate ---------------- */

export function ChangeRateSheet({
  phone,
  busy,
  property,
  defaultPercent,
  onClose,
  onSave,
}: {
  phone?: boolean;
  busy?: boolean;
  property: PropertyDetail;
  defaultPercent: number;
  onClose: () => void;
  onSave: (input: { rate_percent: number; effective_from: string; note: string }) => void;
}) {
  const current = property.current_term;
  const [pct, setPct] = useState(current ? String(current.rate_bps / 100) : String(defaultPercent));
  const [from, setFrom] = useState(todayInputValue());
  const [note, setNote] = useState("");
  const n = Number(pct);
  const ok = pct.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= 100 && Boolean(from);
  const lede = current
    ? `${property.name} is at ${pctLabel(current.rate_bps)} since ${formatDisplayDate(current.effective_from)}.`
    : `${property.name} has no commission yet.`;
  return (
    <SheetFrame phone={phone} busy={busy} onClose={onClose}>
      <SheetHead title="Change rate" lede={lede} phone={phone} onClose={onClose} />
      <SheetBody phone={phone}>
        <Field label="New commission %" hint={pct.trim() !== "" && !ok ? "0 to 100" : undefined} hintClass="bad">
          <input
            className="input focus"
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step={0.5}
            autoFocus
            disabled={busy}
            value={pct}
            onChange={(e) => setPct(e.target.value)}
          />
        </Field>
        <Field
          label="Applies from"
          hint={
            current && from
              ? `Stays before ${formatDisplayDate(from)} keep ${pctLabel(current.rate_bps)}. The change is added to the rate history.`
              : "The change is added to the rate history."
          }
        >
          <input className="input" type="date" disabled={busy} value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Note" opt>
          <input
            className="input"
            disabled={busy}
            value={note}
            placeholder="Why it changed"
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </SheetBody>
      <SheetFoot phone={phone}>
        <button type="button" className="btn" disabled={busy} style={btnH(phone)} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={busy || !ok}
          style={btnH(phone, true)}
          onClick={() => onSave({ rate_percent: n, effective_from: from, note })}
        >
          {busy ? <Spinner /> : <Icon name="check" className="i sm" />}
          {busy ? "Saving…" : "Confirm change"}
        </button>
      </SheetFoot>
    </SheetFrame>
  );
}

/* ---------------- 7. Link Hospitable ---------------- */

export function LinkHospitableSheet({
  phone,
  busy,
  property,
  onClose,
  onSave,
}: {
  phone?: boolean;
  busy?: boolean;
  property: PropertyDetail;
  onClose: () => void;
  onSave: (uuid: string) => void;
}) {
  const [id, setId] = useState(property.hospitable_property_id || "");
  return (
    <SheetFrame phone={phone} busy={busy} onClose={onClose}>
      <SheetHead
        title="Link Hospitable"
        lede={`Connects ${property.name} to its Hospitable listing so earnings can sync.`}
        phone={phone}
        onClose={onClose}
      />
      <SheetBody phone={phone}>
        <Field label="Hospitable UUID" hint="Paste the listing UUID from Hospitable.">
          <input
            className="input focus"
            autoFocus
            disabled={busy}
            value={id}
            placeholder="Listing UUID"
            style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
            onChange={(e) => setId(e.target.value)}
          />
        </Field>
      </SheetBody>
      <SheetFoot phone={phone}>
        <button type="button" className="btn" disabled={busy} style={btnH(phone)} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={busy || !id.trim()}
          style={btnH(phone, true)}
          onClick={() => onSave(id.trim())}
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </SheetFoot>
    </SheetFrame>
  );
}

/* ---------------- 8. App links ---------------- */

export type AppLinksForm = {
  hospitable_property_id: string;
  hub_property_id: string;
  guidebook_property_id: string;
  hospitable_dashboard_id: string;
};

const MONO = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13 };

export function AppLinksSheet({
  phone,
  busy,
  property,
  hospitableUnits,
  onClose,
  onSave,
}: {
  phone?: boolean;
  busy?: boolean;
  property: PropertyDetail;
  hospitableUnits: HospitableUnit[];
  onClose: () => void;
  onSave: (form: AppLinksForm) => void;
}) {
  const [form, setForm] = useState<AppLinksForm>({
    hospitable_property_id: property.hospitable_property_id || "",
    hub_property_id: property.hub_property_id || "",
    guidebook_property_id: property.guidebook_property_id || "",
    hospitable_dashboard_id: property.hospitable_dashboard_id || "",
  });
  const set = (k: keyof AppLinksForm, v: string) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <SheetFrame phone={phone} busy={busy} onClose={onClose}>
      <SheetHead title="App links" lede="One ID per app. Copy and Open use these." phone={phone} onClose={onClose} />
      <SheetBody phone={phone}>
        <Field
          label="Hospitable ID"
          opt={!form.hospitable_property_id}
          hint="The listing UUID. Cleaner Hub, Guidebook and Cohost all use it."
        >
          {hospitableUnits.length > 0 ? (
            <select
              className="input"
              disabled={busy}
              value={hospitableUnits.some((u) => u.id === form.hospitable_property_id) ? form.hospitable_property_id : ""}
              onChange={(e) => {
                if (e.target.value) set("hospitable_property_id", e.target.value);
              }}
              style={{ marginBottom: 6 }}
            >
              <option value="">Pick from Hospitable…</option>
              {hospitableUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {formatListingName(u.name)}
                  {u.address ? `, ${u.address}` : ""}
                </option>
              ))}
            </select>
          ) : null}
          <input
            className={`input${form.hospitable_property_id ? "" : " ph"}`}
            disabled={busy}
            value={form.hospitable_property_id}
            placeholder="Not set"
            style={MONO}
            onChange={(e) => set("hospitable_property_id", e.target.value.trim())}
          />
        </Field>
        <Field
          label="Hospitable dashboard ID"
          opt
          hint="The number in the Hospitable property URL, so Open goes to that property."
        >
          <input
            className="input"
            disabled={busy}
            value={form.hospitable_dashboard_id}
            placeholder="Number or paste the property URL"
            style={MONO}
            onChange={(e) => {
              const raw = e.target.value.trim();
              const fromUrl = raw.match(/properties\/property\/(\d+)/i)?.[1];
              set("hospitable_dashboard_id", fromUrl || raw.replace(/\D/g, ""));
            }}
          />
        </Field>
        <Field label="Cleaner Hub ID" opt hint="Filled by Create / open in Cleaner Hub. Paste only to link by hand.">
          <input
            className="input"
            disabled={busy}
            value={form.hub_property_id}
            placeholder="Not set"
            style={MONO}
            onChange={(e) => set("hub_property_id", e.target.value.trim())}
          />
        </Field>
        <Field label="Guidebook ID" opt hint="The id from the Guidebook editor URL.">
          <input
            className="input"
            disabled={busy}
            value={form.guidebook_property_id}
            placeholder="Not set"
            style={MONO}
            onChange={(e) => set("guidebook_property_id", e.target.value.trim())}
          />
        </Field>
      </SheetBody>
      <SheetFoot phone={phone}>
        <button type="button" className="btn" disabled={busy} style={btnH(phone)} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={busy}
          style={btnH(phone, true)}
          onClick={() => onSave(form)}
        >
          {busy ? "Saving…" : "Save links"}
        </button>
      </SheetFoot>
    </SheetFrame>
  );
}
