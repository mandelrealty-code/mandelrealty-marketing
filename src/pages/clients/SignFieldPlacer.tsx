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

const MIN_W = 0.04;
const MIN_H = 0.02;

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

function applyResize(orig: SignField, handle: Handle, dx: number, dy: number): SignField {
  let { x, y, w, h } = orig;
  if (handle.includes("e")) w = orig.w + dx;
  if (handle.includes("s")) h = orig.h + dy;
  if (handle.includes("w")) {
    w = orig.w - dx;
    x = orig.x + dx;
  }
  if (handle.includes("n")) {
    h = orig.h - dy;
    y = orig.y + dy;
  }
  return clampField({ ...orig, x, y, w, h });
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
  const moved = useRef(false);
  const overlayByPage = useRef<Map<number, HTMLDivElement>>(new Map());

  const patch = (id: string, next: Partial<SignField>) => {
    onChange(fields.map((f) => (f.id === id ? { ...f, ...next } : f)));
  };

  const pageFrac = (page: number, clientX: number, clientY: number) => {
    const el = overlayByPage.current.get(page);
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  };

  const place = (page: number, e: React.MouseEvent<HTMLDivElement>) => {
    if (moved.current) return;
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
    onChange([...fields, field]);
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
      moved.current = true;
      const p = pageFrac(d.orig.page, e.clientX, e.clientY);
      const dx = p.x - d.sx;
      const dy = p.y - d.sy;
      const next =
        d.kind === "move"
          ? clampField({ ...d.orig, x: d.orig.x + dx, y: d.orig.y + dy })
          : applyResize(d.orig, d.handle, dx, dy);
      onChange(fields.map((f) => (f.id === d.id ? next : f)));
    };
    const onUp = () => {
      drag.current = null;
      window.setTimeout(() => {
        moved.current = false;
      }, 0);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [fields, onChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (!selected) return;
      e.preventDefault();
      onChange(fields.filter((f) => f.id !== selected));
      setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, fields, onChange]);

  const startMove = (f: SignField, e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("input,textarea,button[data-handle]")) return;
    e.preventDefault();
    e.stopPropagation();
    setSelected(f.id);
    const p = pageFrac(f.page, e.clientX, e.clientY);
    drag.current = { kind: "move", id: f.id, sx: p.x, sy: p.y, orig: f };
  };

  const startResize = (f: SignField, handle: Handle, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelected(f.id);
    const p = pageFrac(f.page, e.clientX, e.clientY);
    drag.current = { kind: "resize", id: f.id, handle, sx: p.x, sy: p.y, orig: f };
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
          Drop · drag corners to resize · click a box to type or sign · {fields.length} placed
        </span>
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
                    className={`flex items-center overflow-hidden rounded-[3px] border-2 ${
                      active
                        ? "border-[#c4a35a] bg-[#c4a35a]/20"
                        : isMrg
                          ? "border-[#4ea882]/80 bg-[#4ea882]/12"
                          : "border-[#c4a35a]/80 bg-[#c4a35a]/12"
                    }`}
                  >
                    <span className="pointer-events-none absolute left-1 top-0.5 text-[8px] font-bold uppercase tracking-wide text-[#5a4a28]">
                      {isMrg ? "MRG" : "Host"}
                    </span>
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
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => patch(f.id, { value: e.target.value })}
                        className="h-full w-full bg-transparent px-1.5 text-[11px] text-[#1a1408] outline-none placeholder:text-[#8a7a58]"
                      />
                    )}
                    {active
                      ? (["nw", "ne", "sw", "se"] as const).map((handle) => (
                          <button
                            key={handle}
                            type="button"
                            data-handle
                            onPointerDown={(e) => startResize(f, handle, e)}
                            className={`absolute z-10 h-2.5 w-2.5 border border-[#0a0a0a] bg-[#c4a35a] ${
                              handle === "nw"
                                ? "-left-1 -top-1 cursor-nwse-resize"
                                : handle === "ne"
                                  ? "-right-1 -top-1 cursor-nesw-resize"
                                  : handle === "sw"
                                    ? "-left-1 -bottom-1 cursor-nesw-resize"
                                    : "-right-1 -bottom-1 cursor-nwse-resize"
                            }`}
                          />
                        ))
                      : null}
                  </div>
                );
              })}
          </div>
        )}
      </PdfPages>

      {selected ? (
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            className="text-[13px] font-semibold text-[#cf7f7b]"
            onClick={() => {
              onChange(fields.filter((f) => f.id !== selected));
              setSelected(null);
            }}
          >
            Remove selected field
          </button>
          {fields.find((f) => f.id === selected)?.type === "signature" &&
          fields.find((f) => f.id === selected)?.party === "mrg" ? (
            <button
              type="button"
              className="text-[13px] font-semibold text-[#c4a35a]"
              onClick={() => {
                const f = fields.find((x) => x.id === selected);
                setPadName(f?.value || mrgNameHint);
                setSigningId(selected);
              }}
            >
              Draw MRG signature
            </button>
          ) : null}
        </div>
      ) : null}

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
