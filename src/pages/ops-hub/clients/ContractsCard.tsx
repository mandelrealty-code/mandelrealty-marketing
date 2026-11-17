import { useCallback, useEffect, useState } from "react";
import { pmGet, pmPost } from "../../clients/api";
import { formatDisplayDate, todayInputValue } from "../../clients/format";
import { Icon } from "./icons";
import { ConfirmModal, fileToBase64 } from "./uiBits";

type Contract = {
  id: string;
  title: string;
  filename: string;
  signed_on: string | null;
  status: string;
  created_at: string;
};

export function ContractsCard({
  clientId,
  propertyId,
  propertyName,
  phone,
  onError,
  onToast,
}: {
  clientId?: string | null;
  propertyId?: string | null;
  /** Used in the delete confirm body when deleting from a property. */
  propertyName?: string;
  phone?: boolean;
  onError: (msg: string) => void;
  onToast?: (msg: string) => void;
}) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [signedOn, setSignedOn] = useState(todayInputValue());
  const [file, setFile] = useState<File | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Contract | null>(null);

  const load = useCallback(async () => {
    const q: Record<string, string> = {};
    if (clientId) q.client_id = clientId;
    if (propertyId) q.property_id = propertyId;
    const data = await pmGet<{ contracts: Contract[] }>("contracts", q);
    setContracts(data.contracts ?? []);
  }, [clientId, propertyId]);

  useEffect(() => {
    load().catch((e) => onError(e instanceof Error ? e.message : "Could not load contracts."));
  }, [load, onError]);

  const upload = async () => {
    if (!file) {
      onError("Choose a PDF or image to upload.");
      return;
    }
    setBusy(true);
    try {
      const contentBase64 = await fileToBase64(file);
      await pmPost("contracts", {
        op: "create",
        client_id: clientId || undefined,
        property_id: propertyId || undefined,
        title: title.trim() || file.name,
        filename: file.name,
        mime: file.type || "application/pdf",
        contentBase64,
        signed_on: signedOn || null,
        status: "signed",
      });
      setTitle("");
      setFile(null);
      setSignedOn(todayInputValue());
      setUploadOpen(false);
      await load();
      onToast?.("Contract uploaded");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  const openFile = async (id: string) => {
    try {
      const data = await pmGet<{ url: string }>("contract_url", { id });
      if (data.url) window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not open file.");
    }
  };

  const remove = async (c: Contract) => {
    setBusy(true);
    try {
      await pmPost("contracts", { op: "delete", id: c.id });
      setPendingDelete(null);
      await load();
      onToast?.("Contract deleted");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not delete.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="card">
        <div className="cardhead">
          <h3>
            <Icon name="file" className="i sm" />
            Contracts
          </h3>
          <button type="button" className="btn sm" onClick={() => setUploadOpen(true)}>
            <Icon name="upload" className="i xs" />
            Upload
          </button>
        </div>
        {contracts.length === 0 ? (
          <div className="empty" style={{ padding: "22px 16px" }}>
            <b style={{ fontSize: "var(--t-sm)" }}>No signed contracts yet</b>
            <span className="meta">
              {propertyId
                ? "Upload a signed PDF with its title and date."
                : "Upload a signed PDF, or send a contract from the portal invite."}
            </span>
          </div>
        ) : (
          contracts.map((c) => (
            <div key={c.id} className="lrow2">
              <span className="kic">
                <Icon name="file" className="i sm" />
              </span>
              <div className="t">
                <b>{c.filename || `${c.title}.pdf`}</b>
                <span className="meta">
                  {c.signed_on ? `Signed ${formatDisplayDate(c.signed_on)}` : c.status}
                </span>
              </div>
              <button type="button" className="btn sm" onClick={() => void openFile(c.id)}>
                Open
              </button>
              <button
                type="button"
                className="iconbtn"
                disabled={busy}
                aria-label="Delete contract"
                onClick={() => setPendingDelete(c)}
              >
                <Icon name="trash" className="i sm" />
              </button>
            </div>
          ))
        )}
      </div>

      {uploadOpen ? (
        <div
          className={`scrim${phone ? " bottom" : ""}`}
          style={{ position: "fixed" }}
          onClick={() => !busy && setUploadOpen(false)}
        >
          <div
            className={`${phone ? "sheet" : "modal"} frost`}
            style={phone ? undefined : { width: 480 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: phone ? 18 : 20, fontWeight: 650 }}>Upload signed contract</h2>
            <p className="lede" style={{ fontSize: "var(--t-sm)", margin: "4px 0 16px" }}>
              {propertyId
                ? "Adds a signed PDF to this property. Nothing is sent."
                : "Adds a signed PDF to this client. Nothing is sent."}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="field">
                <label>Title</label>
                <input
                  className="input"
                  value={title}
                  placeholder="Management agreement"
                  disabled={busy}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Signed on</label>
                <input
                  className="input"
                  type="date"
                  value={signedOn}
                  disabled={busy}
                  onChange={(e) => setSignedOn(e.target.value)}
                />
              </div>
              <div className="field">
                <label>File</label>
                <label className="drop" style={{ cursor: "pointer" }}>
                  <Icon name="file" />
                  <div>
                    <b>{file ? file.name : "Choose a PDF"}</b>
                    <div className="meta">
                      {file
                        ? `${file.type || "File"} · ${Math.max(1, Math.round(file.size / 1024))} KB`
                        : "PDF or image · max 10MB"}
                    </div>
                  </div>
                  <span className="lnk" style={{ marginLeft: "auto" }}>
                    {file ? "Change" : "Browse"}
                  </span>
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    disabled={busy}
                    hidden
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </div>
            <div className="mfoot" style={phone ? { flexDirection: "column-reverse", gap: 8 } : undefined}>
              <button
                type="button"
                className="btn"
                disabled={busy}
                style={phone ? { height: 44 } : undefined}
                onClick={() => setUploadOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={busy || !file}
                style={phone ? { height: 48 } : undefined}
                onClick={() => void upload()}
              >
                <Icon name="upload" className="i sm" />
                {busy ? "Uploading…" : "Upload"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingDelete ? (
        <ConfirmModal
          phone={phone}
          title={`Delete ${pendingDelete.filename || `${pendingDelete.title}.pdf`}?`}
          body={
            propertyName
              ? `The signed PDF is removed from ${propertyName}. It can’t be undone.`
              : "The signed PDF is removed from this client. It can’t be undone."
          }
          confirmLabel="Delete contract"
          busy={busy}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void remove(pendingDelete)}
        />
      ) : null}
    </>
  );
}
