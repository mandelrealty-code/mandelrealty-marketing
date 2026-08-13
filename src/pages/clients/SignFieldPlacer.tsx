import { useEffect, useRef, useState } from "react";
import { PdfPages, fieldStyle } from "../../lib/pdfPages";
import { SignaturePad } from "../../lib/SignaturePad";
import {
  defaultFieldSize,
  fieldLabel,
  newFieldId,
  todayIsoDate,
  type SignField,
  type SignFieldType,
  type SignParty,
} from "../../../shared/pm/signFields";

type Handle = "nw" | "ne" | "sw" | "se";
type Drag =
  | { kind: "move"; id: string; sx: number; sy: number; orig: SignField }
  | { kind: "resize"; id: string; handle: Handle; sx: number; sy: number; orig: SignField };

const MIN_W = 0.05;
const MIN_H = 0.028;
const MOVE_THRESHOLD_PX = 4;

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

function clampField(f: SignField): SignField {
  const w = Math.min(1, Math.max(MIN_W, f.w));
  const h = Math.min(1, Math.max(MIN_H, f.h));
  return {
    ...f,
    w,
    h,
    x: Math.min(1 - w, Math.max(0, f.x)),
    y: Math.min(1 - h, Math.max(0, f.y)),
  };
}

/** Delta resize so the grab point never jumps — opposite corner stays fixed. */
function resizeByDelta(
  orig: SignField,
  handle: Handle,
  dx: number,
  dy: number,
): SignField {
  let left = orig.x;
  let right = orig.x + orig.w;
  let top = orig.y;
  let bottom = orig.y + orig.h;

  if (handle.includes("e")) right = orig.x + orig.w + dx;
  if (handle.includes("w")) left = orig.x + dx;
  if (handle.includes("s")) bottom = orig.y + orig.h + dy;
  if (handle.includes("n")) top = orig.y + dy;

  if (handle.includes("e")) right = Math.min(1, Math.max(left + MIN_W, right));
  if (handle.includes("w")) left = Math.max(0, Math.min(right - MIN_W, left));
  if (handle.includes("s")) bottom = Math.min(1, Math.max(top + MIN_H, bottom));
  if (handle.includes("n")) top = Math.max(0, Math.min(bottom - MIN_H, top));

  return {
    ...orig,
    x: left,
    y: top,
    w: right - left,
    h: bottom - top,
  };
}

export function SignFieldPlacer({
  pdfUrl,
  fields,
  onChange,
  mrgNameHint = "",
}: {
  pdfUrl: string;
  fields: SignField[];
  onChange: (next: SignField[]) => void;
  mrgNameHint?: string;
}) {
  const [tool, setTool] = useState<SignFieldType>("signature");
  const [party, setParty] = useState<SignParty>("host");
  const [selected, setSelected] = useState<string | null>(null);
  const [signingId, setSigningId] = useState<string | null>(null);
  const [padName, setPadName] = useState(mrgNameHint);
  const drag = useRef<Drag | null>(null);
  const dragging = useRef(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const fieldsRef = useRef(fields);
  const overlayByPage = useRef<Map<number, HTMLDivElement>>(new Map());

  fieldsRef.current = fields;

  const replace = (id: string, next: SignField) => {
    onChange(fieldsRef.current.map((f) => (f.id === id ? next : f)));
  };

  const patch = (id: string, next: Partial<SignField>) => {
    onChange(fieldsRef.current.map((f) => (f.id === id ? { ...f, ...next } : f)));
  };

  const remove = (id: string) => {
    onChange(fieldsRef.current.filter((f) => f.id !== id));
    if (selected === id) setSelected(null);
    if (signingId === id) setSigningId(null);
  };

  const pageFrac = (page: number, clientX: number, clientY: number) => {
    const el = overlayByPage.current.get(page);
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const w = rect.width || 1;
    const h = rect.height || 1;
    return {
      x: clamp01((clientX - rect.left) / w),
      y: clamp01((clientY - rect.top) / h),
    };
  };

  const place = (page: number, e: React.MouseEvent<HTMLDivElement>) => {
    if (dragging.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const size = defaultFieldSize(tool);
    const x = (e.clientX - rect.left) / rect.width - size.w / 2;
    const y = (e.clientY - rect.top) / rect.height - size.h / 2;
    const field = clampField({
      id: newFieldId(),
      type: tool,
      party,
      page,
      x,
      y,
      w: size.w,
      h: size.h,
      ...(tool === "date" && party === "mrg" ? { value: todayIsoDate() } : {}),
      ...(tool === "name" && party === "mrg" && mrgNameHint ? { value: mrgNameHint } : {}),
    });
    onChange([...fieldsRef.current, field]);
    setSelected(field.id);
    if (tool === "signature" && party === "mrg") {
      setPadName(mrgNameHint);
      setSigningId(field.id);
    }
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      if (d.kind === "move") {
        const start = pointerStart.current;
        if (!dragging.current && start) {
          const dist = Math.hypot(e.clientX - start.x, e.clientY - start.y);
          if (dist < MOVE_THRESHOLD_PX) return;
          dragging.current = true;
        }
        const p = pageFrac(d.orig.page, e.clientX, e.clientY);
        replace(
          d.id,
          clampField({
            ...d.orig,
            x: d.orig.x + (p.x - d.sx),
            y: d.orig.y + (p.y - d.sy),
          }),
        );
        return;
      }
      dragging.current = true;
      const p = pageFrac(d.orig.page, e.clientX, e.clientY);
      replace(d.id, resizeByDelta(d.orig, d.handle, p.x - d.sx, p.y - d.sy));
    };
    const onUp = () => {
      drag.current = null;
      pointerStart.current = null;
      window.setTimeout(() => {
        dragging.current = false;
      }, 0);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (!selected) return;
      e.preventDefault();
      remove(selected);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const startMove = (f: SignField, e: React.PointerEvent) => {
    e.stopPropagation();
    setSelected(f.id);
    if ((e.target as HTMLElement).closest("input,textarea,[data-handle],[data-delete]")) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const p = pageFrac(f.page, e.clientX, e.clientY);
    pointerStart.current = { x: e.clientX, y: e.clientY };
    drag.current = { kind: "move", id: f.id, sx: p.x, sy: p.y, orig: { ...f } };
  };

  const startResize = (f: SignField, handle: Handle, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelected(f.id);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const p = pageFrac(f.page, e.clientX, e.clientY);
    drag.current = { kind: "resize", id: f.id, handle, sx: p.x, sy: p.y, orig: { ...f } };
  };

  const signing = fields.find((f) => f.id === signingId) ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6f6a65]">
          Who
        </span>
        {(["host", "mrg"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setParty(p)}
            className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold ${
              party === p
                ? "bg-[#c4a35a] text-[#0a0a0a]"
                : "border border-white/12 text-[#9a9590]"
            }`}
          >
            {p === "host" ? "Host fills later" : "MRG fills now"}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-white/12" />
        {(["signature", "name", "date", "text"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTool(t)}
            className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold ${
              tool === t
                ? "bg-[#c4a35a] text-[#0a0a0a]"
                : "border border-white/12 text-[#9a9590]"
            }`}
          >
            {fieldLabel(t)}
          </button>
        ))}
        <span className="text-[12px] text-[#6f6a65]">
          {selected
            ? "Selected · drag gold corners · × or Delete"
            : `Click a box to select · ${fields.length} placed`}
        </span>
        {selected ? (
          <button
            type="button"
            className="rounded-md border border-[#cf7f7b]/40 px-3 py-1.5 text-[12.5px] font-semibold text-[#cf7f7b]"
            onClick={() => remove(selected)}
          >
            Delete
          </button>
        ) : null}
      </div>

      <PdfPages url={pdfUrl}>
        {(page) => (
          <div
            ref={(el) => {
              if (el) overlayByPage.current.set(page, el);
              else overlayByPage.current.delete(page);
            }}
            className="absolute inset-0 cursor-crosshair"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("[data-field]")) return;
              place(page, e);
            }}
          >
            {fields
              .filter((f) => f.page === page)
              .map((f) => {
                const active = selected === f.id;
                const isMrg = f.party === "mrg";
                return (
                  <div
                    key={f.id}
                    data-field
                    style={fieldStyle(f)}
                    onPointerDown={(e) => startMove(f, e)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelected(f.id);
                      if (f.type === "signature" && isMrg && !f.signature_png) {
                        setPadName(f.value || mrgNameHint);
                        setSigningId(f.id);
                      }
                    }}
                    className={`absolute touch-none select-none overflow-visible rounded-[3px] border-2 ${
                      active
                        ? "z-20 border-[#c4a35a] bg-[#c4a35a]/18 shadow-[0_0_0_3px_rgba(196,163,90,0.35)]"
                        : isMrg
                          ? "border-[#4ea882]/80 bg-[#4ea882]/12"
                          : "border-[#c4a35a]/80 bg-[#c4a35a]/12"
                    }`}
                  >
                    <div className="pointer-events-none absolute left-1 top-0.5 text-[8px] font-bold uppercase tracking-wide text-[#5a4a28]">
                      {isMrg ? "MRG" : "Host"}
                    </div>
                    {active ? (
                      <button
                        type="button"
                        data-delete
                        title="Delete"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(f.id);
                        }}
                        className="absolute left-1/2 z-40 flex h-5 -translate-x-1/2 -translate-y-[130%] items-center rounded-full bg-[#cf7f7b] px-2 text-[10px] font-bold leading-none text-[#0a0a0a] shadow"
                      >
                        Delete
                      </button>
                    ) : null}
                    <div className="flex h-full items-center overflow-hidden rounded-[1px]">
                      {f.type === "signature" ? (
                        f.signature_png ? (
                          <img
                            src={f.signature_png}
                            alt=""
                            className="h-full w-full object-contain p-0.5"
                          />
                        ) : (
                          <span className="w-full px-1 text-center text-[10px] font-semibold uppercase tracking-wide text-[#5a4a28]">
                            {isMrg ? "Click to sign" : "Host signs here"}
                          </span>
                        )
                      ) : (
                        <input
                          value={f.value || ""}
                          placeholder={
                            f.type === "date"
                              ? "YYYY-MM-DD"
                              : f.type === "name"
                                ? "Printed name"
                                : "Type here"
                          }
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            setSelected(f.id);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => patch(f.id, { value: e.target.value })}
                          className="h-full w-full bg-transparent px-1.5 pt-2.5 text-[11px] text-[#1a1408] outline-none placeholder:text-[#8a7a58]"
                        />
                      )}
                    </div>
                    {active
                      ? (["nw", "ne", "sw", "se"] as const).map((handle) => (
                          <button
                            key={handle}
                            type="button"
                            data-handle
                            aria-label={`Resize ${handle}`}
                            onPointerDown={(e) => startResize(f, handle, e)}
                            className={`absolute z-30 flex h-5 w-5 items-center justify-center ${
                              handle === "nw"
                                ? "-left-2.5 -top-2.5 cursor-nwse-resize"
                                : handle === "ne"
                                  ? "-right-2.5 -top-2.5 cursor-nesw-resize"
                                  : handle === "sw"
                                    ? "-left-2.5 -bottom-2.5 cursor-nesw-resize"
                                    : "-right-2.5 -bottom-2.5 cursor-nwse-resize"
                            }`}
                          >
                            <span className="pointer-events-none block h-2.5 w-2.5 rounded-[1px] border border-[#0a0a0a] bg-[#c4a35a] shadow" />
                          </button>
                        ))
                      : null}
                  </div>
                );
              })}
          </div>
        )}
      </PdfPages>

      {signing ? (
        <SignaturePad
          title="Sign as Mandel Realty"
          name={padName}
          onNameChange={setPadName}
          onCancel={() => setSigningId(null)}
          onApply={(png) => {
            patch(signing.id, {
              signature_png: png,
              value: padName.trim() || signing.value,
            });
            setSigningId(null);
          }}
        />
      ) : null}
    </div>
  );
}
