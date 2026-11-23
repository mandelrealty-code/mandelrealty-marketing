import { useState } from "react";
import { Icon } from "../clients/icons";
import { SheetFrame, SheetHead, Spinner, btnH, footStyle } from "../revenue/revenueBits";
import type { StaffType } from "../../../../shared/pm/teamStore";

/** Invite role options → staff_type + email label */
export const INVITE_ROLE_OPTIONS: {
  value: StaffType;
  optionLabel: string;
  emailLabel: string;
}[] = [
  { value: "booker", optionLabel: "Booker", emailLabel: "Booker" },
  { value: "va", optionLabel: "VA (Back Office)", emailLabel: "VA — Back Office" },
  { value: "onboarder", optionLabel: "Onboarder", emailLabel: "Onboarder" },
  { value: "operations", optionLabel: "Operations", emailLabel: "Operations" },
  {
    value: "partner",
    optionLabel: "Partner (roster-only, no login)",
    emailLabel: "Partner",
  },
];

export function InviteSheet({
  phone,
  busy,
  initialName = "",
  initialStaffType = "",
  prefilled,
  onClose,
  onSend,
}: {
  phone?: boolean;
  busy?: boolean;
  initialName?: string;
  /** Prefill role when inviting from Staff types. */
  initialStaffType?: StaffType | "";
  /** True when opened from Send login on the Staff types roster. */
  prefilled?: boolean;
  onClose: () => void;
  onSend: (email: string, displayName: string, staffType: StaffType) => void;
}) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState("");
  const [staffType, setStaffType] = useState<StaffType | "">(
    INVITE_ROLE_OPTIONS.some((o) => o.value === initialStaffType)
      ? (initialStaffType as StaffType)
      : "",
  );
  const ready = Boolean(name.trim() && email.trim() && staffType);

  return (
    <SheetFrame phone={phone} busy={busy} onClose={onClose}>
      <SheetHead
        title="Invite staff"
        lede="Creates their login and portal, and sends a real email with a temporary password."
        phone={phone}
        onClose={onClose}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          marginTop: 16,
          ...(phone ? {} : { flex: 1, minHeight: 0, overflow: "auto" }),
        }}
      >
        <div className="field">
          <label>
            Display name <em>(required)</em>
          </label>
          <input
            className="input"
            autoFocus={!prefilled}
            value={name}
            disabled={busy}
            placeholder="Full name"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="field">
          <label>
            Email <em>(required)</em>
          </label>
          <input
            className="input"
            type="email"
            autoFocus={prefilled}
            value={email}
            disabled={busy}
            placeholder="name@example.com"
            onChange={(e) => setEmail(e.target.value)}
          />
          {prefilled ? (
            <div className="hint good">
              <Icon name="check" className="i xs" />
              Pre-filled from the Staff types roster.
            </div>
          ) : null}
        </div>
        <div className="field">
          <label>
            Role <em>(required)</em>
          </label>
          <select
            className="input"
            aria-label="Role"
            value={staffType}
            disabled={busy}
            onChange={(e) => setStaffType((e.target.value as StaffType) || "")}
          >
            <option value="">Select a role</option>
            {INVITE_ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.optionLabel}
              </option>
            ))}
          </select>
        </div>
        <div className="hint">
          <Icon name="mail" className="i xs" />
          Nothing is sent until you press Send invite.
        </div>
      </div>
      <div className="mfoot" style={footStyle(phone)}>
        <button type="button" className="btn" disabled={busy} style={btnH(phone)} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={busy || !ready}
          style={btnH(phone, true)}
          onClick={() => {
            if (!staffType) return;
            onSend(email.trim(), name.trim(), staffType);
          }}
        >
          {busy ? <Spinner light /> : <Icon name="mail" className="i sm" />}
          {busy ? "Sending…" : "Send invite"}
        </button>
      </div>
    </SheetFrame>
  );
}
