import { useCallback, useEffect, useState } from "react";
import type { ClientRow } from "./api";
import { pmGet, pmPost } from "./api";
import { FieldLabel, GoldButton, TextInput } from "./ui";

type Template = { id: string; label: string; filename: string };

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
  awaiting_contract: { id: string; title: string; status: string } | null;
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

export function PortalInviteControls({
  client,
  onError,
  onToast,
}: {
  client: ClientRow;
  onError: (msg: string) => void;
  onToast?: (msg: string) => void;
}) {
  const [status, setStatus] = useState<PortalStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [oneOff, setOneOff] = useState<File | null>(null);
  const [name, setName] = useState(client.name);
  const [email, setEmail] = useState(client.email);
  const [phone, setPhone] = useState(client.phone);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);

  const loadStatus = useCallback(async () => {
    const data = await pmGet<PortalStatus>("portal_user", { client_id: client.id });
    setStatus(data);
  }, [client.id]);

  useEffect(() => {
    loadStatus().catch(() => setStatus(null));
  }, [loadStatus]);

  useEffect(() => {
    if (!open) return;
    pmGet<{ templates: Template[] }>("contract_templates")
      .then((d) => {
        setTemplates(d.templates ?? []);
        if (d.templates?.[0] && !templateId) setTemplateId(d.templates[0].id);
      })
      .catch((e) => onError(e instanceof Error ? e.message : "Could not load templates."));
  }, [open, onError, templateId]);

  const send = async () => {
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        op: "send",
        client_id: client.id,
        name,
        email,
        phone,
      };
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
      const res = await pmPost<{
        owner_url: string;
        email_sent: boolean;
        email_error?: string | null;
      }>("portal_invite", body);
      setOpen(false);
      setOneOff(null);
      await loadStatus();
      if (res.email_sent) onToast?.(`Invite sent · ${res.owner_url}`);
      else onToast?.(`Portal ready · email failed: ${res.email_error || "check Resend"}`);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Invite failed.");
    } finally {
      setBusy(false);
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
  } else if (portal && !status?.awaiting_contract) {
    statusLabel = "Portal live";
    statusMeta = status?.owner_url || "";
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
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 rounded-[10px] bg-[#c4a35a] px-3.5 py-2.5 text-[13px] font-bold text-[#0a0a0a]"
        >
          {portal ? "Resend invite" : "Send portal invite"}
        </button>
      </div>

      {open ? (
        <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-[#141414] p-4">
          <p className="text-[13px] text-[#9a9590]">
            Creates portal login, emails temp password, host signs the PDF after login.
          </p>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Name</FieldLabel>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Email</FieldLabel>
            <TextInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Phone</FieldLabel>
            <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
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
            onClick={send}
          >
            {busy ? "Sending…" : "Send invite"}
          </GoldButton>
          <button
            type="button"
            className="text-[13px] text-[#9a9590]"
            onClick={() => setOpen(false)}
          >
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
}
