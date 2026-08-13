import { useCallback, useEffect, useState } from "react";
import { pmGet, pmPost } from "./api";
import { FieldLabel, TextInput } from "./ui";

type Template = {
  id: string;
  label: string;
  filename: string;
  updated_at: string;
  archived: boolean;
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

export function ContractTemplatesPanel({
  onError,
}: {
  onError: (msg: string) => void;
}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");

  const load = useCallback(async () => {
    const data = await pmGet<{ templates: Template[] }>("contract_templates");
    setTemplates(data.templates ?? []);
  }, []);

  useEffect(() => {
    load().catch((e) =>
      onError(e instanceof Error ? e.message : "Could not load contract templates."),
    );
  }, [load, onError]);

  const upload = async (file: File | null) => {
    if (!file) return;
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
      setLabel("");
      setOpen(false);
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  const archive = async (id: string) => {
    setBusy(true);
    try {
      await pmPost("contract_templates", { op: "archive", id });
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not archive.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string, label: string) => {
    if (!window.confirm(`Delete “${label}”? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await pmPost("contract_templates", { op: "delete", id });
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not delete.");
    } finally {
      setBusy(false);
    }
  };

  const openFile = async (id: string) => {
    try {
      const data = await pmGet<{ url: string }>("contract_template_url", { id });
      if (data.url) window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not open file.");
    }
  };

  return (
    <div className="border-t border-white/8 px-4 py-5 lg:px-1">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold text-[#f5f5f5]">Contract templates</p>
          <p className="text-[13px] text-[#9a9590]">
            Reusable PDFs for portal invites. Pick one when inviting a host, or upload a one-off.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 rounded-lg bg-[#c4a35a] px-3.5 py-2 text-[13px] font-bold text-[#0a0a0a]"
        >
          Upload PDF
        </button>
      </div>

      {open ? (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-white/10 bg-[#141414] p-4">
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Label</FieldLabel>
            <TextInput
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Standard management 20%"
            />
          </div>
          <input
            type="file"
            accept="application/pdf"
            disabled={busy}
            onChange={(e) => void upload(e.target.files?.[0] ?? null)}
            className="text-sm text-[#9a9590] file:mr-3 file:rounded-md file:border-0 file:bg-[#c4a35a] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-[#0a0a0a]"
          />
        </div>
      ) : null}

      {!templates.length ? (
        <p className="py-4 text-[13px] text-[#9a9590]">
          Upload your standard management agreement once — then every host invite can use it in
          one tap.
        </p>
      ) : (
        <div className="flex flex-col">
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-3 border-t border-white/8 py-3.5"
            >
              <div className="min-w-0">
                <div className="truncate text-[14.5px] font-semibold text-[#f5f5f5]">{t.label}</div>
                <div className="truncate text-[12.5px] text-[#6f6a65]">{t.filename}</div>
              </div>
              <div className="flex shrink-0 gap-3">
                <button
                  type="button"
                  className="text-[13px] font-semibold text-[#c4a35a]"
                  onClick={() => openFile(t.id)}
                >
                  View
                </button>
                <button
                  type="button"
                  className="text-[13px] font-semibold text-[#9a9590]"
                  disabled={busy}
                  onClick={() => archive(t.id)}
                >
                  Archive
                </button>
                <button
                  type="button"
                  className="text-[13px] font-semibold text-[#cf7f7b]"
                  disabled={busy}
                  onClick={() => remove(t.id, t.label)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
