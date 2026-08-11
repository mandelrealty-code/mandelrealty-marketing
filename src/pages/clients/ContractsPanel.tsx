import { useCallback, useEffect, useState } from "react";
import { pmGet, pmPost } from "./api";
import { formatDisplayDate, todayInputValue } from "./format";
import { FieldLabel, TextInput } from "./ui";

type Contract = {
  id: string;
  title: string;
  filename: string;
  signed_on: string | null;
  status: string;
  created_at: string;
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

export function ContractsPanel({
  clientId,
  propertyId,
  onError,
}: {
  clientId?: string | null;
  propertyId?: string | null;
  onError: (msg: string) => void;
}) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [signedOn, setSignedOn] = useState(todayInputValue());

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

  const upload = async (file: File | null) => {
    if (!file) return;
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
      setOpen(false);
      await load();
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

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await pmPost("contracts", { op: "delete", id });
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not delete.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-white/8 px-4 py-5 lg:px-1">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6f6a65]">
          Contracts
        </p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-[13px] font-semibold text-[#c4a35a]"
        >
          {open ? "Cancel" : "Upload"}
        </button>
      </div>

      {open ? (
        <div className="mb-4 flex flex-col gap-2 rounded-[9px] border border-white/10 bg-[#141414] p-3">
          <FieldLabel>Title</FieldLabel>
          <TextInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Management agreement"
          />
          <FieldLabel>Signed on</FieldLabel>
          <TextInput
            type="date"
            value={signedOn}
            onChange={(e) => setSignedOn(e.target.value)}
          />
          <label className="mt-1">
            <span className="sr-only">Choose file</span>
            <input
              type="file"
              accept="application/pdf,image/*"
              disabled={busy}
              className="block w-full text-[13px] text-[#9a9590] file:mr-3 file:rounded-lg file:border-0 file:bg-[#c4a35a] file:px-3 file:py-2 file:text-[13px] file:font-semibold file:text-[#0a0a0a]"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                upload(file).catch(() => undefined);
                e.target.value = "";
              }}
            />
          </label>
          <p className="text-[12px] text-[#6f6a65]">PDF or image · max 10MB</p>
        </div>
      ) : null}

      {contracts.length === 0 ? (
        <p className="text-[13px] text-[#6f6a65]">No contracts yet.</p>
      ) : (
        <div>
          {contracts.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 border-t border-white/8 py-3 first:border-t-0"
            >
              <button
                type="button"
                onClick={() => openFile(c.id)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-[15px] font-semibold text-[#f5f5f5]">{c.title}</p>
                <p className="truncate text-[13px] text-[#9a9590]">
                  {c.status}
                  {c.signed_on ? ` · signed ${formatDisplayDate(c.signed_on)}` : ""}
                </p>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => remove(c.id)}
                className="text-[13px] text-[#cf7f7b]"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
