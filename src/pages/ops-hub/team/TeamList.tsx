import { useState, type ReactNode } from "react";
import { Icon } from "../clients/icons";
import { Avatar, Chip, formatHeadDate } from "../clients/uiBits";
import {
  STAFF_TYPE_LABEL,
  fmtHours,
  fmtLastSignIn,
  portalUrl,
  sameName,
  type RosterRow,
  type StaffRow,
} from "./teamBits";

export type TeamTab = "logins" | "types";

function PortalLink({ slug }: { slug: string }) {
  return (
    <a
      className="lnk idtxt"
      href={portalUrl(slug)}
      target="_blank"
      rel="noreferrer"
      style={{ color: "var(--tealink)", display: "inline-flex", gap: 5, alignItems: "center" }}
      onClick={(e) => e.stopPropagation()}
    >
      /team/{slug}
      <Icon name="ext" className="i xs" />
    </a>
  );
}

function TeamEmpty({ phone, onInvite }: { phone?: boolean; onInvite: () => void }) {
  return (
    <div className={phone ? undefined : "card"}>
      <div className="empty" style={{ padding: phone ? "60px 12px" : "100px 24px" }}>
        <span className="eic">
          <Icon name="team" />
        </span>
        <b>No staff logins yet</b>
        <span style={{ maxWidth: 380 }}>
          Staff accounts need setting up before they show here. Invite someone to create their login and portal.
        </span>
        <button type="button" className="btn primary" style={{ marginTop: 10 }} onClick={onInvite}>
          <Icon name="mail" className="i sm" />
          Invite
        </button>
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
          Loading team…
        </span>
      </div>
    </div>
  );
}

function RosterCard({
  phone,
  roster,
  users,
  savingName,
  onSetType,
  onSendLogin,
  onRemove,
  onAddPartner,
}: {
  phone?: boolean;
  roster: RosterRow[];
  users: StaffRow[];
  savingName: string;
  onSetType: (name: string, type: string) => void;
  onSendLogin: (name: string) => void;
  onRemove: (row: RosterRow) => void;
  onAddPartner: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const hasLogin = (n: string) => users.some((u) => sameName(u.display_name, n));
  const withLogin = roster.filter((r) => hasLogin(r.name)).length;

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      {phone ? null : (
        <div className="cardhead">
          <h3>
            <Icon name="users" className="i sm" />
            Everyone on the roster
          </h3>
          <span className="meta">
            {roster.length} {roster.length === 1 ? "person" : "people"} · {withLogin} with a login
          </span>
        </div>
      )}
      {roster.length === 0 ? (
        <div className="empty" style={{ padding: "36px 16px" }}>
          <span className="eic">
            <Icon name="users" />
          </span>
          <b style={{ fontSize: "var(--t-sm)" }}>Nobody on the roster yet.</b>
          <span className="meta">Add a partner below, or invite someone to give them a login.</span>
        </div>
      ) : (
        roster.map((r) => {
          const login = hasLogin(r.name);
          const send = !login && r.staff_type !== "partner";
          const saving = savingName === r.name;
          return (
            <div key={r.id} className="lrow2 tm-roster-row">
              <Avatar name={r.name} seed={r.id} className="sm" />
              <div className="t">
                <b>{r.name}</b>
                {login ? (
                  <Chip h={155} c={0.13}>
                    Has login
                  </Chip>
                ) : (
                  <Chip h={270} c={0.02}>
                    No login
                  </Chip>
                )}
              </div>
              <span className="tm-typesel">
                <select
                  className="input"
                  aria-label={`Type for ${r.name}`}
                  value={r.staff_type}
                  disabled={saving}
                  onChange={(e) => onSetType(r.name, e.target.value)}
                >
                  {Object.entries(STAFF_TYPE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                {saving ? (
                  <span className="refreshing">
                    <i className="spin" />
                    Saving…
                  </span>
                ) : null}
              </span>
              <span className="tm-roster-acts">
                {send ? (
                  <button type="button" className="btn sm" onClick={() => onSendLogin(r.name)}>
                    <Icon name="mail" className="i xs" />
                    Send login
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn sm ghost tm-remove"
                  disabled={saving}
                  onClick={() => onRemove(r)}
                >
                  Remove
                </button>
              </span>
            </div>
          );
        })
      )}
      <form
        className="cardfoot"
        style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}
        onSubmit={(e) => {
          e.preventDefault();
          const n = name.trim();
          if (!n) return;
          setName("");
          onAddPartner(n);
        }}
      >
        <div className="flabel" style={{ margin: 0 }}>
          Add partner
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="input"
            style={{ flex: 1 }}
            value={name}
            placeholder="Name"
            aria-label="Add a partner"
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="btn">
            <Icon name="plus" className="i sm" />
            Add
          </button>
        </div>
        <div className="hint" style={{ margin: 0, alignItems: "flex-start", textAlign: "left" }}>
          <Icon name="alert" className="i xs" />
          For partners without a login. Everyone else needs one.
        </div>
      </form>
    </div>
  );
}

export function TeamList({
  phone,
  loading,
  tab,
  onTab,
  users,
  weekByStaff,
  roster,
  savingName,
  banner,
  onInvite,
  onOpen,
  onSetType,
  onSendLogin,
  onRemove,
  onAddPartner,
}: {
  phone?: boolean;
  loading: boolean;
  tab: TeamTab;
  onTab: (t: TeamTab) => void;
  users: StaffRow[];
  weekByStaff: Map<string, number>;
  roster: RosterRow[];
  savingName: string;
  banner?: ReactNode;
  onInvite: () => void;
  onOpen: (u: StaffRow) => void;
  onSetType: (name: string, type: string) => void;
  onSendLogin: (name: string) => void;
  onRemove: (row: RosterRow) => void;
  onAddPartner: (name: string) => void;
}) {
  const loginsBody = loading ? (
    <Loading phone={phone} />
  ) : users.length === 0 ? (
    <TeamEmpty phone={phone} onInvite={onInvite} />
  ) : phone ? (
    <>
      {users.map((u) => (
        <div
          key={u.id}
          className="mcard"
          role="button"
          tabIndex={0}
          onClick={() => onOpen(u)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpen(u);
            }
          }}
        >
          <div className="l1">
            <Avatar name={u.display_name} seed={u.id} className="sm" />
            <b>{u.display_name}</b>
            <Icon name="next" className="i sm" />
          </div>
          <span className="sub" style={{ marginLeft: 35 }}>
            {u.email}
          </span>
          <div className="ml" style={{ marginTop: 2 }}>
            <PortalLink slug={u.slug} />
            <span>
              <span className="meta">{fmtLastSignIn(u.last_login_at)} · </span>
              <b style={{ color: "var(--ink)" }}>{fmtHours(weekByStaff.get(u.id) || 0)} h</b>
            </span>
          </div>
        </div>
      ))}
    </>
  ) : (
    <>
      <div className="card" style={{ overflow: "hidden" }}>
        <table className="hub-table team-logins-table">
          <thead>
            <tr>
              <th className="col-grow">Staff member</th>
              <th className="tm-portal-col col-portal">Portal</th>
              <th className="col-signin">Last sign-in</th>
              <th className="r col-hours">Hours this week</th>
              <th className="col-chev" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="tm-click" onClick={() => onOpen(u)}>
                <td>
                  <div className="client">
                    <Avatar name={u.display_name} seed={u.id} />
                    <div>
                      <b>{u.display_name}</b>
                      <span className="e">{u.email}</span>
                      <span className="tm-fold">
                        <PortalLink slug={u.slug} />
                      </span>
                    </div>
                  </div>
                </td>
                <td className="tm-portal-col">
                  <PortalLink slug={u.slug} />
                </td>
                <td>{fmtLastSignIn(u.last_login_at)}</td>
                <td className="r num" style={{ color: "var(--ink)", fontWeight: 600 }}>
                  {fmtHours(weekByStaff.get(u.id) || 0)} h
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
      <div className="meta" style={{ marginTop: 8 }}>
        Clicking a row opens that person.
      </div>
    </>
  );

  const typesBody = (
    <RosterCard
      phone={phone}
      roster={roster}
      users={users}
      savingName={savingName}
      onSetType={onSetType}
      onSendLogin={onSendLogin}
      onRemove={onRemove}
      onAddPartner={onAddPartner}
    />
  );

  const body = tab === "logins" ? loginsBody : typesBody;

  if (phone) {
    return (
      <>
        <div className="ptitle">
          <h1>Team</h1>
          <button type="button" className="btn sm primary" onClick={onInvite}>
            <Icon name="mail" className="i xs" />
            Invite
          </button>
        </div>
        <div className="pseg two">
          <button type="button" className={tab === "logins" ? "on" : undefined} onClick={() => onTab("logins")}>
            Staff logins
          </button>
          <button type="button" className={tab === "types" ? "on" : undefined} onClick={() => onTab("types")}>
            Staff types
          </button>
        </div>
        {banner}
        {body}
      </>
    );
  }

  return (
    <>
      <div className="head">
        <div>
          <div className="date">{formatHeadDate()}</div>
          <h1>Team</h1>
        </div>
        <div className="headacts">
          <button type="button" className="btn primary" onClick={onInvite}>
            <Icon name="mail" className="i sm" />
            Invite
          </button>
        </div>
      </div>
      <div className="subnav">
        <div className="seg">
          <button type="button" className={tab === "logins" ? "on" : undefined} onClick={() => onTab("logins")}>
            <Icon name="team" className="i sm" />
            Staff logins
          </button>
          <button type="button" className={tab === "types" ? "on" : undefined} onClick={() => onTab("types")}>
            <Icon name="users" className="i sm" />
            Staff types
          </button>
        </div>
        <span className="meta">Your staff only. AI agents live in Copilot.</span>
      </div>
      <div className="content" style={{ paddingTop: 16, overflow: "auto" }}>
        {banner}
        {body}
      </div>
    </>
  );
}
