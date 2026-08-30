import { useEffect, useRef, useState } from "react";
import { PdfPages, fieldStyle, FittedFieldInput, FittedFieldText } from "../../lib/pdfPages";
import { SignaturePad } from "../../lib/SignaturePad";
import {
  defaultFieldSize,
  fieldLabel,
  firstNameOf,
  isCheckboxChecked,
  minFieldSize,
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

const MOVE_THRESHOLD_PX = 4;

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

function clampField(f: SignField): SignField {
  const min = minFieldSize(f.type);
  const w = Math.min(1, Math.max(min.w, f.w));
  const h = Math.min(1, Math.max(min.h, f.h));
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

  const min = minFieldSize(orig.type);
  if (handle.includes("e")) right = orig.x + orig.w + dx;
  if (handle.includes("w")) left = orig.x + dx;
  if (handle.includes("s")) bottom = orig.y + orig.h + dy;
  if (handle.includes("n")) top = orig.y + dy;

  if (handle.includes("e")) right = Math.min(1, Math.max(left + min.w, right));
  if (handle.includes("w")) left = Math.max(0, Math.min(right - min.w, left));
  if (handle.includes("s")) bottom = Math.min(1, Math.max(top + min.h, bottom));
  if (handle.includes("n")) top = Math.max(0, Math.min(bottom - min.h, top));

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
  hostNameHint = "",
}: {
  pdfUrl: string;
  fields: SignField[];
  onChange: (next: SignField[]) => void;
  mrgNameHint?: string;
  hostNameHint?: string;
}) {
  const [mode, setMode] = useState<"place" | "move">("move");
  const [tool, setTool] = useState<SignFieldType>("signature");
  const [party, setParty] = useState<SignParty>("host");
  const [selected, setSelected] = useState<string | null>(null);
  const [signingId, setSigningId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [padName, setPadName] = useState(mrgNameHint);
  const drag = useRef<Drag | null>(null);
  const dragging = useRef(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const fieldsRef = useRef(fields);
  const overlayByPage = useRef<Map<number, HTMLDivElement>>(new Map());
  const hostFirst = firstNameOf(hostNameHint) || "Host";

  fieldsRef.current = fields;

  const enterPlace = (t: SignFieldType) => {
    setTool(t);
    setMode("place");
    if (t === "checkbox") setParty("mrg");
  };

  const enterMove = () => {
    setMode("move");
  };

  const replace = (id: string, next: SignField) => {
    onChange(fieldsRef.current.map((f) => (f.id === id ? next : f)));
  };

  const patch = (id: string, next: Partial<SignField>) => {
    onChange(
      fieldsRef.current.map((f) => {
        if (f.id !== id) return f;
        const merged = { ...f, ...next };
        if ("label" in next && !next.label?.trim()) {
          const { label: _drop, ...rest } = merged;
          return rest;
        }
        return merged;
      }),
    );
  };

  const remove = (id: string) => {
    onChange(fieldsRef.current.filter((f) => f.id !== id));
    if (selected === id) setSelected(null);
    if (signingId === id) setSigningId(null);
    if (editingId === id) setEditingId(null);
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
    if (mode !== "place") return;
    if (dragging.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const size = defaultFieldSize(tool);
    const x = (e.clientX - rect.left) / rect.width - size.w / 2;
    const y = (e.clientY - rect.top) / rect.height - size.h / 2;
    const field = clampField({
      id: newFieldId(),
      type: tool,
      party: tool === "checkbox" ? "mrg" : party,
      page,
      x,
      y,
      w: size.w,
      h: size.h,
      ...(tool === "date" && party === "mrg" ? { value: todayIsoDate() } : {}),
      ...(tool === "name" && party === "mrg" && mrgNameHint ? { value: mrgNameHint } : {}),
      ...(tool === "checkbox" ? { value: "1" } : {}),
    });
    onChange([...fieldsRef.current, field]);
    setSelected(field.id);
    setMode("move");
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
      const t = e.target as HTMLElement | null;
      const isTyping = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA");
      if (e.key === "Escape" || (!isTyping && (e.key === "v" || e.key === "V"))) {
        e.preventDefault();
        enterMove();
        if (e.key === "Escape") setSelected(null);
        return;
      }
      if (!isTyping && (e.key === "Backspace" || e.key === "Delete")) {
        if (!selected) return;
        e.preventDefault();
        remove(selected);
        return;
      }
      if (!isTyping && selected && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        const f = fieldsRef.current.find((x) => x.id === selected);
        if (f) {
          e.preventDefault();
          const step = e.shiftKey ? 0.02 : 0.003;
          let dx = 0;
          let dy = 0;
          if (e.key === "ArrowUp") dy = -step;
          if (e.key === "ArrowDown") dy = step;
          if (e.key === "ArrowLeft") dx = -step;
          if (e.key === "ArrowRight") dx = step;
          replace(f.id, clampField({ ...f, x: f.x + dx, y: f.y + dy }));
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const startMove = (f: SignField, e: React.PointerEvent) => {
    e.stopPropagation();
    setSelected(f.id);
    setMode("move");
    const target = e.target as HTMLElement;
    if (!target.closest("[data-drag-handle]") && target.closest("input,textarea,[data-handle],[data-delete]")) {
      return;
    }
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
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="z-20 shrink-0 border-b border-white/8 bg-[#0a0a0a] px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={enterMove}
          className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold ${
            mode === "move"
              ? "bg-[#c4a35a] text-[#0a0a0a]"
              : "border border-white/12 text-[#9a9590]"
          }`}
        >
          Move
        </button>
        <span className="mx-1 h-4 w-px bg-white/12" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6f6a65]">
          Who
        </span>
        {(["host", "mrg"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              if (p === "host" && tool === "checkbox") return;
              setParty(p);
            }}
            className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold ${
              (tool === "checkbox" ? "mrg" : party) === p
                ? "bg-[#c4a35a] text-[#0a0a0a]"
                : "border border-white/12 text-[#9a9590]"
            } ${p === "host" && tool === "checkbox" ? "cursor-not-allowed opacity-40" : ""}`}
          >
            {p === "host" ? `${hostFirst} fills later` : "MRG fills now"}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-white/12" />
        {(["signature", "name", "date", "text", "checkbox"] as SignFieldType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => enterPlace(t)}
            className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold ${
              mode === "place" && tool === t
                ? "bg-[#c4a35a] text-[#0a0a0a]"
                : "border border-white/12 text-[#9a9590]"
            }`}
          >
            {fieldLabel(t)}
          </button>
        ))}
        <span className="text-[12px] text-[#9a9590]">
          {mode === "move"
            ? selected
              ? "Drag box to move · Double-click to type · Arrow keys to nudge · Gold corners to resize"
              : "Click any box to select & drag · Double-click to type · V or Escape for Move"
            : `Click PDF to place ${fieldLabel(tool).toLowerCase()} · switches to Move after`}
        </span>
        {selected ? (
          <>
            {(() => {
              const sf = fields.find((x) => x.id === selected);
              if (!sf) return null;
              const sfMrg = sf.party === "mrg";
              if (sfMrg && (sf.type === "text" || sf.type === "name" || sf.type === "date")) {
                return (
                  <label className="flex items-center gap-2 text-[12px] text-[#9a9590]">
                    Text
                    <input
                      type="text"
                      value={sf.value || ""}
                      placeholder={
                        sf.type === "date"
                          ? todayIsoDate()
                          : sf.type === "name"
                            ? (mrgNameHint || "Printed name")
                            : "Type here"
                      }
                      onChange={(e) => patch(selected, { value: e.target.value })}
                      className="w-[170px] rounded border border-white/14 bg-[#141414] px-2 py-1 text-[12px] text-[#f5f5f5] outline-none placeholder:text-[#6f6a65] focus:border-[#c4a35a]"
                    />
                  </label>
                );
              }
              if (sf.party === "host") {
                return (
                  <label className="flex items-center gap-2 text-[12px] text-[#9a9590]">
                    Host sees as
                    <input
                      type="text"
                      value={sf.label || ""}
                      placeholder={fieldLabel(sf.type)}
                      onChange={(e) =>
                        patch(selected, { label: e.target.value.slice(0, 48) || undefined })
                      }
                      className="w-[140px] rounded border border-white/14 bg-[#141414] px-2 py-1 text-[12px] text-[#f5f5f5] outline-none placeholder:text-[#6f6a65] focus:border-[#c4a35a]"
                    />
                  </label>
                );
              }
              return null;
            })()}
            <button
              type="button"
              className="rounded-md border border-[#cf7f7b]/40 px-3 py-1.5 text-[12.5px] font-semibold text-[#cf7f7b]"
              onClick={() => remove(selected)}
            >
              Delete
            </button>
          </>
        ) : null}
      </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3 py-5 sm:px-4">
      <PdfPages url={pdfUrl}>
        {(page) => (
          <div
            ref={(el) => {
              if (el) overlayByPage.current.set(page, el);
              else overlayByPage.current.delete(page);
            }}
            className={`absolute inset-0 ${mode === "place" ? "cursor-crosshair" : "cursor-default"}`}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("[data-field]")) return;
              if (mode === "place") {
                place(page, e);
                return;
              }
              setSelected(null);
              setEditingId(null);
            }}
          >
            {fields
              .filter((f) => f.page === page)
              .map((f) => {
                const active = selected === f.id;
                const isEditing = editingId === f.id;
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
                      if (dragging.current) return;
                      if (f.type === "checkbox") {
                        patch(f.id, {
                          value: isCheckboxChecked(f.value) ? "" : "1",
                        });
                        return;
                      }
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setSelected(f.id);
                      if (isMrg && (f.type === "name" || f.type === "date" || f.type === "text")) {
                        setEditingId(f.id);
                      } else if (isMrg && f.type === "signature" && !f.signature_png) {
                        setPadName(f.value || mrgNameHint);
                        setSigningId(f.id);
                      } else if (f.type === "checkbox") {
                        patch(f.id, {
                          value: isCheckboxChecked(f.value) ? "" : "1",
                        });
                      }
                    }}
                    className={`@container absolute touch-none select-none overflow-visible rounded-[2px] border-2 [container-type:size] ${
                      active
                        ? "z-30 cursor-grab border-[#c4a35a] bg-[#c4a35a]/20 shadow-[0_0_0_2px_rgba(196,163,90,0.4)] active:cursor-grabbing"
                        : isMrg
                          ? "cursor-grab border-[#4ea882] bg-[#4ea882]/15 hover:border-[#6ee7b7] active:cursor-grabbing"
                          : "cursor-grab border-[#c4a35a] bg-[#c4a35a]/15 hover:border-[#dcc084] active:cursor-grabbing"
                    }`}
                  >
                    {/* Only show header on the actively selected box so it never clutters the document */}
                    {active ? (
                      <div className="absolute -top-5 left-0 right-0 z-30 flex h-[18px] items-center justify-between pointer-events-auto">
                        <div
                          data-drag-handle
                          onPointerDown={(e) => startMove(f, e)}
                          className={`flex h-full items-center gap-1 rounded-t px-1.5 text-[8.5px] font-bold tracking-wide shadow-md cursor-grab active:cursor-grabbing select-none ${
                            isMrg
                              ? "bg-[#1b4332] text-[#a7f3d0] ring-1 ring-[#4ea882]"
                              : "bg-[#614a1a] text-[#fde68a] ring-1 ring-[#c4a35a]"
                          }`}
                          title="Click and drag to move box · Arrow keys to nudge"
                        >
                          <svg viewBox="0 0 8 14" className="h-2.5 w-1.5 fill-current opacity-85" aria-hidden>
                            <circle cx="2" cy="2.5" r="1.1" />
                            <circle cx="6" cy="2.5" r="1.1" />
                            <circle cx="2" cy="7" r="1.1" />
                            <circle cx="6" cy="7" r="1.1" />
                            <circle cx="2" cy="11.5" r="1.1" />
                            <circle cx="6" cy="11.5" r="1.1" />
                          </svg>
                          <span className="uppercase font-semibold">
                            {isMrg ? "MRG" : hostFirst} · {fieldLabel(f.type)}
                          </span>
                        </div>
                        <button
                          type="button"
                          data-delete
                          title="Delete box"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            remove(f.id);
                          }}
                          className="flex h-full items-center rounded-t bg-[#cf7f7b] px-1.5 text-[8.5px] font-bold text-[#0a0a0a] shadow hover:bg-[#e0918d]"
                        >
                          ✕ Delete
                        </button>
                      </div>
                    ) : null}

                    <div className="flex h-full min-w-0 items-center overflow-hidden rounded-[1px]">
                      {f.type === "checkbox" ? (
                        <div
                          className="flex h-full w-full cursor-pointer items-center justify-center p-0.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            patch(f.id, {
                              value: isCheckboxChecked(f.value) ? "" : "1",
                            });
                          }}
                        >
                          <div className="flex h-full w-full items-center justify-center rounded-[2px] border-2 border-[#1a1408] bg-white/95 shadow-sm transition hover:scale-105">
                            {isCheckboxChecked(f.value) ? (
                              <svg viewBox="0 0 16 16" className="h-[85%] w-[85%]" aria-hidden>
                                <path
                                  d="M2.8 8.2 L6.3 11.6 L13.2 3.8"
                                  fill="none"
                                  stroke="#1a1408"
                                  strokeWidth="2.2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            ) : null}
                          </div>
                        </div>
                      ) : f.type === "signature" ? (
                        f.signature_png ? (
                          <img
                            src={f.signature_png}
                            alt=""
                            className="h-full w-full object-contain p-0.5"
                          />
                        ) : (
                          <span className="w-full truncate px-0.5 text-center font-semibold uppercase tracking-wide text-[#5a4a28] [font-size:clamp(4px,70cqh,10px)]">
                            {isMrg ? "Double-click to sign" : `${hostFirst} signs later`}
                          </span>
                        )
                      ) : isMrg ? (
                        isEditing ? (
                          <FittedFieldInput
                            autoFocus
                            value={f.value || ""}
                            placeholder={
                              f.type === "date"
                                ? todayIsoDate()
                                : f.type === "name"
                                  ? (mrgNameHint || "Printed name")
                                  : "Type here"
                            }
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === "Escape") {
                                e.stopPropagation();
                                setEditingId(null);
                              }
                            }}
                            onBlur={() => setEditingId(null)}
                            onChange={(e) => patch(f.id, { value: e.target.value })}
                          />
                        ) : (
                          <div className="flex h-full w-full min-w-0 items-center px-1" title="Double-click to type">
                            <FittedFieldText
                              className="text-[#1a1408] font-medium"
                              text={
                                f.value ||
                                (f.type === "date"
                                  ? (todayIsoDate())
                                  : f.type === "name"
                                    ? (mrgNameHint || "Printed name (double-click)")
                                    : "Type here (double-click)")
                              }
                            />
                          </div>
                        )
                      ) : (
                        <div className="flex h-full w-full min-w-0 items-center px-1">
                          <FittedFieldText
                            className="text-[#5a4a28]"
                            text={
                              f.value ||
                              (f.type === "date"
                                ? `${hostFirst}'s date`
                                : f.type === "name"
                                  ? `${hostFirst}'s name`
                                  : `${hostFirst} fills later`)
                            }
                          />
                        </div>
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
                            className={`absolute z-30 flex h-6 w-6 items-center justify-center sm:h-5 sm:w-5 ${
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
      </div>

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
