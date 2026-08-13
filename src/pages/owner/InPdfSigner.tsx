import { useState } from "react";
import { PdfPages, fieldStyle } from "../../lib/pdfPages";
import { SignaturePad } from "../../lib/SignaturePad";
import {
  fieldLabel,
  hostFields,
  todayIsoDate,
  type SignField,
} from "../../../shared/pm/signFields";

export function InPdfSigner({
  pdfUrl,
  fields,
  signerHint,
  busy,
  error,
  onFinish,
}: {
  pdfUrl: string;
  fields: SignField[];
  signerHint: string;
  busy: boolean;
  error: string;
  onFinish: (input: {
    signatureName: string;
    signaturePng: string;
    fields: SignField[];
  }) => void;
}) {
  const host = hostFields(fields);
  const [draft, setDraft] = useState<SignField[]>(() =>
    host.map((f) => ({
      ...f,
      value:
        f.value ||
        (f.type === "date" ? todayIsoDate() : f.type === "name" ? signerHint : ""),
    })),
  );
  const [name, setName] = useState(signerHint);
  const [signingId, setSigningId] = useState<string | null>(null);

  const patch = (id: string, next: Partial<SignField>) => {
    setDraft((prev) => prev.map((f) => (f.id === id ? { ...f, ...next } : f)));
  };

  const primarySig = draft.find((f) => f.type === "signature" && f.signature_png);
  const namesReady = draft
    .filter((f) => f.type === "name" || f.type === "text")
    .every((f) => (f.value || "").trim().length > 0);
  const sigsReady = draft
    .filter((f) => f.type === "signature")
    .every((f) => Boolean(f.signature_png));
  const filled = sigsReady && namesReady && Boolean(primarySig || !draft.some((f) => f.type === "signature"));
  const signatureName =
    draft.find((f) => f.type === "name" && f.value?.trim())?.value?.trim() || name.trim();

  return (
    <div className="flex flex-col gap-4">
      <PdfPages url={pdfUrl}>
        {(page) => (
          <div className="absolute inset-0">
            {draft
              .filter((f) => f.page === page)
              .map((f) => {
                const isSig = f.type === "signature";
                return (
                  <div
                    key={f.id}
                    style={fieldStyle(f)}
                    className={
                      isSig
                        ? "flex items-center overflow-hidden rounded-[2px] border-2 border-dashed border-[#c4a35a] bg-[#c4a35a]/12"
                        : "flex items-center overflow-hidden rounded-[2px] border border-[#c4a35a]/70 bg-white/80"
                    }
                  >
                    {isSig ? (
                      <button
                        type="button"
                        className="h-full w-full cursor-pointer"
                        onClick={() => {
                          setName(signatureName || signerHint);
                          setSigningId(f.id);
                        }}
                      >
                        {f.signature_png ? (
                          <img
                            src={f.signature_png}
                            alt="Signature"
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <span className="px-1 text-center text-[10px] font-semibold uppercase tracking-wide text-[#5a4a28]">
                            Tap to sign
                          </span>
                        )}
                      </button>
                    ) : (
                      <input
                        value={f.value || ""}
                        placeholder={fieldLabel(f.type)}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const value = e.target.value;
                          patch(f.id, { value });
                          if (f.type === "name") setName(value);
                        }}
                        className="h-full w-full cursor-text bg-transparent px-1.5 text-[12px] font-medium text-[#1a1a19] outline-none placeholder:text-[#8a7a58]"
                      />
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </PdfPages>

      {signingId ? (
        <SignaturePad
          name={name}
          onNameChange={setName}
          onCancel={() => setSigningId(null)}
          onApply={(png) => {
            setDraft((prev) =>
              prev.map((f) => {
                if (f.type !== "signature") {
                  if (f.type === "name" && !f.value?.trim()) {
                    return { ...f, value: name.trim() };
                  }
                  return f;
                }
                if (f.id === signingId || !f.signature_png) {
                  return { ...f, signature_png: png, value: name.trim() || f.value };
                }
                return f;
              }),
            );
            setSigningId(null);
          }}
        />
      ) : null}

      {error ? <p className="text-sm text-[#cf7f7b]">{error}</p> : null}
      <button
        type="button"
        disabled={busy || !filled || !signatureName}
        onClick={() => {
          if (!filled || !signatureName) return;
          onFinish({
            signatureName,
            signaturePng: primarySig?.signature_png || "",
            fields: draft,
          });
        }}
        className={`w-full py-[17px] text-[15px] font-bold ${
          busy || !filled || !signatureName
            ? "cursor-not-allowed bg-[#c4a35a]/25 text-[#6f6a65]"
            : "bg-[#c4a35a] text-[#0a0a0a] hover:bg-[#dcc084]"
        }`}
      >
        {busy ? "Signing…" : "Finish signing"}
      </button>
      <p className="text-center text-[12px] text-[#6f6a65]">
        Only the dashed signature box opens the drawing pad. Name and date are typed, not signed.
      </p>
    </div>
  );
}
