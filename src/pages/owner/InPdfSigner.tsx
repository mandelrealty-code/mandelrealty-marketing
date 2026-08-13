import { useRef, useState } from "react";
import { PdfPages, fieldStyle } from "../../lib/pdfPages";
import type { SignField } from "../../../shared/pm/signFields";

function todayLabel() {
  return new Date().toLocaleDateString("en-CA");
}

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
  onFinish: (input: { signatureName: string; signaturePng: string }) => void;
}) {
  const [name, setName] = useState(signerHint);
  const [signed, setSigned] = useState(false);
  const [openPad, setOpenPad] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  const paintStart = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(
      ((e.clientX - rect.left) / rect.width) * canvas.width,
      ((e.clientY - rect.top) / rect.height) * canvas.height,
    );
  };
  const paintMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(
      ((e.clientX - rect.left) / rect.width) * canvas.width,
      ((e.clientY - rect.top) / rect.height) * canvas.height,
    );
    ctx.stroke();
  };

  const applyPad = () => {
    const canvas = canvasRef.current;
    if (!canvas || !name.trim()) return;
    setPreview(canvas.toDataURL("image/png"));
    setSigned(true);
    setOpenPad(false);
  };

  const filled = signed && name.trim().length > 1;
  const date = todayLabel();

  return (
    <div className="flex flex-col gap-4">
      <PdfPages url={pdfUrl}>
        {(page) => (
          <div className="absolute inset-0">
            {fields
              .filter((f) => f.page === page)
              .map((f) => (
                <button
                  key={f.id}
                  type="button"
                  style={fieldStyle(f)}
                  onClick={() => {
                    if (f.type === "signature" || f.type === "name") setOpenPad(true);
                  }}
                  className="flex items-center justify-center overflow-hidden rounded-[2px] border-2 border-dashed border-[#c4a35a] bg-[#c4a35a]/12"
                >
                  {f.type === "signature" && preview ? (
                    <img src={preview} alt="Signature" className="h-full w-full object-contain" />
                  ) : f.type === "name" && name ? (
                    <span className="px-1 text-[12px] font-medium text-[#1a1a19]">{name}</span>
                  ) : f.type === "date" ? (
                    <span className="px-1 text-[12px] text-[#1a1a19]">{date}</span>
                  ) : (
                    <span className="px-1 text-center text-[10px] font-semibold uppercase tracking-wide text-[#5a4a28]">
                      {f.type === "signature" ? "Tap to sign" : "Tap to type name"}
                    </span>
                  )}
                </button>
              ))}
          </div>
        )}
      </PdfPages>

      {openPad ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#141414] p-5 text-[#f5f5f5]">
            <div className="mb-4 text-[17px] font-semibold">Sign this agreement</div>
            <label className="mb-3 flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6f6a65]">
                Full legal name
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border-0 border-b border-white/16 bg-transparent py-2 text-[16px] outline-none focus:border-[#c4a35a]"
              />
            </label>
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6f6a65]">
              Draw signature
            </span>
            <canvas
              ref={canvasRef}
              width={420}
              height={150}
              className="mb-2 w-full touch-none rounded-md border border-white/12 bg-white"
              onPointerDown={paintStart}
              onPointerMove={paintMove}
              onPointerUp={() => {
                drawing.current = false;
              }}
              onPointerLeave={() => {
                drawing.current = false;
              }}
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-md bg-[#c4a35a] py-3 text-[14px] font-bold text-[#0a0a0a]"
                onClick={applyPad}
                disabled={!name.trim()}
              >
                Place on PDF
              </button>
              <button
                type="button"
                className="rounded-md px-3 text-[13px] text-[#9a9590]"
                onClick={() => setOpenPad(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-[#cf7f7b]">{error}</p> : null}
      <button
        type="button"
        disabled={busy || !filled}
        onClick={() => {
          if (!preview) return;
          onFinish({ signatureName: name.trim(), signaturePng: preview });
        }}
        className={`w-full py-[17px] text-[15px] font-bold ${
          busy || !filled
            ? "cursor-not-allowed bg-[#c4a35a]/25 text-[#6f6a65]"
            : "bg-[#c4a35a] text-[#0a0a0a] hover:bg-[#dcc084]"
        }`}
      >
        {busy ? "Signing…" : "Finish signing"}
      </button>
      <p className="text-center text-[12px] text-[#6f6a65]">
        Tap the gold boxes on the PDF to sign. Your signature is stamped onto the document.
      </p>
    </div>
  );
}
