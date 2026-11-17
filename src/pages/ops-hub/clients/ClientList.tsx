import type { ClientRow } from "../../clients/api";
import { Icon } from "./icons";
import { Avatar, ErrorBanner, StatusChip, formatHeadDate, unitsLabel } from "./uiBits";

export function ClientList({
  clients,
  phone,
  error,
  onDismissError,
  onRetry,
  onAdd,
  onOpen,
  onPreview,
}: {
  clients: ClientRow[];
  phone?: boolean;
  error?: string;
  onDismissError?: () => void;
  onRetry?: () => void;
  onAdd: () => void;
  onOpen: (c: ClientRow) => void;
  onPreview: (c: ClientRow) => void;
}) {
  const active = clients.filter((c) => c.status === "active").length;
  const paused = clients.length - active;

  const empty = (
    <div className={phone ? undefined : "card"}>
      <div className="empty" style={{ padding: phone ? "80px 12px" : "110px 24px" }}>
        <span className="eic">
          <Icon name="brief" />
        </span>
        <b>No clients yet</b>
        <span style={{ maxWidth: 320 }}>
          Add a client to set up their host portal, contracts and month earnings.
        </span>
        <button type="button" className="btn primary" style={{ marginTop: 12 }} onClick={onAdd}>
          <Icon name="plus" className="i sm" />
          Add client
        </button>
      </div>
    </div>
  );

  const banner = error ? (
    <ErrorBanner
      title={error}
      detail={phone ? undefined : "Check your connection and try again."}
      onRetry={onRetry}
      onDismiss={onDismissError}
    />
  ) : null;

  if (phone) {
    return (
      <>
        <div className="ptitle">
          <h1>Clients</h1>
          <span className="meta">{clients.length} clients</span>
        </div>
        {banner}
        {clients.length === 0
          ? empty
          : clients.map((c) => (
              <div key={c.id} className="mcard" role="button" tabIndex={0} onClick={() => onOpen(c)} onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpen(c);
                }
              }}>
                <div className="l1">
                  <Avatar name={c.name} seed={c.id} className="sm" />
                  <b>{c.name}</b>
                  <Icon name="next" className="i sm" />
                </div>
                <span className="sub" style={{ marginLeft: 35 }}>
                  {c.email || "No email"}
                </span>
                <div className="ml" style={{ marginTop: 2 }}>
                  <span className="chips" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span className="count">{unitsLabel(c.property_count ?? 0)}</span>
                    <StatusChip active={c.status === "active"} />
                  </span>
                  <button
                    type="button"
                    className="btn sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPreview(c);
                    }}
                  >
                    <Icon name="ext" className="i xs" />
                    Preview
                  </button>
                </div>
              </div>
            ))}
      </>
    );
  }

  return (
    <>
      <div className="head">
        <div>
          <div className="date">{formatHeadDate()}</div>
          <h1>Clients</h1>
        </div>
        <div className="headacts">
          <button type="button" className="btn primary" onClick={onAdd}>
            <Icon name="plus" className="i sm" />
            Add client
          </button>
        </div>
      </div>
      <div className="content" style={{ overflow: "auto" }}>
        {banner}
        {clients.length === 0 ? (
          empty
        ) : (
          <>
            <div className="listhead">
              <span>
                <b style={{ color: "var(--ink)" }}>{clients.length} clients</b>{" "}
                <span className="meta">
                  · {active} active, {paused} paused
                </span>
              </span>
              <span className="meta">Preview opens the host portal as that client sees it, in a new tab</span>
            </div>
            <div className="card list-table" style={{ overflow: "hidden" }}>
              <table>
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Units</th>
                    <th>Status</th>
                    <th className="r">Host portal</th>
                    <th style={{ width: 44 }} />
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr
                      key={c.id}
                      style={{ cursor: "pointer" }}
                      onClick={() => onOpen(c)}
                    >
                      <td>
                        <div className="client">
                          <Avatar name={c.name} seed={c.id} />
                          <div>
                            <b>{c.name}</b>
                            <span className="e">{c.email || "No email"}</span>
                          </div>
                        </div>
                      </td>
                      <td className="num">{unitsLabel(c.property_count ?? 0)}</td>
                      <td>
                        <StatusChip active={c.status === "active"} />
                      </td>
                      <td className="r">
                        <button
                          type="button"
                          className="btn sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPreview(c);
                          }}
                        >
                          <Icon name="ext" className="i xs" />
                          Preview
                        </button>
                      </td>
                      <td>
                        <span className="iconbtn">
                          <Icon name="next" className="i sm" />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}
