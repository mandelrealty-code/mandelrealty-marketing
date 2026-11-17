import { useRef, type ReactNode } from "react";
import type { PropertyDetail } from "../../clients/api";
import { formatDisplayDate } from "../../clients/format";
import { ContractsCard } from "../clients/ContractsCard";
import { Icon } from "../clients/icons";
import { Chip, ErrorBanner } from "../clients/uiBits";
import { BillingCard, type TermsPatch } from "./BillingCard";
import { EarningsCards } from "./EarningsCard";
import {
  ActiveChip,
  CoverThumb,
  LinkedChip,
  copyText,
  dealPill,
  formatListingName,
  isActive,
  isLinked,
} from "./propertyBits";

type AppRow = {
  key: string;
  name: string;
  letter: string;
  hue: number;
  value: string;
  display: ReactNode;
  href: string;
  openLabel: string;
};

function appRows(p: PropertyDetail): AppRow[] {
  const cleanerBase =
    (import.meta.env.VITE_CLEANER_HUB_URL as string | undefined)?.replace(/\/$/, "") || "https://portal.stravo.ai";
  const guidebookBase = (import.meta.env.VITE_GUIDEBOOK_URL as string | undefined)?.replace(/\/$/, "");
  const cohostBase =
    (import.meta.env.VITE_COHOST_URL as string | undefined)?.replace(/\/$/, "") || "https://chat.stravo.ai";
  const hid = p.hospitable_property_id || "";
  const dashId = (p.hospitable_dashboard_id || "").trim();
  const hub = p.hub_property_id || "";
  const gid = p.guidebook_property_id || "";
  return [
    {
      key: "hospitable",
      name: "Hospitable",
      letter: "H",
      hue: 255,
      value: hid,
      display: hid ? <span className="idtxt">{hid}</span> : <span className="meta">Not set</span>,
      href: dashId
        ? `https://my.hospitable.com/properties/property/${dashId}/overview`
        : "https://my.hospitable.com/properties",
      openLabel: dashId || !hid ? "Open" : "Open list",
    },
    {
      key: "hub",
      name: "Cleaner Hub",
      letter: "C",
      hue: 185,
      value: hub,
      display: hub ? <span className="idtxt">{hub}</span> : <span className="meta">Not set</span>,
      href: hub ? `${cleanerBase}/properties/${hub}` : "",
      openLabel: "Open",
    },
    {
      key: "guidebook",
      name: "Guidebook",
      letter: "G",
      hue: 65,
      value: gid,
      display: gid ? <span className="idtxt">{gid}</span> : <span className="meta">Not set</span>,
      href: gid && guidebookBase ? `${guidebookBase}/editor/${gid}` : guidebookBase || "",
      openLabel: "Open",
    },
    {
      key: "cohost",
      name: "Cohost",
      letter: "Co",
      hue: 300,
      value: hid,
      display: hid ? <span className="meta">Uses the Hospitable ID</span> : <span className="meta">Not set</span>,
      href: `${cohostBase}/`,
      openLabel: "Open",
    },
  ];
}

function matTone(status: string): { h: number; c: number; label: string } {
  if (status === "filed") return { h: 155, c: 0.13, label: "Filed" };
  if (status === "overdue") return { h: 25, c: 0.19, label: "Overdue" };
  if (status === "due_soon") return { h: 65, c: 0.14, label: "Due soon" };
  return { h: 270, c: 0.02, label: "Open" };
}

export function PropertyDetails({
  property,
  phone,
  busy,
  error,
  onDismissError,
  matSqlMissing,
  onBack,
  onOpenClient,
  onEdit,
  onEnableMat,
  onLinkHospitable,
  onAppLinks,
  onPushCleaner,
  onReviewTasks,
  onCoverUpload,
  onCoverRemove,
  onChangeRate,
  onSaveTerms,
  onSetFirstRate,
  onMarkMat,
  onOpenStatement,
  onToast,
  onError,
}: {
  property: PropertyDetail;
  phone?: boolean;
  busy?: boolean;
  error?: string;
  onDismissError?: () => void;
  matSqlMissing?: boolean;
  onBack: () => void;
  onOpenClient: () => void;
  onEdit: () => void;
  onEnableMat: () => void;
  onLinkHospitable: () => void;
  onAppLinks: () => void;
  onPushCleaner: () => void;
  onReviewTasks: () => void;
  onCoverUpload: (file: File) => void;
  onCoverRemove: () => void;
  onChangeRate: () => void;
  onSaveTerms: (patch: TermsPatch) => Promise<void>;
  onSetFirstRate: (ratePercent: number) => Promise<void>;
  onMarkMat: (year: number, quarter: number, filed: boolean) => void;
  onOpenStatement: (month: string) => void;
  onToast: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const coverRef = useRef<HTMLInputElement>(null);
  const linked = isLinked(property);
  const active = isActive(property);
  const deal = dealPill(property);
  const hid = property.hospitable_property_id || "";

  const copyUuid = () => copyText(hid, () => onToast("UUID copied"), onError);

  const banner = error ? <ErrorBanner title={error} onDismiss={onDismissError} /> : null;

  const pausedBar = active ? null : (
    <div className="infobar">
      <Icon name="pause" className="i sm" />
      <span>
        <b style={{ color: "var(--ink)" }}>Paused.</b> Hidden from month close. Turn it back on from Edit.
      </span>
    </div>
  );

  /* ---------- cards ---------- */

  const hasCover = Boolean(property.cover_image_url);
  const cover = (
    <div className="covercard">
      <input
        ref={coverRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onCoverUpload(file);
          e.target.value = "";
        }}
      />
      <CoverThumb url={property.cover_image_url} width="100%" height="100%" radius={0} hero />
      <div className="coveracts">
        {hasCover ? (
          <>
            <button type="button" className="btn sm" disabled={busy} onClick={() => coverRef.current?.click()}>
              <Icon name="upload" className="i xs" />
              Replace
            </button>
            <button type="button" className="btn sm" disabled={busy} onClick={onCoverRemove}>
              <Icon name="trash" className="i xs" />
              Remove
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn sm primary"
            style={{ background: "var(--primary)" }}
            disabled={busy}
            onClick={() => coverRef.current?.click()}
          >
            <Icon name="upload" className="i xs" />
            Upload
          </button>
        )}
      </div>
    </div>
  );

  const apps = (
    <div className="card">
      <div className="cardhead">
        <h3>
          <Icon name="link" className="i sm" />
          App links
        </h3>
        <button type="button" className="btn sm" disabled={busy} onClick={onAppLinks}>
          <Icon name="edit" className="i xs" />
          Edit links
        </button>
      </div>
      {appRows(property).map((r) => (
        <div key={r.key} className="lrow2">
          <span className="appic" style={{ background: `oklch(0.5 0.1 ${r.hue})` }}>
            {r.letter}
          </span>
          <div className="t">
            <b>{r.name}</b>
            {r.display}
          </div>
          <button
            type="button"
            className="iconbtn"
            disabled={!r.value}
            style={r.value ? undefined : { opacity: 0.4 }}
            aria-label={`Copy ${r.name} ID`}
            onClick={() => copyText(r.value, () => onToast(`${r.name} ID copied`), onError)}
          >
            <Icon name="copy" className="i sm" />
          </button>
          <button
            type="button"
            className="btn sm"
            disabled={!r.href}
            onClick={() => window.open(r.href, "_blank", "noopener,noreferrer")}
          >
            {r.openLabel}
            <Icon name="ext" className="i xs" />
          </button>
        </div>
      ))}
      <div className="cardfoot">
        <button type="button" className="btn sm" disabled={busy || !linked} onClick={onPushCleaner}>
          <Icon name="brief" className="i xs" />
          Create / open in Cleaner Hub
        </button>
        <button type="button" className="btn sm" disabled={busy} onClick={onReviewTasks}>
          <Icon name="star" className="i xs" />
          Create ≤4★ review tasks
        </button>
        {linked ? null : (
          <span className="hint warn" style={{ margin: 0 }}>
            <Icon name="alert" className="i xs" />
            Cleaner Hub needs Hospitable linked first
          </span>
        )}
      </div>
    </div>
  );

  const billing = (
    <BillingCard
      property={property}
      phone={phone}
      busy={busy}
      onChangeRate={onChangeRate}
      onSaveTerms={onSaveTerms}
      onSetFirstRate={onSetFirstRate}
      onError={onError}
    />
  );

  const hasPermit = Boolean(property.str_permit_number) || Boolean(property.str_permit_issued_on);
  const str = property.str_compliance;
  const strTone =
    str?.status === "expired"
      ? { h: 25, c: 0.19 }
      : str?.status === "renewal_due"
        ? { h: 65, c: 0.14 }
        : { h: 155, c: 0.13 };
  const strCard = (
    <div className="card">
      <div className="cardhead">
        <h3>
          <Icon name="permit" className="i sm" />
          STR compliance
        </h3>
        <button type="button" className="btn sm" disabled={busy} onClick={onEdit}>
          <Icon name={hasPermit ? "edit" : "plus"} className="i xs" />
          {hasPermit ? "Edit permit" : "Add permit"}
        </button>
      </div>
      <div className="cardbody">
        {hasPermit ? (
          <>
            {str && str.status !== "unset" ? (
              <div style={{ marginBottom: 10 }}>
                <Chip h={strTone.h} c={strTone.c}>
                  {str.status_label}
                </Chip>
              </div>
            ) : null}
            <dl className="kv2" style={{ margin: 0 }}>
              <div>
                <dt>Permit number</dt>
                <dd className="idtxt" style={{ color: "var(--ink)" }}>
                  {property.str_permit_number || "—"}
                </dd>
              </div>
              <div>
                <dt>Municipality</dt>
                <dd>{property.str_municipality || "—"}</dd>
              </div>
              <div>
                <dt>Applied</dt>
                <dd>{formatDisplayDate(property.str_permit_applied_on)}</dd>
              </div>
              <div>
                <dt>Issued</dt>
                <dd>{formatDisplayDate(property.str_permit_issued_on)}</dd>
              </div>
              <div>
                <dt>Day cap</dt>
                <dd>{property.str_day_cap ? `${property.str_day_cap} nights` : "No cap"}</dd>
              </div>
              {str ? (
                <div>
                  <dt>Used {str.calendar_year}</dt>
                  <dd>
                    {str.nights_used} of {str.day_cap} · {str.nights_remaining} left
                  </dd>
                </div>
              ) : null}
              {str?.renews_on ? (
                <div>
                  <dt>Renews</dt>
                  <dd>{formatDisplayDate(str.renews_on)}</dd>
                </div>
              ) : null}
            </dl>
          </>
        ) : (
          <span style={{ fontSize: "var(--t-sm)" }}>No permit on file.</span>
        )}
      </div>
    </div>
  );

  const mat = property.mat_compliance;
  const sqlMissing = Boolean(property.mat_required) && (!mat?.required || matSqlMissing);
  const matCard = !property.mat_required ? (
    <div className="card">
      <div className="cardhead">
        <h3>
          <Icon name="receipt" className="i sm" />
          MAT
        </h3>
        <button type="button" className="btn sm" disabled={busy} onClick={onEnableMat}>
          Enable MAT
        </button>
      </div>
      <div className="cardbody" style={{ fontSize: "var(--t-sm)" }}>
        MAT is off for this property.
      </div>
    </div>
  ) : (
    <div className="card">
      <div className="cardhead">
        <h3>
          <Icon name="receipt" className="i sm" />
          MAT
        </h3>
        <Chip h={155} c={0.13}>
          Enabled
        </Chip>
      </div>
      {sqlMissing ? (
        <div className="cardbody" style={{ paddingBottom: mat?.quarters.length ? 0 : undefined }}>
          <div className="warnbox" style={{ margin: 0 }}>
            <Icon name="alert" className="i sm" />
            <span>
              <b>SQL not run.</b> The MAT tables aren’t set up yet, so filings can’t be saved. Run the MAT SQL
              (supabase/pm_mat_filings_v1.sql), then reload.
            </span>
          </div>
        </div>
      ) : null}
      {mat?.quarters.length ? (
        mat.quarters.map((q) => {
          const filed = q.filing_status === "filed";
          const tone = matTone(q.filing_status);
          return (
            <div key={`${q.year}-Q${q.quarter}`} className="qrow" style={sqlMissing ? { opacity: 0.55 } : undefined}>
              <div className="t">
                <b>{q.label}</b>
                <span className="meta">
                  {formatDisplayDate(q.period_start)} to {formatDisplayDate(q.period_end)}
                  {filed && q.filed_on ? ` · Filed ${formatDisplayDate(q.filed_on)}` : ` · Due ${formatDisplayDate(q.due_on)}`}
                </span>
              </div>
              {filed || q.filing_status === "overdue" || q.filing_status === "due_soon" ? (
                <Chip h={tone.h} c={tone.c}>
                  {tone.label}
                </Chip>
              ) : null}
              {filed ? (
                <button
                  type="button"
                  className="btn sm"
                  disabled={busy || sqlMissing}
                  onClick={() => onMarkMat(q.year, q.quarter, false)}
                >
                  Undo filed
                </button>
              ) : (
                <button
                  type="button"
                  className="btn sm"
                  disabled={busy || sqlMissing}
                  onClick={() => onMarkMat(q.year, q.quarter, true)}
                >
                  <Icon name="check" className="i xs" />
                  Mark filed
                </button>
              )}
            </div>
          );
        })
      ) : sqlMissing ? null : (
        <div className="cardbody" style={{ fontSize: "var(--t-sm)" }}>
          No quarters to file yet.
        </div>
      )}
    </div>
  );

  const contracts = (
    <ContractsCard
      clientId={property.client_id}
      propertyId={property.id}
      propertyName={property.name}
      phone={phone}
      onError={onError}
      onToast={onToast}
    />
  );

  const earnings = (
    <EarningsCards
      propertyId={property.id}
      linked={linked}
      phone={phone}
      onLinkHospitable={onLinkHospitable}
      onOpenStatement={onOpenStatement}
      onToast={onToast}
      onError={onError}
    />
  );

  const uuidBtn = (sm: boolean) =>
    linked ? (
      <button type="button" className={`btn${sm ? " sm" : ""}`} onClick={copyUuid}>
        <Icon name="copy" className={sm ? "i xs" : "i sm"} />
        Copy UUID
      </button>
    ) : (
      <button type="button" className={`btn${sm ? " sm" : ""}`} disabled={busy} onClick={onLinkHospitable}>
        <Icon name="link" className={sm ? "i xs" : "i sm"} />
        Link Hospitable
      </button>
    );

  if (phone) {
    return (
      <>
        <button type="button" className="backrow" onClick={onBack}>
          <Icon name="back" className="i sm" />
          Properties
        </button>
        <div className="ptitle" style={{ marginBottom: 4 }}>
          <h1>{formatListingName(property.name)}</h1>
          <button type="button" className="btn sm" disabled={busy} onClick={onEdit}>
            <Icon name="edit" className="i xs" />
            Edit
          </button>
        </div>
        <div className="meta" style={{ fontSize: "var(--t-sm)", marginBottom: 8 }}>
          {property.address || "No address"} ·{" "}
          <button type="button" className="lnk" onClick={onOpenClient}>
            {property.client_name}
          </button>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
          <LinkedChip linked={linked} />
          <ActiveChip active={active} />
          <span style={{ flex: 1 }} />
          {uuidBtn(true)}
        </div>
        {banner}
        {pausedBar}
        {cover}
        {apps}
        {billing}
        {strCard}
        {matCard}
        {contracts}
        {earnings}
      </>
    );
  }

  return (
    <>
      <div className="head">
        <div>
          <button type="button" className="backlink" onClick={onBack}>
            <Icon name="back" className="i xs" />
            Properties
          </button>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {formatListingName(property.name)} <LinkedChip linked={linked} />
            <ActiveChip active={active} />
          </h1>
          <div className="meta" style={{ fontSize: "var(--t-sm)", marginTop: 2 }}>
            {property.address || "No address"} ·{" "}
            <button type="button" className="lnk" onClick={onOpenClient}>
              {property.client_name}
            </button>{" "}
            · {deal ?? "No billing terms yet"}
          </div>
        </div>
        <div className="headacts">
          {uuidBtn(false)}
          <button type="button" className="btn primary" disabled={busy} onClick={onEdit}>
            <Icon name="edit" className="i sm" />
            Edit
          </button>
        </div>
      </div>
      <div className="content prop-detail-content" style={{ overflow: "auto" }}>
        {banner}
        {pausedBar}
        <div className="pgrid2 fill-grid">
          <div className="col">
            {cover}
            {apps}
            {billing}
            {strCard}
            {matCard}
            {contracts}
          </div>
          <div className="col">{earnings}</div>
        </div>
      </div>
    </>
  );
}
