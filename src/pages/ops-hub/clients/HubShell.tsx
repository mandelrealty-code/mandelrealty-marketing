import type { ReactNode } from "react";
import { LOGO } from "./logo";
import { Icon, type IconName } from "./icons";

type NavItem = { id: string; icon: IconName; label: string };
type NavGroup = { title: string | null; items: NavItem[] };

const NAV: NavGroup[] = [
  { title: null, items: [{ id: "dashboard", icon: "home", label: "Dashboard" }] },
  {
    title: "Operations",
    items: [
      { id: "onboarding", icon: "clip", label: "Onboarding" },
      { id: "properties", icon: "building", label: "Properties" },
      { id: "team", icon: "team", label: "Team" },
    ],
  },
  {
    title: "Business",
    items: [
      { id: "crm", icon: "users", label: "CRM" },
      { id: "clients", icon: "brief", label: "Clients" },
      { id: "revenue", icon: "chart", label: "Revenue" },
    ],
  },
  { title: "Assistant", items: [{ id: "copilot", icon: "spark", label: "Copilot" }] },
];

const MOBILE_NAV: NavItem[] = [
  { id: "dashboard", icon: "home", label: "Dashboard" },
  { id: "crm", icon: "users", label: "CRM" },
  { id: "onboarding", icon: "clip", label: "Onboarding" },
  { id: "team", icon: "team", label: "Team" },
  { id: "settings", icon: "gear", label: "Settings" },
];

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export function HubShell({
  active = "clients",
  onNavigate,
  children,
  phone = false,
  fab,
}: {
  active?: string;
  onNavigate: (id: string) => void;
  children: ReactNode;
  phone?: boolean;
  fab?: { label: string; onClick: () => void } | null;
}) {
  if (phone) {
    return (
      <div className="phn">
        <div className="ptop">
          <div className="brand">
            <img src={LOGO} alt="" width={30} height={30} />
            <b>Mandel Realty</b>
          </div>
          <span className="iconbtn" aria-hidden>
            <Icon name="search" />
          </span>
        </div>
        <div className="pbody">{children}</div>
        {fab ? (
          <button type="button" className="fab" onClick={fab.onClick}>
            <Icon name="plus" />
            {fab.label}
          </button>
        ) : null}
        <nav className="bnav" aria-label="Mobile navigation">
          {MOBILE_NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={active === item.id ? "on" : undefined}
              onClick={() => onNavigate(item.id)}
            >
              <Icon name={item.icon} />
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="side" aria-label="Main navigation">
        <div className="brand">
          <img src={LOGO} alt="" width={34} height={34} />
          <b>Mandel Realty</b>
          <span className="iconbtn" aria-hidden>
            <Icon name="back" className="i sm" />
          </span>
        </div>
        <div className="jump" aria-hidden>
          <Icon name="search" className="i sm" />
          <span>Jump to…</span>
          <kbd>{isMac ? "⌘K" : "Ctrl K"}</kbd>
        </div>
        {NAV.map((group) => (
          <div key={group.title || "top"} className="ng">
            {group.title ? <h4>{group.title}</h4> : null}
            {group.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`nb${active === item.id ? " on" : ""}`}
                onClick={() => onNavigate(item.id)}
              >
                <Icon name={item.icon} />
                <span className="nl">{item.label}</span>
              </button>
            ))}
          </div>
        ))}
        <div className="spc" />
        <button
          type="button"
          className={`nb${active === "settings" ? " on" : ""}`}
          onClick={() => onNavigate("settings")}
        >
          <Icon name="gear" />
          <span className="nl">Settings</span>
        </button>
        <div className="me">
          <span className="av sm" style={{ background: "oklch(0.38 0.02 270)" }}>
            AD
          </span>
          <div>
            Admin
            <small>Shared account</small>
          </div>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
