import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SopStepBox, SopStepPin } from "../../../shared/pm/sopTypes";

type ToolType = "spotlight" | "blur" | "blackout" | "pin";

const EMPTY_BOXES: SopStepBox[] = [];
const EMPTY_PINS: SopStepPin[] = [];

interface ImageRedactorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialImageUrl?: string;
  rawImageUrl?: string;
  initialBoxes?: SopStepBox[];
  initialPins?: SopStepPin[];
  onSave: (
    bakedDataUrl: string,
    boxes: SopStepBox[],
    pins: SopStepPin[],
    rawImageUrl?: string
  ) => void;
}

const TOOLS: {
  id: ToolType;
  label: string;
  glyph: string;
  key: string;
  hint: string;
  tip: string;
}[] = [
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
    tip: "Click anywhere on the image to drop a pin. You can customize the number and caption.",
  },
];

export function ImageRedactorModal({
  isOpen,
  onClose,
  initialImageUrl,
  rawImageUrl,
  initialBoxes,
  initialPins,
  onSave,
}: ImageRedactorModalProps) {
  const seedBoxes = initialBoxes ?? EMPTY_BOXES;
  const seedPins = initialPins ?? EMPTY_PINS;
  const [activeTool, setActiveTool] = useState<ToolType>("blur");
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [cleanImageSrc, setCleanImageSrc] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const [boxes, setBoxes] = useState<SopStepBox[]>([]);
  const [pins, setPins] = useState<SopStepPin[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Record<string, boolean>>({});
  const [history, setHistory] = useState<{ boxes: SopStepBox[]; pins: SopStepPin[] }[]>([]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isDrawing = useRef(false);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const activeToolRef = useRef<ToolType>(activeTool);
  const currentDragBoxRef = useRef<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const [currentDragBox, setCurrentDragBox] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  const setDragBox = (box: { x: number; y: number; w: number; h: number } | null) => {
    currentDragBoxRef.current = box;
    setCurrentDragBox(box);
  };

  // Focus ref for auto-focusing caption input
  const activeInputRef = useRef<HTMLInputElement | null>(null);
  const initializedForOpenRef = useRef(false);

  // Sync initial state once when the modal opens — not on every parent re-render.
  // Default `[]` props were creating new array refs each render and wiping annotations.
  useEffect(() => {
    if (!isOpen) {
      initializedForOpenRef.current = false;
      return;
    }

    if (initializedForOpenRef.current) return;
    initializedForOpenRef.current = true;

    const base = rawImageUrl || initialImageUrl || null;
    setImageSrc(base);
    setCleanImageSrc(base);
    setBoxes(seedBoxes.length > 0 ? JSON.parse(JSON.stringify(seedBoxes)) : []);
    setPins(seedPins.length > 0 ? JSON.parse(JSON.stringify(seedPins)) : []);
    setSelectedLayerId(null);
    setHiddenIds({});
    setHistory([]);
    setCurrentDragBox(null);
    isDrawing.current = false;
    startPos.current = null;
    currentDragBoxRef.current = null;
  }, [isOpen, initialImageUrl, rawImageUrl, seedBoxes, seedPins]);

  // Focus input when a layer is selected
  useEffect(() => {
    if (selectedLayerId) {
      setTimeout(() => {
        activeInputRef.current?.focus();
      }, 50);
    }
  }, [selectedLayerId]);

  // Keyboard shortcut listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing inside inputs or textareas
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        if (e.key === "Escape") {
          setSelectedLayerId(null);
        }
        return;
      }

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
      if (e.key === "Escape") {
        if (selectedLayerId) {
          setSelectedLayerId(null);
        } else {
          onClose();
        }
      }
      if ((e.key === "Backspace" || e.key === "Delete") && selectedLayerId) {
        deleteLayer(selectedLayerId);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, history, selectedLayerId, boxes, pins]);

  // Process and load an image File or Blob
  const loadImageFile = (file: File | Blob) => {
    if (!file || (file.type && !file.type.startsWith("image/"))) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const res = event.target?.result as string;
      if (res) {
        saveHistory();
        setImageSrc(res);
        setCleanImageSrc(res);
        setBoxes([]);
        setPins([]);
        setSelectedLayerId(null);
        setHiddenIds({});
      }
    };
    reader.readAsDataURL(file);
  };

  // Clipboard paste listener (Cmd+V)
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      // Ignore if user is pasting text into an input
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            loadImageFile(blob);
          }
          break;
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [isOpen, boxes, pins]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      loadImageFile(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadImageFile(file);
    }
    e.target.value = "";
  };

  const saveHistory = () => {
    setHistory((prev) => [
      ...prev.slice(-25),
      { boxes: JSON.parse(JSON.stringify(boxes)), pins: JSON.parse(JSON.stringify(pins)) },
    ]);
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
    setSelectedLayerId(null);
    setHiddenIds({});
  };

  const toggleLayerVisibility = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setHiddenIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const deleteLayer = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    saveHistory();
    if (id.startsWith("pin-")) {
      setPins((prev) => prev.filter((p) => p.id !== id));
    } else {
      setBoxes((prev) => prev.filter((b) => b.id !== id));
    }
    if (selectedLayerId === id) {
      setSelectedLayerId(null);
    }
  };

  const updatePinNumber = (id: string, newNumber: string | number) => {
    setPins((prev) =>
      prev.map((p) => (p.id === id ? { ...p, number: newNumber } : p))
    );
  };

  const updatePinCaption = (id: string, newLabel: string) => {
    setPins((prev) =>
      prev.map((p) => (p.id === id ? { ...p, label: newLabel } : p))
    );
  };

  const updateBoxLabel = (id: string, newLabel: string) => {
    setBoxes((prev) =>
      prev.map((b) => (b.id === id ? { ...b, label: newLabel } : b))
    );
  };

  const getNormalizedCoords = (clientX: number, clientY: number) => {
    const img = imageRef.current;
    if (!img) {
      const container = containerRef.current;
      if (!container) return { x: 0, y: 0 };
      const rect = container.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
        y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
      };
    }

    const rect = img.getBoundingClientRect();
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;

    if (!nw || !nh || !rect.width || !rect.height) {
      return {
        x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
        y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
      };
    }

    const imageAspect = nw / nh;
    const elementAspect = rect.width / rect.height;
    let displayW: number;
    let displayH: number;
    let offsetX = 0;
    let offsetY = 0;

    if (imageAspect > elementAspect) {
      displayW = rect.width;
      displayH = rect.width / imageAspect;
      offsetY = (rect.height - displayH) / 2;
    } else {
      displayH = rect.height;
      displayW = rect.height * imageAspect;
      offsetX = (rect.width - displayW) / 2;
    }

    const x = (clientX - rect.left - offsetX) / displayW;
    const y = (clientY - rect.top - offsetY) / displayH;

    return {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
    };
  };

  const getNextPinNumber = () => {
    const numericPins = pins
      .map((p) => Number(p.number))
      .filter((n) => !isNaN(n) && Number.isInteger(n) && n > 0);
    if (!numericPins.length) return pins.length + 1;
    return Math.max(...numericPins) + 1;
  };

  const finishDrawingBox = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    const dragBox = currentDragBoxRef.current;
    if (dragBox && dragBox.w > 0.008 && dragBox.h > 0.008) {
      saveHistory();
      const tool = activeToolRef.current;
      const newBox: SopStepBox = {
        id: `box-${Date.now()}`,
        type: tool as "spotlight" | "blur" | "blackout",
        x: dragBox.x,
        y: dragBox.y,
        w: dragBox.w,
        h: dragBox.h,
        label: `${tool.toUpperCase()} region`,
      };
      setBoxes((prev) => [...prev, newBox]);
      setSelectedLayerId(newBox.id);
    }

    setDragBox(null);
    startPos.current = null;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!imageSrc) return;
    if (e.button !== 0) return;

    const coords = getNormalizedCoords(e.clientX, e.clientY);
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();

    if (activeTool === "pin") {
      saveHistory();
      const nextNum = getNextPinNumber();
      const newPin: SopStepPin = {
        id: `pin-${Date.now()}`,
        number: nextNum,
        x: coords.x,
        y: coords.y,
        label: "",
      };
      setPins((prev) => [...prev, newPin]);
      setSelectedLayerId(newPin.id);
      return;
    }

    setSelectedLayerId(null);
    isDrawing.current = true;
    startPos.current = coords;
    setDragBox({ x: coords.x, y: coords.y, w: 0, h: 0 });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawing.current || !startPos.current) return;
    const coords = getNormalizedCoords(e.clientX, e.clientY);
    const x = Math.min(startPos.current.x, coords.x);
    const y = Math.min(startPos.current.y, coords.y);
    const w = Math.abs(coords.x - startPos.current.x);
    const h = Math.abs(coords.y - startPos.current.y);
    setDragBox({ x, y, w, h });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    finishDrawingBox();
  };

  useEffect(() => {
    if (!isOpen) return;

    const onWindowPointerUp = () => finishDrawingBox();
    window.addEventListener("pointerup", onWindowPointerUp);
    window.addEventListener("pointercancel", onWindowPointerUp);
    return () => {
      window.removeEventListener("pointerup", onWindowPointerUp);
      window.removeEventListener("pointercancel", onWindowPointerUp);
    };
  }, [isOpen]);

  // Render & Bake composite image
  const handleSaveAndBake = () => {
    const baseSource = cleanImageSrc || imageSrc;
    if (!baseSource) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // 1. Draw base clean image
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

        const pinText = String(pin.number ?? "");
        const px = pin.x * canvas.width;
        const py = pin.y * canvas.height;
        const radius = Math.max(14, canvas.width * 0.016);

        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fillStyle = "#c4a35a";
        ctx.fill();
        ctx.lineWidth = Math.max(2, canvas.width * 0.002);
        ctx.strokeStyle = "#0a0a0a";
        ctx.stroke();

        const fontSize = Math.round(
          radius * (pinText.length > 2 ? 0.8 : pinText.length > 1 ? 0.95 : 1.15)
        );
        ctx.fillStyle = "#0a0a0a";
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(pinText, px, py + 1);
      });

      const bakedDataUrl = canvas.toDataURL("image/webp", 0.92);
      onSave(bakedDataUrl, boxes, pins, baseSource);
      onClose();
    };
    img.src = baseSource;
  };

  if (!isOpen) return null;

  const activeToolObj = TOOLS.find((t) => t.id === activeTool) || TOOLS[0];

  const allLayers = [
    ...boxes.map((b) => ({
      id: b.id,
      kind: "box" as const,
      number: null,
      type: b.type,
      name: b.label || `${b.type === "blur" ? "Blur" : b.type === "blackout" ? "Blackout" : "Spotlight"} Region`,
      color: b.type === "blur" ? "rgba(255,255,255,0.4)" : b.type === "blackout" ? "#0a0a0a" : "#c4a35a",
      glyph: b.type === "blur" ? "◍" : b.type === "blackout" ? "■" : "▣",
    })),
    ...pins.map((p) => ({
      id: p.id,
      kind: "pin" as const,
      number: p.number,
      type: "pin" as const,
      name: p.label || `Step ${p.number} Callout`,
      color: "#c4a35a",
      glyph: String(p.number),
    })),
  ];

  const visibleLayerCount = allLayers.filter((l) => !hiddenIds[l.id]).length;
  const selectedPin = pins.find((p) => p.id === selectedLayerId);

  const statsLine = allLayers.length
    ? `${boxes.filter((b) => b.type === "blur" && !hiddenIds[b.id]).length} blur · ${
        boxes.filter((b) => b.type === "blackout" && !hiddenIds[b.id]).length
      } blackout · ${
        boxes.filter((b) => b.type === "spotlight" && !hiddenIds[b.id]).length
      } spotlight · ${pins.filter((p) => !hiddenIds[p.id]).length} pins`
    : "No annotations yet";

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/88 backdrop-blur-md p-3 sm:p-5">
      <div className="flex h-[92vh] w-full max-w-7xl flex-col rounded-lg border border-white/10 bg-[#0e0e0e] shadow-2xl overflow-hidden">
        
        {/* Header Toolbar */}
        <div className="flex items-center justify-between gap-4 px-5 h-[62px] bg-[#141414] border-b border-white/8 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[13.5px] font-bold tracking-wide text-[#f5f5f5] whitespace-nowrap">
              Screenshot Redactor &amp; Annotator
            </span>
            <span className="font-mono text-[10px] text-[#9a9590] bg-[#0a0a0a] border border-white/10 px-2 py-1 rounded whitespace-nowrap">
              ⌘V to paste
            </span>
            {imageSrc && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded bg-[#1a1a1a] border border-[#c4a35a]/30 text-[#c4a35a] hover:bg-[#c4a35a]/10 hover:border-[#c4a35a]/50 transition whitespace-nowrap"
                title="Replace image with a new file or screenshot"
              >
                <span>↻</span>
                <span>Replace Image</span>
              </button>
            )}
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
                    onClick={() => {
                      setActiveTool(t.id);
                      if (t.id !== "pin") {
                        setSelectedLayerId(null);
                      }
                    }}
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
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!history.length}
              className="px-3 py-1.5 bg-[#1a1a1a] border border-white/10 rounded text-xs font-semibold text-[#f5f5f5] hover:border-white/20 disabled:opacity-30"
              title="Undo last action (⌘Z)"
            >
              ↶ Undo
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              disabled={!allLayers.length}
              className="px-3 py-1.5 bg-[#1a1a1a] border border-white/10 rounded text-xs font-semibold text-[#cf7f7b] hover:border-[#cf7f7b]/40 disabled:opacity-30"
              title="Remove all redactions and pins"
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
              className="px-4 py-1.5 bg-[#c4a35a] text-[#0a0a0a] font-bold text-xs rounded hover:bg-[#dcc084] disabled:opacity-40 shadow-sm transition"
            >
              Apply to Step
            </button>
          </div>
        </div>

        {/* Main Editor Body: Canvas Viewport + Right Side Elements Sidebar */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          
          {/* Main Canvas Viewport */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative flex-1 flex items-center justify-center bg-[#0a0a0a] bg-[radial-gradient(#171717_1px,transparent_1px)] [background-size:16px_16px] overflow-auto p-6 select-none transition ${
              isDragOver ? "bg-[#14120c] ring-2 ring-inset ring-[#c4a35a]" : ""
            }`}
          >
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileInputChange}
              className="hidden"
            />

            {/* Screenshot Container */}
            {imageSrc ? (
              <div
                ref={containerRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                className="relative cursor-crosshair rounded border border-white/14 shadow-2xl max-h-[72vh] max-w-full overflow-visible touch-none"
              >
                <img
                  ref={imageRef}
                  src={imageSrc}
                  alt="Workspace"
                  draggable={false}
                  className="pointer-events-none block max-h-[72vh] max-w-full object-contain select-none"
                />

                {/* Render Applied Annotation Boxes */}
                {boxes.map((box) => {
                  if (hiddenIds[box.id]) return null;
                  const isSelected = selectedLayerId === box.id;
                  return (
                    <div
                      key={box.id}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setSelectedLayerId(box.id);
                      }}
                      className={`absolute cursor-pointer transition-all ${
                        box.type === "spotlight"
                          ? `border-2 border-[#c4a35a] bg-[#c4a35a]/15 rounded-[3px] ${
                              isSelected
                                ? "ring-2 ring-white shadow-[0_0_20px_rgba(196,163,90,0.6)]"
                                : "shadow-[0_0_16px_rgba(196,163,90,0.35)]"
                            }`
                          : box.type === "blur"
                            ? `backdrop-blur-md bg-black/40 border rounded-[2px] ${
                                isSelected ? "border-[#c4a35a] ring-2 ring-[#c4a35a]/50" : "border-white/20"
                              }`
                            : `bg-[#0a0a0a] border rounded-[2px] ${
                                isSelected ? "border-[#c4a35a] ring-2 ring-[#c4a35a]/50" : "border-white/10"
                              }`
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
                  const isSelected = selectedLayerId === pin.id;
                  const pinText = String(pin.number ?? "");

                  return (
                    <div
                      key={pin.id}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setSelectedLayerId(pin.id);
                      }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group/pin z-20"
                      style={{
                        left: `${pin.x * 100}%`,
                        top: `${pin.y * 100}%`,
                      }}
                    >
                      {/* Pin Circle Badge */}
                      <div
                        className={`flex h-7 min-w-[28px] px-1 items-center justify-center rounded-full border-2 border-black bg-[#c4a35a] font-mono text-xs font-bold text-black shadow-lg transition-transform ${
                          isSelected
                            ? "scale-125 ring-4 ring-white shadow-[0_0_15px_rgba(255,255,255,0.7)]"
                            : "ring-4 ring-[#c4a35a]/25 group-hover/pin:scale-110"
                        }`}
                      >
                        {pinText}
                      </div>

                      {/* Floating In-Place Caption Popover / Bubble (when selected) */}
                      {isSelected && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2.5 w-72 rounded-lg border border-[#c4a35a]/40 bg-[#141414]/95 backdrop-blur-md p-3 shadow-2xl z-30 flex flex-col gap-2"
                        >
                          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#c4a35a]">
                            <span>Edit Pin #{pinText}</span>
                            <button
                              type="button"
                              onClick={(e) => deleteLayer(pin.id, e)}
                              className="text-[#cf7f7b] hover:text-white px-1 py-0.5 rounded text-[10px]"
                              title="Delete pin"
                            >
                              ✕ Delete
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex flex-col gap-1 w-16 shrink-0">
                              <label className="text-[9px] font-bold uppercase tracking-wider text-[#9a9590]">
                                Pin #
                              </label>
                              <input
                                type="text"
                                value={pin.number ?? ""}
                                onChange={(e) => updatePinNumber(pin.id, e.target.value)}
                                className="w-full text-center font-mono font-bold rounded border border-white/10 bg-[#0a0a0a] px-1 py-1.5 text-xs text-[#c4a35a] outline-none focus:border-[#c4a35a]"
                              />
                            </div>
                            <div className="flex flex-col gap-1 flex-1 min-w-0">
                              <label className="text-[9px] font-bold uppercase tracking-wider text-[#9a9590]">
                                Caption
                              </label>
                              <input
                                ref={activeInputRef}
                                type="text"
                                value={pin.label || ""}
                                onChange={(e) => updatePinCaption(pin.id, e.target.value)}
                                placeholder="e.g. Click 'Listings' tab..."
                                className="w-full rounded border border-white/10 bg-[#0a0a0a] px-2.5 py-1.5 text-xs text-[#f5f5f5] placeholder:text-[#6f6a65] outline-none focus:border-[#c4a35a]"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition max-w-lg ${
                  isDragOver
                    ? "border-[#c4a35a] bg-[#c4a35a]/10 scale-[1.02]"
                    : "border-white/15 hover:border-[#c4a35a]/50 hover:bg-[#141414]"
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1a1a1a] border border-white/10 text-[#c4a35a] mb-3.5">
                  <span className="text-xl">↑</span>
                </div>
                <p className="text-base font-semibold text-[#f5f5f5]">
                  Upload a screenshot or paste from clipboard
                </p>
                <p className="mt-1 text-xs text-[#9a9590] max-w-xs">
                  Drag &amp; drop an image file here, click to browse files, or press{" "}
                  <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[#f5f5f5] font-mono">⌘V</kbd> to paste directly.
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="mt-4 flex items-center gap-2 rounded-md bg-[#c4a35a] px-4 py-2 text-xs font-bold text-[#0a0a0a] hover:bg-[#dcc084] transition shadow-md"
                >
                  <span>📁</span>
                  <span>Browse Files</span>
                </button>
              </div>
            )}
          </div>

          {/* Right Elements / Layers Sidebar */}
          <div className="w-80 shrink-0 border-l border-white/8 bg-[#111111] flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-[#161616] border-b border-white/8 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#f5f5f5]">
                  Elements &amp; Layers
                </span>
                <span className="font-mono text-[10px] text-[#9a9590] bg-[#0a0a0a] border border-white/10 px-1.5 py-0.5 rounded">
                  {visibleLayerCount}/{allLayers.length}
                </span>
              </div>
            </div>

            {/* List of All Annotations */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {allLayers.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <div className="text-2xl opacity-40 mb-2">① ◍ ▣</div>
                  <p className="text-xs font-semibold text-[#9a9590]">No elements added yet</p>
                  <p className="text-[11px] text-[#6f6a65] mt-1 leading-relaxed">
                    Select <span className="text-[#c4a35a] font-semibold">Click Pin</span> to drop numbered callouts with captions, or drag a box to blur/spotlight.
                  </p>
                </div>
              ) : (
                allLayers.map((layer) => {
                  const isHidden = hiddenIds[layer.id];
                  const isSelected = selectedLayerId === layer.id;
                  const isPin = layer.kind === "pin";
                  const pinItem = isPin ? pins.find((p) => p.id === layer.id) : null;
                  const boxItem = !isPin ? boxes.find((b) => b.id === layer.id) : null;

                  return (
                    <div
                      key={layer.id}
                      onClick={() => setSelectedLayerId(layer.id)}
                      className={`group/item rounded-lg border p-2.5 transition cursor-pointer flex flex-col gap-2 ${
                        isSelected
                          ? "border-[#c4a35a] bg-[#1a1712] shadow-sm ring-1 ring-[#c4a35a]/30"
                          : "border-white/8 bg-[#141414] hover:border-white/20 hover:bg-[#181818]"
                      }`}
                    >
                      {/* Layer Header Row */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {isPin ? (
                            <span className="flex h-5 min-w-[20px] px-1 shrink-0 items-center justify-center rounded-full bg-[#c4a35a] font-mono text-[11px] font-bold text-black">
                              {pinItem?.number ?? layer.number}
                            </span>
                          ) : (
                            <div
                              className="h-3.5 w-3.5 rounded-sm shrink-0 border border-white/20 flex items-center justify-center text-[9px]"
                              style={{ backgroundColor: layer.color }}
                            />
                          )}
                          <span
                            className={`text-xs font-semibold truncate ${
                              isHidden ? "text-[#6f6a65] line-through" : "text-[#f5f5f5]"
                            }`}
                          >
                            {isPin ? `Pin #${pinItem?.number ?? layer.number}` : layer.name}
                          </span>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => toggleLayerVisibility(layer.id, e)}
                            title={isHidden ? "Show layer" : "Hide layer"}
                            className="p-1 text-xs text-[#6f6a65] hover:text-[#f5f5f5] rounded hover:bg-white/5 transition"
                          >
                            {isHidden ? "👁‍🗨" : "👁"}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => deleteLayer(layer.id, e)}
                            title="Delete element"
                            className="p-1 text-xs text-[#6f6a65] hover:text-[#cf7f7b] rounded hover:bg-white/5 transition"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* Editable Fields */}
                      {isPin ? (
                        <div className="grid grid-cols-[56px_1fr] gap-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col gap-1">
                            <label className="text-[9.5px] font-bold uppercase tracking-wider text-[#6f6a65]">
                              Pin #
                            </label>
                            <input
                              type="text"
                              value={pinItem?.number ?? ""}
                              onChange={(e) => updatePinNumber(layer.id, e.target.value)}
                              className="w-full rounded border border-white/10 bg-[#0a0a0a] px-2 py-1.5 text-center font-mono font-bold text-xs text-[#c4a35a] outline-none focus:border-[#c4a35a]"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[9.5px] font-bold uppercase tracking-wider text-[#6f6a65]">
                              Action Caption
                            </label>
                            <input
                              type="text"
                              value={pinItem?.label || ""}
                              onChange={(e) => updatePinCaption(layer.id, e.target.value)}
                              placeholder="e.g. Click 'Listings' tab..."
                              className="w-full rounded border border-white/10 bg-[#0a0a0a] px-2.5 py-1.5 text-xs text-[#f5f5f5] placeholder:text-[#4d4a47] outline-none focus:border-[#c4a35a] transition"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                          <label className="text-[9.5px] font-bold uppercase tracking-wider text-[#6f6a65]">
                            Region Note
                          </label>
                          <input
                            type="text"
                            value={boxItem?.label || ""}
                            onChange={(e) => updateBoxLabel(layer.id, e.target.value)}
                            placeholder="e.g. Blur guest door code..."
                            className="w-full rounded border border-white/10 bg-[#0a0a0a] px-2.5 py-1.5 text-xs text-[#f5f5f5] placeholder:text-[#4d4a47] outline-none focus:border-[#c4a35a] transition"
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Selected Layer Info Footer */}
            {selectedPin && (
              <div className="p-3 bg-[#161310] border-t border-[#c4a35a]/20 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#c4a35a]">Active Pin #{selectedPin.number}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedLayerId(null)}
                    className="text-[11px] text-[#9a9590] hover:text-white"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
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
              ⌘Z undo · S, B, K, P shortcuts · Del to remove
            </span>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
