import type { ClientRow, PropertyRow } from "../../clients/api";
import { Icon } from "../clients/icons";
import { ErrorBanner, formatHeadDate } from "../clients/uiBits";
import { ActiveChip, CoverThumb, DealPill, LinkedChip, SpanBtn, isActive, isLinked } from "./propertyBits";

export type StatusFilter = "all" | "active" | "paused";

const STATUS: Array<{ id: StatusFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "paused", label: "Paused" },
];

export function PropertyList({
  properties,
  clients,
  loading,
  phone,
  clientFilter,
  statusFilter,
  onClientFilter,
  onStatusFilter,
  error,
  onDismissError,
  onRetry,
  onAdd,
  onImport,
  onOpen,
}: {
  properties: PropertyRow[];
  clients: ClientRow[];
  loading: boolean;
  phone?: boolean;
  clientFilter: string;
  statusFilter: StatusFilter;
  onClientFilter: (id: string) => void;
  onStatusFilter: (s: StatusFilter) => void;
  error?: string;
  onDismissError?: () => void;
  onRetry?: () => void;
  onAdd: () => void;
  onImport: () => void;
  onOpen: (p: PropertyRow) => void;
}) {
  const filtered = properties.filter((p) => {
    if (clientFilter && p.client_id !== clientFilter) return false;
    if (statusFilter === "active" && !isActive(p)) return false;
    if (statusFilter === "paused" && isActive(p)) return false;
    return true;
  });
  const filtering = Boolean(clientFilter) || statusFilter !== "all";
  const clientName = clients.find((c) => c.id === clientFilter)?.name || "";
  const chipClients = [...clients]
    .filter((c) => properties.some((p) => p.client_id === c.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  const banner = error ? (
    <ErrorBanner title={error} onRetry={onRetry} onDismiss={onDismissError} />
  ) : null;

  const empty = (
    <div className={phone ? undefined : "card"}>
      <div className="empty" style={{ padding: phone ? "70px 12px" : "110px 24px" }}>
        <span className="eic">
          <Icon name="building" />
        </span>
        <b>No properties yet</b>
        <span style={{ maxWidth: 340 }}>Import your listings from Hospitable, or add a property by hand.</span>
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 12,
            ...(phone ? { flexDirection: "column" as const, width: "100%" } : {}),
          }}
        >
          <button type="button" className="btn primary" style={phone ? { height: 44 } : undefined} onClick={onImport}>
            <Icon name="import" className="i sm" />
            Import from Hospitable
          </button>
          <button type="button" className="btn" style={phone ? { height: 44 } : undefined} onClick={onAdd}>
            <Icon name="plus" className="i sm" />
            Add property
          </button>
        </div>
      </div>
    </div>
  );

  const statusWord = statusFilter === "all" ? "" : `${statusFilter} `;
  const noRes = (
    <div className={phone ? undefined : "card"}>
      <div className="empty" style={{ padding: phone ? "56px 12px" : "90px 24px" }}>
        <span className="eic">
          <Icon name="search" />
        </span>
        <b>
          No {statusWord}properties{clientName && !phone ? ` for ${clientName}` : ""}
        </b>
        <span>Pick All, or another client.</span>
      </div>
    </div>
  );

  const showEmpty = !loading && properties.length === 0;

  if (phone) {
    return (
      <>
        <div className="ptitle">
          <h1>Properties</h1>
          <button type="button" className="btn sm" onClick={onImport}>
            <Icon name="import" className="i xs" />
            Import
          </button>
        </div>
        {banner}
        {showEmpty ? (
          empty
        ) : (
          <>
            <div className="pseg" style={{ marginBottom: 8 }}>
              {STATUS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={statusFilter === s.id ? "on" : undefined}
                  onClick={() => onStatusFilter(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="pfilters" style={{ overflowX: "auto" }}>
              <SpanBtn on={!clientFilter} onClick={() => onClientFilter("")}>
                All clients
              </SpanBtn>
              {chipClients.map((c) => (
                <SpanBtn key={c.id} on={clientFilter === c.id} onClick={() => onClientFilter(c.id)}>
                  {c.name}
                </SpanBtn>
              ))}
            </div>
            {loading
              ? [0, 1, 2].map((i) => (
                  <div key={i} className="mcard" style={{ display: "flex", gap: 12 }}>
                    <span className="skel" style={{ width: 72, height: 72, borderRadius: 12 }} />
                    <div style={{ flex: 1 }}>
                      <span className="skel" style={{ width: 120, margin: "6px 0 8px" }} />
                      <span className="skel" style={{ width: 170, height: 10, marginBottom: 8 }} />
                      <span className="skel" style={{ width: 140, height: 20, borderRadius: 99 }} />
                    </div>
                  </div>
                ))
              : filtered.length === 0
                ? noRes
                : filtered.map((p) => (
                    <div
                      key={p.id}
                      className={`mcard${isActive(p) ? "" : " faded"}`}
                      style={{ display: "flex", gap: 12, alignItems: "flex-start" }}
                      role="button"
                      tabIndex={0}
                      onClick={() => onOpen(p)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onOpen(p);
                        }
                      }}
                    >
                      <div>
                        <CoverThumb url={p.cover_image_url} width={72} height={72} radius={12} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="l1">
                          <b>{p.name}</b>
                          <Icon name="next" className="i sm" />
                        </div>
                        <span className="sub" style={{ margin: "1px 0 2px" }}>
                          {p.address || "No address"}
                        </span>
                        <span className="meta" style={{ display: "block", marginBottom: 7 }}>
                          {p.client_name}
                        </span>
                        <div className="chips">
                          <DealPill p={p} />
                          <LinkedChip linked={isLinked(p)} />
                          <ActiveChip active={isActive(p)} />
                        </div>
                      </div>
                    </div>
                  ))}
          </>
        )}
      </>
    );
  }

  return (
    <>
      <div className="head">
        <div>
          <div className="date">{formatHeadDate()}</div>
          <h1>Properties</h1>
        </div>
        <div className="headacts">
          <button type="button" className="btn" onClick={onImport}>
            <Icon name="import" className="i sm" />
            Import
          </button>
          <button type="button" className="btn primary" onClick={onAdd}>
            <Icon name="plus" className="i sm" />
            Add
          </button>
        </div>
      </div>
      <div className="content" style={{ overflow: "auto" }}>
        {banner}
        {showEmpty ? (
          empty
        ) : (
          <>
            <div className="filters" style={{ justifyContent: "space-between" }}>
              <div className="clientchips">
                <button type="button" className={clientFilter ? undefined : "on"} onClick={() => onClientFilter("")}>
                  All clients
                </button>
                {chipClients.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={clientFilter === c.id ? "on" : undefined}
                    onClick={() => onClientFilter(c.id)}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              <div className="chipseg">
                {STATUS.map((s) => (
                  <SpanBtn key={s.id} on={statusFilter === s.id} onClick={() => onStatusFilter(s.id)}>
                    {s.label}
                  </SpanBtn>
                ))}
              </div>
            </div>
            <div className="listhead">
              <span>
                <b style={{ color: "var(--ink)" }}>
                  {loading ? "…" : filtered.length} {filtered.length === 1 && !loading ? "property" : "properties"}
                </b>
                {filtering && !loading ? <span className="meta"> of {properties.length}</span> : null}
              </span>
              <span className="meta">Paused rows are faded</span>
            </div>
            {!loading && filtered.length === 0 ? (
              noRes
            ) : (
              <div className="card" style={{ overflow: "hidden" }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 88 }} />
                      <th>Property</th>
                      <th>Client</th>
                      <th>Deal</th>
                      <th>Hospitable</th>
                      <th>Status</th>
                      <th style={{ width: 44 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {loading
                      ? [0, 1, 2, 3, 4].map((i) => (
                          <tr key={i}>
                            <td>
                              <span className="skel" style={{ width: 64, height: 44, borderRadius: 8 }} />
                            </td>
                            <td>
                              <span className="skel" style={{ width: 160, marginBottom: 6 }} />
                              <span className="skel" style={{ width: 200, height: 10 }} />
                            </td>
                            <td>
                              <span className="skel" style={{ width: 100 }} />
                            </td>
                            <td>
                              <span className="skel" style={{ width: 110, height: 22, borderRadius: 99 }} />
                            </td>
                            <td>
                              <span className="skel" style={{ width: 70, height: 20, borderRadius: 99 }} />
                            </td>
                            <td>
                              <span className="skel" style={{ width: 60, height: 20, borderRadius: 99 }} />
                            </td>
                            <td />
                          </tr>
                        ))
                      : filtered.map((p) => (
                          <tr
                            key={p.id}
                            className={isActive(p) ? undefined : "faded"}
                            style={{ cursor: "pointer" }}
                            onClick={() => onOpen(p)}
                          >
                            <td>
                              <CoverThumb url={p.cover_image_url} width={64} height={44} />
                            </td>
                            <td>
                              <b style={{ color: "var(--ink)", display: "block" }}>{p.name}</b>
                              <span className="meta" style={{ fontSize: "var(--t-sm)" }}>
                                {p.address || "No address"}
                              </span>
                            </td>
                            <td>{p.client_name}</td>
                            <td>
                              <DealPill p={p} />
                            </td>
                            <td>
                              <LinkedChip linked={isLinked(p)} />
                            </td>
                            <td>
                              <ActiveChip active={isActive(p)} />
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
            )}
          </>
        )}
      </div>
    </>
  );
}
