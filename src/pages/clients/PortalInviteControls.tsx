import { useCallback, useEffect, useState } from "react";
import type { ClientRow } from "./api";
import { openHostPortalPreview, pmGet, pmPost } from "./api";
import { FieldLabel, GoldButton, TextInput } from "./ui";
import { SignFieldPlacer } from "./SignFieldPlacer";
import {
  firstNameOf,
  hasHostSignature,
  mrgFields,
  normalizeSignFields,
  type SignField,
} from "../../../shared/pm/signFields";

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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64 || "");
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function inviteDraftKey(clientId: string) {
  return `mrg_invite_${clientId}`;
}

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

export function PortalInviteControls({
  client,
  onError,
  onToast,
}: {
  client: ClientRow;
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
  const [phone, setPhone] = useState(() => saved?.phone || client.phone);
  const [saveAsTemplate, setSaveAsTemplate] = useState(() => Boolean(saved?.saveAsTemplate));
  const [pdfUrl, setPdfUrl] = useState("");
  const [fields, setFields] = useState<SignField[]>(() =>
    normalizeSignFields(saved?.fields),
  );
  const [kind, setKind] = useState<"existing" | "new">(() =>
    saved?.kind === "existing" ? "existing" : "new",
  );
  const [signedFile, setSignedFile] = useState<File | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [replaceId, setReplaceId] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    const data = await pmGet<PortalStatus>("portal_user", { client_id: client.id });
    setStatus(data);
  }, [client.id]);

  useEffect(() => {
    loadStatus().catch(() => setStatus(null));
  }, [loadStatus]);

  // Remount-safe reset when switching clients so layouts never leak across deals.
  useEffect(() => {
    const draft = readInviteDraft(client.id);
    setStatus(null);
    setOpen(Boolean(draft?.open));
    setStep(draft?.open && draft.step === "place" && draft.templateId ? "place" : "form");
    setTemplateId(draft?.templateId || "");
    setOneOff(null);
    setName(draft?.name || client.name);
    setEmail(draft?.email || client.email);
    setPhone(draft?.phone || client.phone);
    setSaveAsTemplate(Boolean(draft?.saveAsTemplate));
    setPdfUrl("");
    setFields(normalizeSignFields(draft?.fields));
    setKind(draft ? (draft.kind === "existing" ? "existing" : "new") : "new");
    setSignedFile(null);
    setReplaceId(null);
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
        phone,
        kind,
        saveAsTemplate,
      };
      sessionStorage.setItem(inviteDraftKey(client.id), JSON.stringify(d));
    } catch {
      /* quota */
    }
  }, [open, step, templateId, fields, name, email, phone, kind, saveAsTemplate, client.id]);

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
      // Always start blank — never reuse another customer's layout or template leftovers.
      setFields([]);
      setReplaceId(null);
      setStep("place");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not open PDF.");
    } finally {
      setBusy(false);
    }
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
        phone,
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
      if (res.email_sent) onToast?.(`Portal access sent · ${res.owner_url}`);
      else onToast?.(`Portal ready · email failed: ${res.email_error || "check Resend"}`);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Invite failed.");
    } finally {
      setBusy(false);
    }
  };

  const hostFirst = firstNameOf(name || client.name) || "the host";

  const sendBlocked = !hasHostSignature(fields)
    ? `Place a Sign here box for ${hostFirst} — that’s where they sign. Date and name boxes aren’t enough.`
    : mrgFields(fields).some((f) => f.type === "signature" && !f.signature_png)
      ? "Click each green MRG Sign here box and draw your signature first."
      : null;

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
        phone,
        sign_fields: fields,
      };
      if (replaceId) {
        body.replace_contract_id = replaceId;
      } else if (oneOff) {
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
      try {
        sessionStorage.removeItem(inviteDraftKey(client.id));
      } catch {
        /* ignore */
      }
      await loadStatus();
      if (res.email_sent) {
        onToast?.(
          replaceId
            ? `Updated agreement sent · ${res.owner_url}`
            : `Invite sent · ${res.owner_url}`,
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

  const portal = status?.portal_user;
  let statusLabel = "Not invited";
  let statusMeta = "Send a portal invite with their agreement PDF";
  if (status?.signed_contracts?.length) {
    statusLabel = "Signed";
    statusMeta = `Signed ${status.signed_contracts[0].signed_on || ""} · copy in portal Documents`;
  } else if (portal?.last_login_at && status?.awaiting_contract) {
    statusLabel = "Opened";
    statusMeta = "Signed in · unsigned";
  } else if (portal?.invited_at && status?.awaiting_contract) {
    statusLabel = "Invited";
    statusMeta = `Sent ${new Date(portal.invited_at).toLocaleDateString()} · awaiting login`;
  } else if (portal?.invited_at) {
    statusLabel = "Portal live";
    statusMeta = status?.owner_url || "";
  } else if (portal) {
    statusLabel = "Not invited";
    statusMeta = `Slug ready · ${status?.owner_url?.replace(/^https?:\/\//, "") || portal.slug}`;
  }

  return (
    <div className="mt-2 border-t border-white/8 py-3.5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-[15px] font-semibold text-[#f5f5f5]">{statusLabel}</div>
          <div className="text-[12.5px] text-[#6f6a65]">{statusMeta}</div>
          {status?.owner_url ? (
            <a
              href={status.owner_url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-[12.5px] font-semibold text-[#c4a35a]"
            >
              {status.owner_url.replace(/^https?:\/\//, "")}
            </a>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => {
              setReplaceId(null);
              setOpen((v) => !v);
              setStep("form");
            }}
            className="rounded-[10px] bg-[#c4a35a] px-3.5 py-2.5 text-[13px] font-bold text-[#0a0a0a]"
          >
            {portal?.invited_at ? "Resend invite" : "Send portal invite"}
          </button>
          {status?.awaiting_contract ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void startEdit()}
              className="text-[12.5px] font-semibold text-[#c4a35a] disabled:opacity-50"
            >
              {busy && replaceId ? "Opening…" : "Edit agreement"}
            </button>
          ) : null}
          <button
            type="button"
            disabled={previewBusy}
            onClick={() => void previewAsHost()}
            className="text-[12.5px] font-semibold text-[#c4a35a] disabled:opacity-50"
          >
            {previewBusy ? "Opening…" : "Preview as host"}
          </button>
        </div>
      </div>

      {open && step === "form" ? (
        <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-[#141414] p-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setKind("existing")}
              className={`flex-1 rounded-lg py-2.5 text-[13px] font-semibold ${
                kind === "existing"
                  ? "bg-[#c4a35a] text-[#0a0a0a]"
                  : "border border-white/12 text-[#9a9590]"
              }`}
            >
              Existing host
            </button>
            <button
              type="button"
              onClick={() => setKind("new")}
              className={`flex-1 rounded-lg py-2.5 text-[13px] font-semibold ${
                kind === "new"
                  ? "bg-[#c4a35a] text-[#0a0a0a]"
                  : "border border-white/12 text-[#9a9590]"
              }`}
            >
              New — sign contract
            </button>
          </div>
          <p className="text-[13px] text-[#9a9590]">
            {kind === "existing"
              ? "Already signed offline. Sends portal login only — they will not be asked to sign again. Optionally attach their signed PDF for Documents."
              : `New client. Place boxes for ${hostFirst} to fill later, and MRG boxes for you to sign/type before sending.`}
          </p>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Name</FieldLabel>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Email</FieldLabel>
            <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Phone</FieldLabel>
            <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          {kind === "existing" ? (
            <>
              <div className="flex flex-col gap-1.5">
                <FieldLabel optional>Signed contract PDF</FieldLabel>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setSignedFile(e.target.files?.[0] ?? null)}
                  className="text-sm text-[#9a9590]"
                />
                <p className="text-[12px] text-[#6f6a65]">
                  Optional — also available under Contracts on this client. They’ll see it in
                  Documents.
                </p>
              </div>
              <GoldButton
                type="button"
                disabled={busy || !email.trim()}
                onClick={() => void sendExisting()}
              >
                {busy ? "Sending…" : "Send portal access"}
              </GoldButton>
            </>
          ) : null}
          {kind === "new" ? (
            <>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Agreement template</FieldLabel>
            <select
              value={oneOff ? "" : templateId}
              disabled={Boolean(oneOff)}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full rounded-[9px] border border-white/10 bg-[#1c1c1c] px-3.5 py-3 text-[15px] text-[#f5f5f5] outline-none focus:border-[#c4a35a]/55"
            >
              <option value="">Select template</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel optional>Or upload PDF for this deal only</FieldLabel>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setOneOff(e.target.files?.[0] ?? null)}
              className="text-sm text-[#9a9590]"
            />
            {oneOff ? (
              <label className="flex items-center gap-2 text-[13px] text-[#9a9590]">
                <input
                  type="checkbox"
                  checked={saveAsTemplate}
                  onChange={(e) => setSaveAsTemplate(e.target.checked)}
                />
                Also save to Contract templates
              </label>
            ) : null}
          </div>
          <GoldButton
            type="button"
            disabled={busy || !email.trim() || (!templateId && !oneOff)}
            onClick={() => void startPlace()}
          >
            {busy ? "Opening PDF…" : "Next: place fields & sign"}
          </GoldButton>
            </>
          ) : null}
          <button type="button" className="text-[13px] text-[#9a9590]" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      ) : null}

      {open && step === "place" && pdfUrl ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#0a0a0a] text-[#f5f5f5]">
          <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="text-[15px] font-semibold">
                {replaceId ? "Edit agreement" : "Prepare agreement"}
              </div>
              <div className="hidden text-[12.5px] text-[#6f6a65] sm:block">
                {replaceId
                  ? "Same PDF and boxes as the version already sent. Move or redraw, then replace — the host only sees the new one."
                  : <>
                {hostFirst}’s boxes = they fill later. MRG boxes = you sign and type now. Use{" "}
                <span className="text-[#c4a35a]">Move</span> to grab and reposition · pick a field type
                to place · Escape switches back to Move.
                  </>}
              </div>
            </div>
            <div className="flex flex-col items-stretch gap-1 sm:items-end">
              <div className="flex items-center justify-between gap-3 sm:justify-end">
              <button
                type="button"
                className="text-[13px] text-[#9a9590]"
                onClick={() => {
                  if (replaceId) {
                    setOpen(false);
                    setStep("form");
                    setReplaceId(null);
                    setPdfUrl("");
                    return;
                  }
                  setStep("form");
                }}
              >
                Back
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void send()}
                className="rounded-lg bg-[#c4a35a] px-4 py-2 text-[13px] font-bold text-[#0a0a0a] disabled:opacity-40"
              >
                {busy ? (replaceId ? "Replacing…" : "Sending…") : replaceId ? "Replace & resend" : "Send invite"}
              </button>
              </div>
              {sendBlocked ? (
                <p className="max-w-[280px] text-right text-[12px] leading-snug text-[#dcc084]">
                  {sendBlocked}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <SignFieldPlacer
              pdfUrl={pdfUrl}
              fields={fields}
              onChange={setFields}
              mrgNameHint="Mandel Realty Group"
              hostNameHint={name.trim() || client.name}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
