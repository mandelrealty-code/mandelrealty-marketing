import { useRef } from "react";

export function SignaturePad({
  name,
  onNameChange,
  onApply,
  onCancel,
  title = "Sign this agreement",
}: {
  name: string;
  onNameChange: (v: string) => void;
  onApply: (pngDataUrl: string) => void;
  onCancel: () => void;
  title?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  const paintStart = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    canvas.setPointerCapture(e.pointerId);
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

  const apply = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onApply(canvas.toDataURL("image/png"));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#141414] p-5 text-[#f5f5f5]">
        <div className="mb-4 text-[17px] font-semibold">{title}</div>
        <label className="mb-3 flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6f6a65]">
            Full legal name
          </span>
          <input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
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
            className="flex-1 rounded-md bg-[#c4a35a] py-3 text-[14px] font-bold text-[#0a0a0a] disabled:opacity-40"
            onClick={apply}
            disabled={!name.trim()}
          >
            Place on PDF
          </button>
          <button
            type="button"
            className="rounded-md px-3 text-[13px] text-[#9a9590]"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
