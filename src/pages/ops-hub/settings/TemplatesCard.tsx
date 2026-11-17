import { useCallback, useEffect, useRef, useState } from "react";
import { pmGet, pmPost } from "../../clients/api";
import { Icon } from "../clients/icons";
import { ConfirmModal, fileToBase64 } from "../clients/uiBits";
import { SheetFrame, SheetHead, Spinner, btnH, footStyle } from "../revenue/revenueBits";

type Template = {
  id: string;
  label: string;
  filename: string;
  updated_at: string;
  archived: boolean;
};

function errMsg(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function UploadForm({
  phone,
  busy,
  onClose,
  onSave,
}: {
  phone?: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (label: string, file: File) => void;
}) {
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const head = (
    <SheetHead
      title="Upload contract template"
      lede="A PDF you can pick when sending a contract to a client."
      phone={phone}
      onClose={onClose}
    />
  );
  const fields = (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
      <div className="field">
        <label>Label</label>
        <input
          className="input"
          autoFocus={!phone}
          value={label}
          disabled={busy}
          placeholder="Label"
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>
      <div className="field">
        <label>PDF file</label>
        <div className="drop">
          <Icon name="file" />
          <div style={{ minWidth: 0 }}>
            {file ? (
              <>
                <b>{file.name}</b>
                <div className="meta">PDF · {fmtSize(file.size)}</div>
              </>
            ) : (
              <b>No file chosen</b>
            )}
          </div>
          <button
            type="button"
            className="lnk"
            style={{ marginLeft: "auto" }}
            disabled={busy}
            onClick={() => picker.current?.click()}
          >
            {file ? "Change" : "Choose PDF"}
          </button>
          <input
            ref={picker}
            type="file"
            accept="application/pdf"
            hidden
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>
    </div>
  );
  const foot = (
    <div className="mfoot" style={phone ? footStyle(phone) : undefined}>
      <button type="button" className="btn" disabled={busy} style={btnH(phone)} onClick={onClose}>
        Cancel
      </button>
      <button
        type="button"
        className="btn primary"
        disabled={busy || !file}
        style={btnH(phone, true)}
        onClick={() => file && onSave(label, file)}
      >
        {busy ? <Spinner light /> : null}
        {busy ? "Uploading…" : "Save"}
      </button>
    </div>
  );

  if (phone) {
    return (
      <SheetFrame phone busy={busy} onClose={onClose}>
        {head}
        {fields}
        {foot}
      </SheetFrame>
    );
  }
  return (
    <div className="scrim" style={{ position: "fixed" }} onClick={() => !busy && onClose()}>
      <div className="modal frost" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
        {head}
        {fields}
        {foot}
      </div>
    </div>
  );
}

export function TemplatesCard({
  phone,
  onError,
  onToast,
}: {
  phone?: boolean;
  onError: (msg: string) => void;
  onToast: (msg: string) => void;
}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [upload, setUpload] = useState(false);
  const [deleting, setDeleting] = useState<Template | null>(null);

  const load = useCallback(async () => {
    const data = await pmGet<{ templates: Template[] }>("contract_templates");
    setTemplates(data.templates ?? []);
  }, []);

  useEffect(() => {
    load()
      .catch((e) => onError(errMsg(e, "Could not load contract templates.")))
      .finally(() => setLoading(false));
  }, [load, onError]);

  const create = async (label: string, file: File) => {
    setBusy(true);
    try {
      const contentBase64 = await fileToBase64(file);
      await pmPost("contract_templates", {
        op: "create",
        label: label.trim() || file.name.replace(/\.pdf$/i, ""),
        filename: file.name,
        mime: file.type || "application/pdf",
        contentBase64,
      });
      setUpload(false);
      await load();
      onToast("Template uploaded");
    } catch (e) {
      setUpload(false);
      onError(errMsg(e, "Upload failed."));
    } finally {
      setBusy(false);
    }
  };

  const archive = async (t: Template) => {
    setBusy(true);
    try {
      await pmPost("contract_templates", { op: "archive", id: t.id });
      await load();
      onToast(`${t.label} archived`);
    } catch (e) {
      onError(errMsg(e, "Could not archive."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (t: Template) => {
    setBusy(true);
    try {
      await pmPost("contract_templates", { op: "delete", id: t.id });
      setDeleting(null);
      await load();
      onToast(`${t.label} deleted`);
    } catch (e) {
      setDeleting(null);
      onError(errMsg(e, "Could not delete."));
    } finally {
      setBusy(false);
    }
  };

  const openFile = async (id: string) => {
    try {
      const data = await pmGet<{ url: string }>("contract_template_url", { id });
      if (data.url) window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      onError(errMsg(e, "Could not open file."));
    }
  };

  return (
    <>
      <div className="card" style={{ overflow: "hidden" }}>
        <div className="cardhead">
          <h3>
            <Icon name="file" className="i sm" />
            Contract templates
          </h3>
          <button type="button" className="btn sm" disabled={busy} onClick={() => setUpload(true)}>
            <Icon name="upload" className="i xs" />
            Upload PDF
          </button>
        </div>
        {loading ? (
          <div className="empty" style={{ padding: "36px 16px" }}>
            <span className="refreshing">
              <i className="spin" />
              Loading…
            </span>
          </div>
        ) : templates.length === 0 ? (
          <div className="empty" style={{ padding: "36px 16px" }}>
            <span className="eic">
              <Icon name="file" />
            </span>
            <b style={{ fontSize: "var(--t-sm)" }}>No templates yet.</b>
            <span className="meta">Upload a PDF to use it when sending a contract from Clients.</span>
          </div>
        ) : (
          templates.map((t) => {
            const title = t.filename || t.label;
            return (
              <div key={t.id} className="lrow2 tm-tpl-row">
                <span className="kic">
                  <Icon name="file" className="i sm" />
                </span>
                <div className="t">
                  <b>{title}</b>
                  <span className="meta">
                    {t.label && t.label !== title ? `${t.label} · ` : ""}
                    {fmtDate(t.updated_at) ? `Uploaded ${fmtDate(t.updated_at)}` : ""}
                  </span>
                </div>
                <span className="tm-tpl-acts">
                  <button type="button" className="btn sm" onClick={() => void openFile(t.id)}>
                    View
                  </button>
                  <button type="button" className="btn sm" disabled={busy} onClick={() => void archive(t)}>
                    Archive
                  </button>
                  <button
                    type="button"
                    className="btn sm"
                    title={`Delete ${title}`}
                    aria-label={`Delete ${title}`}
                    disabled={busy}
                    onClick={() => setDeleting(t)}
                  >
                    <Icon name="trash" className="i xs" />
                    Delete
                  </button>
                </span>
              </div>
            );
          })
        )}
      </div>
      {upload ? <UploadForm phone={phone} busy={busy} onClose={() => setUpload(false)} onSave={(l, f) => void create(l, f)} /> : null}
      {deleting ? (
        <ConfirmModal
          phone={phone}
          busy={busy}
          title={`Delete ${deleting.filename || deleting.label}?`}
          body="The template PDF is removed. Contracts already sent with it are not affected."
          confirmLabel="Delete template"
          onCancel={() => setDeleting(null)}
          onConfirm={() => void remove(deleting)}
        />
      ) : null}
    </>
  );
}
