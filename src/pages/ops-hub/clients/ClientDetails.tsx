import { useState } from "react";
import type { ClientRow } from "../../clients/api";
import { Icon } from "./icons";
import type { ClientForm } from "./AddClientSheet";
import { ChecklistCard } from "./ChecklistCard";
import { ContractsCard } from "./ContractsCard";
import { PortalCard } from "./PortalCard";
import { ConfirmModal, ErrorBanner, StatusChip, unitsLabel } from "./uiBits";

export function ClientDetails({
  client,
  form,
  setForm,
  phone,
  busy,
  saving,
  error,
  onDismissError,
  onRetry,
  onBack,
  onSave,
  onDelete,
  onOpenMonth,
  onOpenProperties,
  onToast,
  onError,
}: {
  client: ClientRow;
  form: ClientForm;
  setForm: (next: ClientForm) => void;
  phone?: boolean;
  busy?: boolean;
  saving?: boolean;
  error?: string;
  onDismissError?: () => void;
  onRetry?: () => void;
  onBack: () => void;
  onSave: () => void;
  onDelete: () => Promise<void> | void;
  onOpenMonth: () => void;
  onOpenProperties: () => void;
  onToast?: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const units = client.property_count ?? 0;
  const first = (client.name || "").trim().split(/\s+/)[0] || "this client";

  const detailsCard = (
    <div className="card">
      <div className="cardhead">
        <h3>
          <Icon name="user" className="i sm" />
          Details
        </h3>
        {saving ? (
          <span className="refreshing">
            <i className="spin" />
            Saving…
          </span>
        ) : null}
      </div>
      <div className="cardbody">
        <div className="fgrid" style={phone ? { gridTemplateColumns: "1fr" } : undefined}>
          <div className="field full">
            <label>
              Name <em>(required)</em>
            </label>
            <input
              className="input"
              value={form.name}
              disabled={busy}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className={`field${phone ? " full" : ""}`}>
            <label>Email</label>
            <input
              className="input"
              type="email"
              value={form.email}
              disabled={busy}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className={`field${phone ? " full" : ""}`}>
            <label>Phone</label>
            <input
              className="input"
              value={form.phone}
              disabled={busy}
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
        <div className={`form-acts${phone ? " phone" : ""}`}>
          <button
            type="button"
            className="btn primary"
            style={phone ? { width: "100%", height: 44 } : undefined}
            disabled={busy || !form.name.trim()}
            onClick={onSave}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );

  const linksCard = (
    <div className="card">
      <button type="button" className="lrow2" onClick={onOpenMonth} style={{ width: "100%", textAlign: "left" }}>
        <span className="kic">
          <Icon name="chart" className="i sm" />
        </span>
        <div className="t">
          <b>Month earnings</b>
          <span className="meta">Totals, units and the owner statement</span>
        </div>
        <span className="lnk">
          Open <Icon name="arrow" className="i xs" />
        </span>
      </button>
      <button type="button" className="lrow2" onClick={onOpenProperties} style={{ width: "100%", textAlign: "left" }}>
        <span className="kic">
          <Icon name="building" className="i sm" />
        </span>
        <div className="t">
          <b>Properties</b>
          <span className="meta">
            {unitsLabel(units)} · opens Properties filtered to {first}
          </span>
        </div>
        <span className="lnk">
          View <Icon name="arrow" className="i xs" />
        </span>
      </button>
    </div>
  );

  const dangerCard = (
    <div className="card">
      <div className="lrow2">
        <div className="t">
          <b>Delete client</b>
          <span className="meta">Also removes their host portal, properties and contracts.</span>
        </div>
        <button type="button" className="btn dangerline" disabled={busy} onClick={() => setConfirmDelete(true)}>
          <Icon name="trash" className="i sm" />
          Delete client
        </button>
      </div>
    </div>
  );

  const banner = error ? (
    <ErrorBanner
      title={error}
      onRetry={onRetry}
      onDismiss={onDismissError}
    />
  ) : null;

  // Same gating/copy as ClientsApp window.confirm, shown in the design modal.
  const confirmBody = `This removes their portal login, contracts, and properties so you can invite this email again.`;

  if (phone) {
    return (
      <>
        <button type="button" className="backrow" onClick={onBack}>
          <Icon name="back" className="i sm" />
          Clients
        </button>
        <div className="ptitle">
          <h1>{client.name}</h1>
          <StatusChip active={form.status === "active"} />
        </div>
        <div className="pseg two">
          <span className="on">Details</span>
          <button type="button" onClick={onOpenMonth}>
            Month earnings
          </button>
        </div>
        {banner}
        {detailsCard}
        {linksCard}
        <PortalCard client={client} phone onError={onError} onToast={onToast} />
        <ContractsCard clientId={client.id} phone onError={onError} onToast={onToast} />
        <ChecklistCard clientId={client.id} />
        {dangerCard}
        {confirmDelete ? (
          <ConfirmModal
            phone
            title={`Delete ${client.name}?`}
            body={confirmBody}
            confirmLabel="Delete client"
            busy={busy}
            onCancel={() => setConfirmDelete(false)}
            onConfirm={() => void onDelete()}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <div className="head">
        <div>
          <button type="button" className="backlink" onClick={onBack}>
            <Icon name="back" className="i xs" />
            Clients
          </button>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {client.name} <StatusChip active={form.status === "active"} />
          </h1>
        </div>
      </div>
      <div className="subnav">
        <div className="seg">
          <span className="on">
            <Icon name="user" className="i sm" />
            Details
          </span>
          <button type="button" onClick={onOpenMonth}>
            <Icon name="chart" className="i sm" />
            Month earnings
          </button>
        </div>
      </div>
      <div className="content" style={{ overflow: "auto" }}>
        {banner}
        <div className="cgrid fill-grid">
          <div className="col">
            {detailsCard}
            {linksCard}
            <ChecklistCard clientId={client.id} />
          </div>
          <div className="col">
            <PortalCard client={client} onError={onError} onToast={onToast} />
            <ContractsCard clientId={client.id} onError={onError} onToast={onToast} />
            {dangerCard}
          </div>
        </div>
      </div>
      {confirmDelete ? (
        <ConfirmModal
          title={`Delete ${client.name}?`}
          body={confirmBody}
          confirmLabel="Delete client"
          busy={busy}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => void onDelete()}
        />
      ) : null}
    </>
  );
}
