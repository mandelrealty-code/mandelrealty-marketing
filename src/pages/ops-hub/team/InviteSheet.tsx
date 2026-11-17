import { useState } from "react";
import { Icon } from "../clients/icons";
import { SheetFrame, SheetHead, Spinner, btnH, footStyle } from "../revenue/revenueBits";

export function InviteSheet({
  phone,
  busy,
  initialName = "",
  prefilled,
  onClose,
  onSend,
}: {
  phone?: boolean;
  busy?: boolean;
  initialName?: string;
  /** True when opened from Send login on the Staff types roster. */
  prefilled?: boolean;
  onClose: () => void;
  onSend: (email: string, displayName: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState("");
  const ready = Boolean(name.trim() && email.trim());

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
          onClick={() => onSend(email.trim(), name.trim())}
        >
          {busy ? <Spinner light /> : <Icon name="mail" className="i sm" />}
          {busy ? "Sending…" : "Send invite"}
        </button>
      </div>
    </SheetFrame>
  );
}
