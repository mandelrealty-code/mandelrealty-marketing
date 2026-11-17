import { useCallback, useEffect, useState } from "react";
import type { ClientRow } from "../../clients/api";
import { openHostPortalPreview, pmGet, pmPost } from "../../clients/api";
import {
  firstNameOf,
  hasHostSignature,
  mrgFields,
  normalizeSignFields,
  type SignField,
} from "../../../../shared/pm/signFields";
import { Icon } from "./icons";
import { Chip, fileToBase64 } from "./uiBits";
import { SignPlaceScreen } from "./SignPlaceScreen";

type Template = {
  id: string;
  label: string;
  filename: string;
  sign_fields?: SignField[];
};

type PortalStatus = {
  portal_user: {
    slug: string;
    email: string;
    first_name: string;
    invited_at: string | null;
    last_login_at: string | null;
    must_change_password: boolean;
  } | null;
  owner_url: string | null;
  awaiting_contract: {
    id: string;
    title: string;
    status: string;
    template_id?: string | null;
    sign_fields?: SignField[];
  } | null;
  signed_contracts?: Array<{ id: string; title: string; signed_on: string | null }>;
};

type InviteDraft = {
  open: boolean;
  step: "form" | "place";
  templateId: string;
  fields: SignField[];
  name: string;
  email: string;
  phone: string;
  kind: "existing" | "new";
  saveAsTemplate: boolean;
};

function inviteDraftKey(clientId: string) {
  return `mrg_invite_${clientId}`;
}

function readInviteDraft(clientId: string): InviteDraft | null {
  try {
    const raw = sessionStorage.getItem(inviteDraftKey(clientId));
    if (!raw) return null;
    const d = JSON.parse(raw) as InviteDraft;
    if (!d || typeof d !== "object") return null;
    return d;
  } catch {
    return null;
  }
}

const ORDER = ["none", "invited", "opened", "signed", "live"] as const;
type PortalKey = (typeof ORDER)[number];

function portalKey(status: PortalStatus | null): PortalKey {
  const portal = status?.portal_user;
  if (status?.signed_contracts?.length && !status.awaiting_contract && portal?.last_login_at) return "live";
  if (status?.signed_contracts?.length && !status.awaiting_contract) return "signed";
  if (portal?.last_login_at && status?.awaiting_contract) return "opened";
  if (portal?.invited_at && status?.awaiting_contract) return "invited";
  if (portal?.invited_at && !status?.awaiting_contract) return "live";
  if (status?.signed_contracts?.length) return "signed";
  return "none";
}

const PS: Record<PortalKey, [string, number, number, string]> = {
  none: ["Not invited", 270, 0.02, "No portal invite has been sent."],
  invited: ["Invited", 255, 0.14, "Invite sent. Not opened yet."],
  opened: ["Opened", 65, 0.14, "Invite opened. Contract awaiting the host’s signature."],
  signed: ["Signed", 185, 0.11, "Contract signed. Host has not signed in yet."],
  live: ["Portal live", 155, 0.13, "Contract signed. Host has signed in."],
};

export function PortalCard({
  client,
  phone,
  onError,
  onToast,
}: {
  client: ClientRow;
  phone?: boolean;
  onError: (msg: string) => void;
  onToast?: (msg: string) => void;
}) {
  const saved = readInviteDraft(client.id);
  const [status, setStatus] = useState<PortalStatus | null>(null);
  const [open, setOpen] = useState(() => Boolean(saved?.open));
  const [step, setStep] = useState<"form" | "place">(() =>
    saved?.open && saved.step === "place" && saved.templateId ? "place" : "form",
  );
  const [busy, setBusy] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState(() => saved?.templateId || "");
  const [oneOff, setOneOff] = useState<File | null>(null);
  const [name, setName] = useState(() => saved?.name || client.name);
  const [email, setEmail] = useState(() => saved?.email || client.email);
  const [phoneVal, setPhoneVal] = useState(() => saved?.phone || client.phone);
  const [saveAsTemplate, setSaveAsTemplate] = useState(() => Boolean(saved?.saveAsTemplate));
  const [pdfUrl, setPdfUrl] = useState("");
  const [fields, setFields] = useState<SignField[]>(() => normalizeSignFields(saved?.fields));
  const [kind, setKind] = useState<"existing" | "new">(() =>
    saved?.kind === "existing" ? "existing" : "new",
  );
  const [signedFile, setSignedFile] = useState<File | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [replaceId, setReplaceId] = useState<string | null>(null);
  const [newPdfReplace, setNewPdfReplace] = useState(false);

  const loadStatus = useCallback(async () => {
    const data = await pmGet<PortalStatus>("portal_user", { client_id: client.id });
    setStatus(data);
  }, [client.id]);

  useEffect(() => {
    loadStatus().catch(() => setStatus(null));
  }, [loadStatus]);

  useEffect(() => {
    const draft = readInviteDraft(client.id);
    setStatus(null);
    setOpen(Boolean(draft?.open));
    setStep(draft?.open && draft.step === "place" && draft.templateId ? "place" : "form");
    setTemplateId(draft?.templateId || "");
    setOneOff(null);
    setName(draft?.name || client.name);
    setEmail(draft?.email || client.email);
    setPhoneVal(draft?.phone || client.phone);
    setSaveAsTemplate(Boolean(draft?.saveAsTemplate));
    setPdfUrl("");
    setFields(normalizeSignFields(draft?.fields));
    setKind(draft ? (draft.kind === "existing" ? "existing" : "new") : "new");
    setSignedFile(null);
    setReplaceId(null);
    setNewPdfReplace(false);
  }, [client.id, client.name, client.email, client.phone]);

  useEffect(() => {
    try {
      const d: InviteDraft = {
        open,
        step,
        templateId,
        fields,
        name,
        email,
        phone: phoneVal,
        kind,
        saveAsTemplate,
      };
      sessionStorage.setItem(inviteDraftKey(client.id), JSON.stringify(d));
    } catch {
      /* quota */
    }
  }, [open, step, templateId, fields, name, email, phoneVal, kind, saveAsTemplate, client.id]);

  useEffect(() => {
    if (!open || step !== "place" || !templateId || pdfUrl) return;
    let cancelled = false;
    pmGet<{ url: string }>("contract_template_url", { id: templateId })
      .then((data) => {
        if (!cancelled && data.url) setPdfUrl(data.url);
      })
      .catch((e) => {
        if (!cancelled) {
          setStep("form");
          onError(e instanceof Error ? e.message : "Could not reopen the PDF.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, step, templateId, pdfUrl, onError]);

  useEffect(() => {
    if (!open) return;
    pmGet<{ templates: Template[] }>("contract_templates")
      .then((d) => {
        setTemplates(d.templates ?? []);
        if (d.templates?.[0] && !templateId) setTemplateId(d.templates[0].id);
      })
      .catch((e) => onError(e instanceof Error ? e.message : "Could not load templates."));
  }, [open, onError, templateId]);

  const startPlace = async () => {
    setBusy(true);
    try {
      if (oneOff) {
        setPdfUrl(URL.createObjectURL(oneOff));
      } else if (templateId) {
        const data = await pmGet<{ url: string }>("contract_template_url", { id: templateId });
        if (!data.url) throw new Error("Could not open template PDF.");
        setPdfUrl(data.url);
      } else {
        throw new Error("Pick a template or upload a PDF.");
      }
      setFields([]);
      if (replaceId) setNewPdfReplace(true);
      setStep("place");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not open PDF.");
    } finally {
      setBusy(false);
    }
  };

  const startReplace = () => {
    const awaiting = status?.awaiting_contract;
    if (!awaiting?.id) {
      onError("No unsigned agreement to replace.");
      return;
    }
    setReplaceId(awaiting.id);
    setNewPdfReplace(true);
    setKind("new");
    setOneOff(null);
    setPdfUrl("");
    setFields([]);
    setTemplateId("");
    setOpen(true);
    setStep("form");
  };

  const startEdit = async () => {
    const awaiting = status?.awaiting_contract;
    if (!awaiting?.id) {
      onError("No unsigned agreement to edit.");
      return;
    }
    setBusy(true);
    try {
      const data = await pmGet<{ url: string }>("contract_url", {
        id: awaiting.id,
        source: "1",
      });
      if (!data.url) throw new Error("Could not open the agreement PDF.");
      setPdfUrl(data.url);
      setFields(normalizeSignFields(awaiting.sign_fields));
      setTemplateId(awaiting.template_id || "");
      setOneOff(null);
      setReplaceId(awaiting.id);
      setNewPdfReplace(false);
      setKind("new");
      setOpen(true);
      setStep("place");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not reopen the agreement.");
    } finally {
      setBusy(false);
    }
  };

  const sendExisting = async () => {
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        op: "send",
        existing_host: true,
        client_id: client.id,
        name,
        email,
        phone: phoneVal,
      };
      if (signedFile) {
        body.signed_filename = signedFile.name;
        body.signed_mime = signedFile.type || "application/pdf";
        body.signed_contentBase64 = await fileToBase64(signedFile);
        body.signed_title = signedFile.name.replace(/\.pdf$/i, "");
      }
      const res = await pmPost<{
        owner_url: string;
        email_sent: boolean;
        email_error?: string | null;
      }>("portal_invite", body);
      setOpen(false);
      setSignedFile(null);
      try {
        sessionStorage.removeItem(inviteDraftKey(client.id));
      } catch {
        /* ignore */
      }
      await loadStatus();
      if (res.email_sent) onToast?.(`Invite sent to ${email || name}`);
      else onToast?.(`Portal ready · email failed: ${res.email_error || "check Resend"}`);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Invite failed.");
    } finally {
      setBusy(false);
    }
  };

  const hostFirst = firstNameOf(name || client.name) || "the host";

  const send = async () => {
    if (!hasHostSignature(fields)) {
      onError(`Place at least one signature box for ${hostFirst} — that’s where they sign.`);
      return;
    }
    if (mrgFields(fields).some((f) => f.type === "signature" && !f.signature_png)) {
      onError("Click each MRG signature box and draw your signature before sending.");
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        op: "send",
        client_id: client.id,
        name,
        email,
        phone: phoneVal,
        sign_fields: fields,
      };
      if (replaceId) body.replace_contract_id = replaceId;
      if (newPdfReplace || !replaceId) {
        if (oneOff) {
          body.filename = oneOff.name;
          body.mime = oneOff.type || "application/pdf";
          body.contentBase64 = await fileToBase64(oneOff);
          body.title = oneOff.name.replace(/\.pdf$/i, "");
          body.save_as_template = saveAsTemplate;
        } else if (templateId) {
          body.template_id = templateId;
        } else {
          throw new Error("Pick a template or upload a PDF.");
        }
      }
      const res = await pmPost<{
        owner_url: string;
        email_sent: boolean;
        email_error?: string | null;
      }>("portal_invite", body);
      setOpen(false);
      setStep("form");
      setOneOff(null);
      setFields([]);
      setReplaceId(null);
      setNewPdfReplace(false);
      try {
        sessionStorage.removeItem(inviteDraftKey(client.id));
      } catch {
        /* ignore */
      }
      await loadStatus();
      if (res.email_sent) {
        onToast?.(
          replaceId
            ? `Updated agreement sent to ${email || name}`
            : `Invite sent to ${email || name}`,
        );
      } else onToast?.(`Portal ready · email failed: ${res.email_error || "check Resend"}`);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Invite failed.");
    } finally {
      setBusy(false);
    }
  };

  const previewAsHost = async () => {
    setPreviewBusy(true);
    try {
      await openHostPortalPreview(client.id);
      await loadStatus();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not open preview.");
    } finally {
      setPreviewBusy(false);
    }
  };

  const key = portalKey(status);
  const [label, h, c, desc] = PS[key];
  const idx = ORDER.indexOf(key);
  const awaiting = key === "invited" || key === "opened";
  const ownerUrl = status?.owner_url;

  const openInvite = () => {
    setReplaceId(null);
    setNewPdfReplace(false);
    setOpen(true);
    setStep("form");
  };

  const copyUrl = async () => {
    if (!ownerUrl) return;
    try {
      await navigator.clipboard.writeText(ownerUrl);
      onToast?.("Owner URL copied");
    } catch {
      onError("Could not copy URL.");
    }
  };

  const inviteForm = (
    <>
      <h2 style={{ fontSize: phone ? 18 : 20, fontWeight: 650 }}>
        {key === "none" ? "Send portal invite" : "Resend invite"}
      </h2>
      <p className="lede" style={{ fontSize: "var(--t-sm)", margin: "4px 0 16px" }}>
        This sends a real email to the host.
      </p>
      {replaceId ? (
        <div className="warnbox" style={{ marginBottom: 14 }}>
          <Icon name="alert" className="i sm" />
          <span>
            <b>Replace unsigned contract.</b> Pick a template or upload a new PDF. The old unsigned copy is removed; they keep their login.
          </span>
        </div>
      ) : (
        <div className="opt" style={phone ? { gridTemplateColumns: "1fr" } : undefined}>
          <button type="button" className={kind === "existing" ? "on" : undefined} onClick={() => setKind("existing")}>
            <span className={`radio${kind === "existing" ? " on" : ""}`} />
            <span>
              <b>Existing host</b>
              Already signed. Gives them portal access.
            </span>
          </button>
          <button type="button" className={kind === "new" ? "on" : undefined} onClick={() => setKind("new")}>
            <span className={`radio${kind === "new" ? " on" : ""}`} />
            <span>
              <b>New, sign contract</b>
              Place fields on a contract, then invite them to sign.
            </span>
          </button>
        </div>
      )}
      {!replaceId ? (
        <div className="fgrid" style={phone ? { gridTemplateColumns: "1fr" } : undefined}>
          <div className="field full">
            <label>Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label>Phone</label>
            <input className="input" value={phoneVal} onChange={(e) => setPhoneVal(e.target.value)} />
          </div>
        </div>
      ) : null}
      {!replaceId && kind === "existing" ? (
        <div className="field" style={{ marginTop: 14 }}>
          <label>
            Signed contract PDF <em>(optional)</em>
          </label>
          <label className="drop" style={{ cursor: "pointer" }}>
            <Icon name="upload" />
            <div>
              <b>{signedFile ? signedFile.name : "Choose a PDF"}</b>
              <div className="meta">Saved to this client’s contracts</div>
            </div>
            <input
              type="file"
              accept="application/pdf"
              hidden
              onChange={(e) => setSignedFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      ) : null}
      {(replaceId || kind === "new") ? (
        <>
          <div className="field" style={{ marginTop: 14 }}>
            <label>Agreement template</label>
            <select
              className="input"
              value={oneOff ? "" : templateId}
              disabled={Boolean(oneOff)}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              <option value="">Select template</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
            <span className="meta">or</span>
            <label className="btn sm" style={{ cursor: "pointer" }}>
              <Icon name="upload" className="i xs" />
              Or upload PDF…
              <input
                type="file"
                accept="application/pdf"
                hidden
                onChange={(e) => setOneOff(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          {oneOff ? (
            <label className="cbrow">
              <button
                type="button"
                className={`cbx${saveAsTemplate ? " on" : ""}`}
                onClick={() => setSaveAsTemplate((v) => !v)}
                aria-pressed={saveAsTemplate}
              >
                {saveAsTemplate ? <Icon name="check" className="i xs" /> : null}
              </button>
              Also save to Contract templates
            </label>
          ) : null}
        </>
      ) : null}
      <div className="mfoot" style={phone ? { flexDirection: "column-reverse", gap: 8 } : undefined}>
        <button
          type="button"
          className="btn"
          style={phone ? { height: 44 } : undefined}
          onClick={() => {
            setOpen(false);
            setReplaceId(null);
            setNewPdfReplace(false);
            setStep("form");
          }}
        >
          Cancel
        </button>
        {!replaceId && kind === "existing" ? (
          <button
            type="button"
            className="btn primary"
            style={phone ? { height: 48 } : undefined}
            disabled={busy || !email.trim()}
            onClick={() => void sendExisting()}
          >
            <Icon name="mail" className="i sm" />
            {busy ? "Sending…" : "Send portal access"}
          </button>
        ) : (
          <button
            type="button"
            className="btn primary"
            style={phone ? { height: 48 } : undefined}
            disabled={busy || (!replaceId && !email.trim()) || (!templateId && !oneOff)}
            onClick={() => void startPlace()}
          >
            {busy ? "Opening PDF…" : (
              <>
                Next: place fields & sign
                <Icon name="arrow" className="i sm" />
              </>
            )}
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
      <div className="card">
        <div className="cardhead">
          <h3>
            <Icon name="key" className="i sm" />
            Host portal and contract
          </h3>
          <Chip h={h} c={c}>
            {label}
          </Chip>
        </div>
        <div className="cardbody">
          <div className="track">
            {ORDER.map((x, i) => (
              <i key={x} className={idx > 0 && i <= idx ? "on" : undefined} />
            ))}
          </div>
          <div className="tracklab tracklab-readable">
            {["Not invited", "Invited", "Opened", "Signed", "Portal live"].map((x, i) => (
              <span key={x} className={i === idx ? "on" : undefined}>
                {x}
              </span>
            ))}
          </div>
          <p className="pdesc">{desc}</p>
          {ownerUrl ? (
            <div className="linkrow">
              <Icon name="link" className="i sm" />
              <a className="u" href={ownerUrl} target="_blank" rel="noreferrer">
                {ownerUrl.replace(/^https?:\/\//, "")}
              </a>
              <button type="button" className="iconbtn" style={{ width: 32, height: 32 }} onClick={() => void copyUrl()} aria-label="Copy URL">
                <Icon name="copy" className="i sm" />
              </button>
            </div>
          ) : null}
          <div className="pbtns">
            {key !== "none" ? (
              <button type="button" className="btn" disabled={previewBusy} onClick={() => void previewAsHost()}>
                <Icon name="eye" className="i sm" />
                {previewBusy ? "Opening…" : "Preview as host"}
              </button>
            ) : null}
            {awaiting ? (
              <>
                <button type="button" className="btn" disabled={busy} onClick={() => startReplace()}>
                  <Icon name="file" className="i sm" />
                  Replace contract
                </button>
                <button type="button" className="btn" disabled={busy} onClick={() => void startEdit()}>
                  <Icon name="edit" className="i sm" />
                  Edit boxes only
                </button>
              </>
            ) : null}
            <button
              type="button"
              className={`btn${key === "none" ? " primary" : ""}`}
              onClick={openInvite}
            >
              <Icon name="mail" className="i sm" />
              {key === "none" ? "Send portal invite" : "Resend invite"}
            </button>
          </div>
          <div className="hint" style={{ marginTop: 10 }}>
            <Icon name="mail" className="i xs" />
            Sends a real email to the host. It only goes out from the invite form.
          </div>
        </div>
      </div>

      {open && step === "form" ? (
        <div
          className={`scrim${phone ? " bottom" : ""}`}
          style={{ position: "fixed" }}
          onClick={() => {
            setOpen(false);
            setReplaceId(null);
            setNewPdfReplace(false);
          }}
        >
          <div
            className={`${phone ? "sheet" : "modal"} frost`}
            style={phone ? { maxHeight: "90dvh", overflow: "auto" } : { width: 600 }}
            onClick={(e) => e.stopPropagation()}
          >
            {inviteForm}
          </div>
        </div>
      ) : null}

      {open && step === "place" && pdfUrl ? (
        <SignPlaceScreen
          pdfUrl={pdfUrl}
          fields={fields}
          onChange={setFields}
          mrgNameHint="Mandel Realty Group"
          hostNameHint={name.trim() || client.name}
          subtitle={[
            templates.find((t) => t.id === templateId)?.label || oneOff?.name || status?.awaiting_contract?.title || "Agreement",
            name || client.name,
          ].join(" · ")}
          replaceMode={Boolean(replaceId)}
          busy={busy}
          phone={phone}
          onBack={() => {
            if (replaceId) {
              setOpen(false);
              setStep("form");
              setReplaceId(null);
              setNewPdfReplace(false);
              setPdfUrl("");
              return;
            }
            setStep("form");
          }}
          onSend={() => void send()}
        />
      ) : null}
    </>
  );
}
