import { useEffect, useRef, useState } from "react";
import type { SopStepBox, SopStepPin } from "../../../shared/pm/sopTypes";

type ToolType = "spotlight" | "blur" | "blackout" | "pin";

interface ImageRedactorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialImageUrl?: string;
  onSave: (bakedDataUrl: string, boxes: SopStepBox[], pins: SopStepPin[]) => void;
}

const TOOLS: { id: ToolType; label: string; glyph: string; key: string; hint: string; tip: string }[] = [
  {
    id: "spotlight",
    label: "Spotlight",
    glyph: "▣",
    key: "S",
    hint: "Gold click callout",
    tip: "Drag a box around the button or field the VA must click.",
  },
  {
    id: "blur",
    label: "Blur Data",
    glyph: "◍",
    key: "B",
    hint: "Frosted blur",
    tip: "Drag a box over private door codes, payouts, or phone numbers.",
  },
  {
    id: "blackout",
    label: "Blackout",
    glyph: "■",
    key: "K",
    hint: "Opaque redaction",
    tip: "Fully opaque box — use for bank details, addresses, and dollar figures.",
  },
  {
    id: "pin",
    label: "Click Pin",
    glyph: "①",
    key: "P",
    hint: "Numbered step pin",
    tip: "Click a point to drop the next numbered pin with an optional caption.",
  },
];

export function ImageRedactorModal({
  isOpen,
  onClose,
  initialImageUrl,
  onSave,
}: ImageRedactorModalProps) {
  const [activeTool, setActiveTool] = useState<ToolType>("blur");
  const [imageSrc, setImageSrc] = useState<string | null>(initialImageUrl || null);
  const [imageMeta, setImageMeta] = useState<{ width: number; height: number; name: string } | null>(null);
  
  const [boxes, setBoxes] = useState<SopStepBox[]>([]);
  const [pins, setPins] = useState<SopStepPin[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Record<string, boolean>>({});
  const [history, setHistory] = useState<{ boxes: SopStepBox[]; pins: SopStepPin[] }[]>([]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDrawing = useRef(false);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const [currentDragBox, setCurrentDragBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Sync initial image
  useEffect(() => {
    if (initialImageUrl) {
      setImageSrc(initialImageUrl);
      const img = new Image();
      img.onload = () => {
        setImageMeta({ width: img.naturalWidth, height: img.naturalHeight, name: "screenshot.png" });
      };
      img.src = initialImageUrl;
    }
  }, [initialImageUrl]);

  // Keyboard shortcut listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
        return;
      }

      const key = e.key.toLowerCase();
      if (key === "s") setActiveTool("spotlight");
      if (key === "b") setActiveTool("blur");
      if (key === "k") setActiveTool("blackout");
      if (key === "p") setActiveTool("pin");
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, history]);

  // Clipboard paste listener (Cmd+V)
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const res = event.target?.result as string;
              if (res) {
                saveHistory();
                setImageSrc(res);
                const img = new Image();
                img.onload = () => {
                  setImageMeta({ width: img.naturalWidth, height: img.naturalHeight, name: "pasted-screenshot.png" });
                };
                img.src = res;
                setBoxes([]);
                setPins([]);
                setHiddenIds({});
              }
            };
            reader.readAsDataURL(blob);
          }
          break;
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [isOpen, boxes, pins]);

  const saveHistory = () => {
    setHistory((prev) => [...prev.slice(-20), { boxes: [...boxes], pins: [...pins] }]);
  };

  const handleUndo = () => {
    if (!history.length) return;
    const last = history[history.length - 1];
    setBoxes(last.boxes);
    setPins(last.pins);
    setHistory((prev) => prev.slice(0, -1));
  };

  const handleClearAll = () => {
    saveHistory();
    setBoxes([]);
    setPins([]);
    setHiddenIds({});
  };

  const toggleLayerVisibility = (id: string) => {
    setHiddenIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getNormalizedCoords = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const x = Math.max(0, Math.min(1, clientX / rect.width));
    const y = Math.max(0, Math.min(1, clientY / rect.height));
    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageSrc) return;
    const coords = getNormalizedCoords(e);

    if (activeTool === "pin") {
      saveHistory();
      const nextNum = pins.length + 1;
      setPins((prev) => [
        ...prev,
        {
          id: `pin-${Date.now()}`,
          number: nextNum,
          x: coords.x,
          y: coords.y,
          label: `Pin ${nextNum}`,
        },
      ]);
      return;
    }

    isDrawing.current = true;
    startPos.current = coords;
    setCurrentDragBox({ x: coords.x, y: coords.y, w: 0, h: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing.current || !startPos.current) return;
    const coords = getNormalizedCoords(e);
    const x = Math.min(startPos.current.x, coords.x);
    const y = Math.min(startPos.current.y, coords.y);
    const w = Math.abs(coords.x - startPos.current.x);
    const h = Math.abs(coords.y - startPos.current.y);
    setCurrentDragBox({ x, y, w, h });
  };

  const handleMouseUp = () => {
    if (!isDrawing.current || !currentDragBox) return;
    isDrawing.current = false;

    if (currentDragBox.w > 0.008 && currentDragBox.h > 0.008) {
      saveHistory();
      const newBox: SopStepBox = {
        id: `box-${Date.now()}`,
        type: activeTool as "spotlight" | "blur" | "blackout",
        x: currentDragBox.x,
        y: currentDragBox.y,
        w: currentDragBox.w,
        h: currentDragBox.h,
        label: `${activeTool.toUpperCase()} region`,
      };
      setBoxes((prev) => [...prev, newBox]);
    }
    setCurrentDragBox(null);
    startPos.current = null;
  };

  // Render & Bake output
  const handleSaveAndBake = () => {
    if (!imageSrc) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // 1. Draw base image
      ctx.drawImage(img, 0, 0);

      // 2. Draw non-hidden boxes
      boxes.forEach((box) => {
        if (hiddenIds[box.id]) return;

        const bx = box.x * canvas.width;
        const by = box.y * canvas.height;
        const bw = box.w * canvas.width;
        const bh = box.h * canvas.height;

        if (box.type === "blackout") {
          ctx.fillStyle = "#0a0a0a";
          ctx.fillRect(bx, by, bw, bh);
        } else if (box.type === "blur") {
          ctx.save();
          ctx.beginPath();
          ctx.rect(bx, by, bw, bh);
          ctx.clip();
          ctx.filter = "blur(14px)";
          ctx.drawImage(canvas, 0, 0);
          ctx.restore();
          
          ctx.fillStyle = "rgba(10, 10, 10, 0.40)";
          ctx.fillRect(bx, by, bw, bh);
        } else if (box.type === "spotlight") {
          ctx.strokeStyle = "#c4a35a";
          ctx.lineWidth = Math.max(3, canvas.width * 0.0035);
          ctx.strokeRect(bx, by, bw, bh);

          ctx.fillStyle = "rgba(196, 163, 90, 0.13)";
          ctx.fillRect(bx, by, bw, bh);
        }
      });

      // 3. Draw non-hidden pins
      pins.forEach((pin) => {
        if (hiddenIds[pin.id]) return;

        const px = pin.x * canvas.width;
        const py = pin.y * canvas.height;
        const radius = Math.max(14, canvas.width * 0.016);

        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fillStyle = "#c4a35a";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#0a0a0a";
        ctx.stroke();

        ctx.fillStyle = "#0a0a0a";
        ctx.font = `bold ${Math.round(radius * 1.15)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(pin.number), px, py + 1);
      });

      const bakedDataUrl = canvas.toDataURL("image/webp", 0.92);
      onSave(bakedDataUrl, boxes, pins);
      onClose();
    };
    img.src = imageSrc;
  };

  if (!isOpen) return null;

  const activeToolObj = TOOLS.find((t) => t.id === activeTool) || TOOLS[0];
  const allLayers = [
    ...boxes.map((b) => ({
      id: b.id,
      name: `${b.type === "blur" ? "Blur" : b.type === "blackout" ? "Blackout" : "Spotlight"} · region`,
      type: b.type,
      color: b.type === "blur" ? "rgba(255,255,255,0.35)" : b.type === "blackout" ? "#0a0a0a" : "#c4a35a",
    })),
    ...pins.map((p) => ({
      id: p.id,
      name: `Pin ${p.number}`,
      type: "pin",
      color: "#c4a35a",
    })),
  ];

  const visibleLayerCount = allLayers.filter((l) => !hiddenIds[l.id]).length;
  const statsLine = allLayers.length
    ? `${boxes.filter((b) => b.type === "blur" && !hiddenIds[b.id]).length} blur · ${
        boxes.filter((b) => b.type === "blackout" && !hiddenIds[b.id]).length
      } blackout · ${
        boxes.filter((b) => b.type === "spotlight" && !hiddenIds[b.id]).length
      } spotlight · ${pins.filter((p) => !hiddenIds[p.id]).length} pin`
    : "no annotations yet";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/88 backdrop-blur-md p-4 sm:p-6">
      <div className="flex h-[92vh] w-full max-w-7xl flex-col rounded-lg border border-white/10 bg-[#0e0e0e] shadow-2xl overflow-hidden">
        
        {/* Header Toolbar */}
        <div className="flex items-center justify-between gap-4 px-5 h-[62px] bg-[#141414] border-b border-white/8 shrink-0">
          <div className="flex items-center gap-3 w-[300px]">
            <span className="text-[13.5px] font-bold tracking-wide text-[#f5f5f5] whitespace-nowrap">
              Screenshot Redactor &amp; Annotator
            </span>
            <span className="font-mono text-[10px] text-[#9a9590] bg-[#0a0a0a] border border-white/10 px-2 py-1 rounded whitespace-nowrap">
              ⌘V to paste
            </span>
          </div>

          {/* Centered Tool Selection */}
          <div className="flex-1 flex justify-center">
            <div className="flex gap-1 p-1 bg-[#1c1c1c] border border-white/8 rounded-md">
              {TOOLS.map((t) => {
                const isActive = activeTool === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTool(t.id)}
                    title={t.hint}
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded transition ${
                      isActive
                        ? "bg-[#c4a35a] text-[#0a0a0a] font-bold"
                        : "text-[#9a9590] hover:text-[#f5f5f5]"
                    }`}
                  >
                    <span className="text-sm leading-none">{t.glyph}</span>
                    <span>{t.label}</span>
                    <span className="font-mono text-[9.5px] opacity-60">{t.key}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="w-[300px] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!history.length}
              className="px-3 py-1.5 bg-[#1a1a1a] border border-white/10 rounded text-xs font-semibold text-[#f5f5f5] hover:border-white/20 disabled:opacity-30"
            >
              ↶ Undo
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              disabled={!allLayers.length}
              className="px-3 py-1.5 bg-[#1a1a1a] border border-white/10 rounded text-xs font-semibold text-[#cf7f7b] hover:border-[#cf7f7b]/40 disabled:opacity-30"
            >
              Clear all
            </button>
            <div className="w-[1px] h-5 bg-white/10 mx-1" />
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold text-[#9a9590] hover:text-[#f5f5f5]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAndBake}
              disabled={!imageSrc}
              className="px-4 py-1.5 bg-[#c4a35a] text-[#0a0a0a] font-bold text-xs rounded hover:bg-[#dcc084] disabled:opacity-40 shadow-sm"
            >
              Apply to Step
            </button>
          </div>
        </div>

        {/* Main Canvas Viewport */}
        <div className="relative flex-1 flex items-center justify-center bg-[#0a0a0a] bg-[radial-gradient(#171717_1px,transparent_1px)] [background-size:16px_16px] overflow-hidden p-6 pr-48 select-none">
          
          {/* Canvas Metadata Pill */}
          {imageMeta && (
            <div className="absolute top-3.5 left-5 flex items-center gap-2.5 z-10">
              <span className="font-mono text-[10px] text-[#6f6a65] tracking-widest">
                {imageMeta.name} · {imageMeta.width} × {imageMeta.height}
              </span>
              <span className="font-mono text-[10px] text-[#6f6a65] bg-[#141414] border border-white/8 px-1.5 py-0.5 rounded">
                100%
              </span>
            </div>
          )}

          {/* Screenshot Container */}
          {imageSrc ? (
            <div
              ref={containerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              className="relative cursor-crosshair rounded border border-white/14 shadow-2xl max-h-[72vh] max-w-full overflow-hidden"
            >
              <img
                src={imageSrc}
                alt="Workspace"
                className="pointer-events-none block max-h-[72vh] max-w-full object-contain"
              />

              {/* Render Applied Annotation Boxes */}
              {boxes.map((box) => {
                if (hiddenIds[box.id]) return null;
                return (
                  <div
                    key={box.id}
                    className={`absolute pointer-events-none transition-all ${
                      box.type === "spotlight"
                        ? "border-2 border-[#c4a35a] bg-[#c4a35a]/15 shadow-[0_0_16px_rgba(196,163,90,0.35)] rounded-[3px]"
                        : box.type === "blur"
                          ? "backdrop-blur-md bg-black/40 border border-white/20 rounded-[2px]"
                          : "bg-[#0a0a0a] border border-white/10 rounded-[2px]"
                    }`}
                    style={{
                      left: `${box.x * 100}%`,
                      top: `${box.y * 100}%`,
                      width: `${box.w * 100}%`,
                      height: `${box.h * 100}%`,
                    }}
                  />
                );
              })}

              {/* Active Drag Preview */}
              {currentDragBox && (
                <div
                  className={`absolute pointer-events-none ${
                    activeTool === "spotlight"
                      ? "border-2 border-[#c4a35a] bg-[#c4a35a]/20"
                      : activeTool === "blur"
                        ? "bg-white/20 backdrop-blur-sm border border-white/40"
                        : "bg-black/90 border border-white/30"
                  }`}
                  style={{
                    left: `${currentDragBox.x * 100}%`,
                    top: `${currentDragBox.y * 100}%`,
                    width: `${currentDragBox.w * 100}%`,
                    height: `${currentDragBox.h * 100}%`,
                  }}
                />
              )}

              {/* Render Applied Pins */}
              {pins.map((pin) => {
                if (hiddenIds[pin.id]) return null;
                return (
                  <div
                    key={pin.id}
                    className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-black bg-[#c4a35a] text-xs font-bold text-black shadow-lg ring-4 ring-[#c4a35a]/20"
                    style={{
                      left: `${pin.x * 100}%`,
                      top: `${pin.y * 100}%`,
                    }}
                  >
                    {pin.number}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/15 p-12 text-center">
              <p className="text-base font-semibold text-[#f5f5f5]">
                Paste a screenshot or upload an image
              </p>
              <p className="mt-1 text-xs text-[#9a9590]">
                Press <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[#f5f5f5]">⌘V</kbd> to paste directly from your clipboard
              </p>
            </div>
          )}

          {/* Right Layers Panel */}
          <div className="absolute right-4 top-14 w-44 rounded-md border border-white/10 bg-[#111111] overflow-hidden shadow-xl z-20">
            <div className="flex items-center justify-between px-3 py-2 bg-[#161616] border-b border-white/8">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#9a9590]">
                Layers
              </span>
              <span className="font-mono text-[10px] text-[#6f6a65]">
                {visibleLayerCount}/{allLayers.length}
              </span>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-white/5">
              {allLayers.map((l) => {
                const isHidden = hiddenIds[l.id];
                return (
                  <div
                    key={l.id}
                    onClick={() => toggleLayerVisibility(l.id)}
                    className="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-[#161616] transition"
                  >
                    <div
                      className="h-2.5 w-2.5 rounded-sm shrink-0 border border-white/20"
                      style={{ backgroundColor: l.color, opacity: isHidden ? 0.3 : 1 }}
                    />
                    <span
                      className={`flex-1 truncate text-[11px] ${
                        isHidden ? "text-[#6f6a65] line-through" : "text-[#cfc9c2]"
                      }`}
                    >
                      {l.name}
                    </span>
                    <span className="text-[10px] text-[#6f6a65]">
                      {isHidden ? "hidden" : "◉"}
                    </span>
                  </div>
                );
              })}
              {!allLayers.length && (
                <div className="p-3 text-[10.5px] text-[#6f6a65] text-center">
                  No annotations yet
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 h-[54px] bg-[#141414] border-t border-white/8 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider bg-[#c4a35a] text-[#0a0a0a] px-2.5 py-1 rounded">
              Active: {activeToolObj.label}
            </span>
            <span className="text-xs text-[#9a9590]">{activeToolObj.tip}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-[11px] text-[#6f6a65]">{statsLine}</span>
            <span className="font-mono text-[10px] text-[#6f6a65] bg-[#0a0a0a] border border-white/10 px-2 py-1 rounded">
              ⌘Z undo · S, B, K, P shortcuts
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
