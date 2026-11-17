import { useEffect, useRef, useState } from "react";
import { PdfPages, fieldStyle, FittedFieldInput, FittedFieldText } from "../../../lib/pdfPages";
import { SignaturePad } from "../../../lib/SignaturePad";
import {
  defaultFieldSize,
  fieldLabel,
  firstNameOf,
  hasHostSignature,
  isCheckboxChecked,
  minFieldSize,
  mrgFields,
  newFieldId,
  todayIsoDate,
  type SignField,
  type SignFieldType,
  type SignParty,
} from "../../../../shared/pm/signFields";
import { Icon } from "./icons";

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

export function SignPlaceScreen({
  pdfUrl,
  fields,
  onChange,
  mrgNameHint = "",
  hostNameHint = "",
  subtitle,
  replaceMode,
  busy,
  phone,
  onBack,
  onSend,
}: {
  pdfUrl: string;
  fields: SignField[];
  onChange: (next: SignField[]) => void;
  mrgNameHint?: string;
  hostNameHint?: string;
  subtitle?: string;
  replaceMode?: boolean;
  busy?: boolean;
  phone?: boolean;
  onBack: () => void;
  onSend: () => void;
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
  const hostOk = hasHostSignature(fields);
  const mrgOk =
    hostOk &&
    !mrgFields(fields).some((f) => f.type === "signature" && !f.signature_png) &&
    mrgFields(fields).some((f) => f.type === "signature");
  const sendBlocked = !hostOk
    ? `Place a Sign here box for ${hostFirst} — that’s where they sign.`
    : mrgFields(fields).some((f) => f.type === "signature" && !f.signature_png) ||
        !mrgFields(fields).some((f) => f.type === "signature")
      ? "Send is off until both signature boxes are placed."
      : null;

  const toolButtons: { type: "move" | SignFieldType; icon: "move" | "sign" | "font" | "cal" | "text" | "box"; label: string }[] = [
    { type: "move", icon: "move", label: "Move" },
    { type: "signature", icon: "sign", label: "Signature" },
    { type: "name", icon: "font", label: "Name" },
    { type: "date", icon: "cal", label: "Date" },
    { type: "text", icon: "text", label: "Text" },
    { type: "checkbox", icon: "box", label: "Checkbox" },
  ];

  const who = (
    <div className="who" style={phone ? { display: "flex", marginBottom: 8, width: "100%" } : undefined}>
      <button
        type="button"
        className={(tool === "checkbox" ? "mrg" : party) === "host" ? "on" : undefined}
        disabled={tool === "checkbox"}
        style={phone ? { flex: 1, justifyContent: "center", height: 36 } : undefined}
        onClick={() => setParty("host")}
      >
        <i style={{ background: "oklch(0.6 0.15 255)" }} />
        Host fills later
      </button>
      <button
        type="button"
        className={(tool === "checkbox" ? "mrg" : party) === "mrg" ? "on" : undefined}
        style={phone ? { flex: 1, justifyContent: "center", height: 36 } : undefined}
        onClick={() => setParty("mrg")}
      >
        <i style={{ background: "oklch(0.55 0.15 300)" }} />
        MRG fills now
      </button>
    </div>
  );

  const tools = toolButtons.map((t) => {
    const on = t.type === "move" ? mode === "move" : mode === "place" && tool === t.type;
    return (
      <button
        key={t.label}
        type="button"
        className={`tool${on ? " on" : ""}`}
        style={phone ? { height: 44, flexDirection: "column", gap: 2, padding: "0 9px", fontSize: 11, justifyContent: "center" } : undefined}
        onClick={() => (t.type === "move" ? enterMove() : enterPlace(t.type))}
      >
        <Icon name={t.icon} className="i sm" />
        <span className="tlbl">{t.label}</span>
      </button>
    );
  });

  return (
    <div className="pl" style={phone ? { position: "fixed", inset: 0, zIndex: 50, height: "100dvh" } : { position: "fixed", inset: 0, zIndex: 50 }}>
      <div className="pltop" style={phone ? { padding: "8px 10px", gap: 6 } : undefined}>
        {phone ? (
          <button type="button" className="iconbtn" onClick={onBack} aria-label="Back">
            <Icon name="back" />
          </button>
        ) : (
          <button type="button" className="btn" onClick={onBack}>
            <Icon name="back" className="i sm" />
            Back
          </button>
        )}
        <div className="t">
          <b style={phone ? { fontSize: "var(--t-base)" } : undefined}>{phone ? "Place fields" : "Place fields and sign"}</b>
          <span className="meta">{subtitle || "Agreement PDF"}</span>
        </div>
        {phone ? (
          <button type="button" className="btn primary" style={{ height: 40 }} disabled={busy || Boolean(sendBlocked)} onClick={onSend}>
            {busy ? "Sending…" : replaceMode ? "Resend" : "Send invite"}
          </button>
        ) : (
          <div className="sendwrap">
            <span className={`need ${hostOk ? "ok" : "no"}`}>
              <Icon name={hostOk ? "check" : "alert"} className="i xs" />
              Host signature
            </span>
            <span className={`need ${mrgOk ? "ok" : "no"}`}>
              <Icon name={mrgOk ? "check" : "alert"} className="i xs" />
              MRG signature
            </span>
            <button type="button" className="btn primary" disabled={busy || Boolean(sendBlocked)} onClick={onSend}>
              <Icon name="mail" className="i sm" />
              {busy ? (replaceMode ? "Replacing…" : "Sending…") : replaceMode ? "Replace & resend" : "Send invite"}
            </button>
          </div>
        )}
      </div>

      {sendBlocked ? (
        <div
          style={{
            background: "oklch(0.6 0.14 65 / .1)",
            borderBottom: "1px solid oklch(0.6 0.14 65 / .25)",
            padding: phone ? "8px 14px" : "8px 20px",
            fontSize: phone ? "var(--t-xs)" : "var(--t-sm)",
            color: "var(--ink)",
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <Icon name="alert" className="i sm" />
          <span>
            <b style={{ color: "var(--amberink)" }}>{phone ? "Send is off." : "Send is off until both signature boxes are placed."}</b>{" "}
            {phone ? "Place an MRG signature box too." : sendBlocked}
          </span>
        </div>
      ) : phone ? (
        <div
          style={{
            background: "oklch(0.6 0.13 155 / .1)",
            padding: "8px 14px",
            fontSize: "var(--t-xs)",
            fontWeight: 500,
            color: "var(--ink)",
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <span className="need ok">
            <Icon name="check" className="i xs" />
            Host signature
          </span>
          <span className="need ok">
            <Icon name="check" className="i xs" />
            MRG signature
          </span>
          <span>Ready to send</span>
        </div>
      ) : null}

      {!phone ? (
        <>
          <div className="pltools">
            {tools[0]}
            <span className="vsep" />
            <span className="meta" style={{ marginRight: 2, whiteSpace: "nowrap" }}>
              Who fills it
            </span>
            {who}
            <span className="vsep" />
            {tools.slice(1)}
            <span style={{ flex: 1 }} />
          </div>
          <div className="plhint" style={{ padding: "8px 20px 0", justifyContent: "center" }}>
            <Icon name="alert" className="i xs" />
            Click the page to place. Drag to move, pull a corner to resize, × to delete. Double-click an MRG signature to sign it.
          </div>
        </>
      ) : null}

      <div className="plcanvas" style={phone ? { padding: "14px 0", alignItems: "center" } : undefined}>
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

      {phone ? (
        <div style={{ background: "#fff", borderTop: "1px solid var(--line)", padding: "10px 12px 26px", flex: "none" }}>
          {who}
          <div style={{ display: "flex", gap: 6, overflow: "auto" }}>{tools}</div>
        </div>
      ) : null}

      {signing ? (
        <SignaturePad
          title="Sign for Mandel Realty Group"
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
