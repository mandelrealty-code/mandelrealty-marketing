import { useState } from "react";
import { FittedFieldInput, fieldStyle, PartyChip, PdfPages } from "../../lib/pdfPages";
import { SignaturePad } from "../../lib/SignaturePad";
import {
  fieldLabel,
  firstNameOf,
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
  const [draft, setDraft] = useState<SignField[]>(() =>
    fields.map((f) => {
      if (f.party === "mrg") return { ...f };
      return {
        ...f,
        value:
          f.value ||
          (f.type === "date" ? todayIsoDate() : f.type === "name" ? signerHint : ""),
      };
    }),
  );
  const [name, setName] = useState(signerHint);
  const [signingId, setSigningId] = useState<string | null>(null);
  const hostFirst = firstNameOf(signerHint) || "Host";

  const patchHost = (id: string, next: Partial<SignField>) => {
    setDraft((prev) =>
      prev.map((f) => (f.id === id && f.party !== "mrg" ? { ...f, ...next } : f)),
    );
  };

  const host = draft.filter((f) => f.party !== "mrg");
  const primarySig = host.find((f) => f.type === "signature" && f.signature_png);
  const namesReady = host
    .filter((f) => f.type === "name" || f.type === "text")
    .every((f) => (f.value || "").trim().length > 0);
  const sigsReady = host
    .filter((f) => f.type === "signature")
    .every((f) => Boolean(f.signature_png));
  const filled =
    sigsReady &&
    namesReady &&
    Boolean(primarySig || !host.some((f) => f.type === "signature"));
  const signatureName =
    host.find((f) => f.type === "name" && f.value?.trim())?.value?.trim() || name.trim();

  return (
    <div className="flex flex-col gap-4">
      <PdfPages url={pdfUrl}>
        {(page) => (
          <div className="absolute inset-0">
            {draft
              .filter((f) => f.page === page && f.type !== "checkbox")
              .map((f) => {
                const isMrg = f.party === "mrg";
                const isSig = f.type === "signature";
                return (
                  <div
                    key={f.id}
                    style={fieldStyle(f)}
                    className={`@container overflow-visible rounded-[2px] border [container-type:size] ${
                      isMrg
                        ? "pointer-events-none border-[#4ea882]/70 bg-transparent"
                        : isSig
                          ? "border-2 border-dashed border-[#c4a35a] bg-[#c4a35a]/12"
                          : "border-[#c4a35a]/70 bg-white/80"
                    }`}
                  >
                    <PartyChip party={f.party} locked={isMrg} hostLabel={hostFirst} />
                    {isMrg ? (
                      <div className="h-full w-full" />
                    ) : (
                      <div className="flex h-full min-w-0 items-center overflow-hidden rounded-[1px]">
                        {isSig ? (
                          <button
                            type="button"
                            className="h-full w-full min-w-0 cursor-pointer"
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
                              <span className="block truncate px-1 text-center font-semibold uppercase tracking-wide text-[#5a4a28] [font-size:clamp(7px,38cqh,11px)]">
                                Tap to sign
                              </span>
                            )}
                          </button>
                        ) : (
                          <FittedFieldInput
                            value={f.value || ""}
                            placeholder={fieldLabel(f.type)}
                            inputMode={f.type === "date" ? "numeric" : undefined}
                            onClick={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const value = e.target.value;
                              patchHost(f.id, { value });
                              if (f.type === "name") setName(value);
                            }}
                          />
                        )}
                      </div>
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
                if (f.party === "mrg") return f;
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
            fields: host,
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
        Fill only {hostFirst}’s boxes. MRG signature, name, and date stay locked.
      </p>
    </div>
  );
}
