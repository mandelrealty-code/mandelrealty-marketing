import { useEffect, useState, forwardRef, useRef, type CSSProperties, type InputHTMLAttributes, type ReactNode } from "react";
import { getDocument, GlobalWorkerOptions, version } from "pdfjs-dist";
import type { SignField } from "../../shared/pm/signFields";

if (typeof window !== "undefined") {
  GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
}

export type PdfPageSize = { page: number; width: number; height: number };

export function PdfPages({
  url,
  onReady,
  children,
}: {
  url: string;
  onReady?: (pages: number) => void;
  children?: (page: number, size: PdfPageSize) => ReactNode;
}) {
  const [canvases, setCanvases] = useState<
    Array<{ page: number; dataUrl: string; width: number; height: number }>
  >([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setCanvases([]);
    setError("");
    (async () => {
      try {
        const pdf = await getDocument({ url, withCredentials: false }).promise;
        const rendered: typeof canvases = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.35 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvas, canvasContext: ctx, viewport }).promise;
          rendered.push({
            page: i,
            dataUrl: canvas.toDataURL("image/png"),
            width: viewport.width,
            height: viewport.height,
          });
        }
        if (!cancelled) {
          setCanvases(rendered);
          onReady?.(pdf.numPages);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not render PDF.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, onReady]);

  if (error) {
    return <p className="p-6 text-center text-sm text-[#cf7f7b]">{error}</p>;
  }
  if (!canvases.length) {
    return (
      <p className="p-10 text-center text-sm text-[#6f6a65]">Loading agreement…</p>
    );
  }

  return (
    <div className="flex flex-col gap-6 pt-4">
      {canvases.map((c) => (
        <div
          key={c.page}
          className="relative mx-auto w-full max-w-[820px] overflow-visible bg-white shadow-lg"
          data-pdf-page={c.page}
        >
          <img src={c.dataUrl} alt={`Page ${c.page}`} className="block w-full h-auto" />
          {children?.(c.page, { page: c.page, width: c.width, height: c.height })}
        </div>
      ))}
    </div>
  );
}

export function fieldStyle(f: SignField): CSSProperties {
  return {
    position: "absolute",
    left: `${f.x * 100}%`,
    top: `${f.y * 100}%`,
    width: `${f.w * 100}%`,
    height: `${f.h * 100}%`,
  };
}

export function PartyChip({
  party,
  locked,
  hostLabel = "Host",
}: {
  party: SignField["party"];
  locked?: boolean;
  hostLabel?: string;
}) {
  const mrg = party === "mrg";
  return (
    <div
      data-party-chip
      className={`pointer-events-none absolute -top-3.5 left-0 whitespace-nowrap text-[7px] font-bold uppercase tracking-wide @max-h-[18px]:hidden ${
        mrg ? "text-[#4ea882]" : "text-[#8a6a28]"
      }`}
    >
      {mrg ? "MRG" : hostLabel}
      {locked ? " · locked" : ""}
    </div>
  );
}

export const FittedFieldInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function FittedFieldInput(props, ref) {
  const { className = "", value, onChange, style, ...rest } = props;
  const innerRef = useRef<HTMLInputElement | null>(null);
  const setRefs = (node: HTMLInputElement | null) => {
    innerRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const fit = () => {
      const maxH = Math.max(4, el.clientHeight * 0.85);
      const maxW = Math.max(8, el.clientWidth - 2);
      let size = Math.min(12, maxH);
      el.style.fontSize = `${size}px`;
      // scrollWidth on inputs reflects content width in modern browsers
      while (size > 4 && el.scrollWidth > maxW + 1) {
        size -= 0.4;
        el.style.fontSize = `${size}px`;
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [value]);

  return (
    <input
      ref={setRefs}
      {...rest}
      value={value}
      onChange={onChange}
      style={style}
      className={`h-full w-full min-w-0 whitespace-nowrap bg-transparent px-0.5 leading-none text-[#1a1408] outline-none placeholder:text-[#8a7a58] ${className}`}
    />
  );
});

/** Shrinks text so long values stay inside the placed field box (preview + placer). */
export function FittedFieldText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const spanRef = useRef<HTMLSpanElement | null>(null);
  const [sizePx, setSizePx] = useState(10);

  useEffect(() => {
    const span = spanRef.current;
    const box = span?.parentElement;
    if (!span || !box) return;

    const fit = () => {
      const maxH = Math.max(4, box.clientHeight * 0.82);
      const maxW = Math.max(8, box.clientWidth - 4);
      let size = Math.min(12, maxH);
      span.style.fontSize = `${size}px`;
      while (size > 4 && span.scrollWidth > maxW) {
        size -= 0.4;
        span.style.fontSize = `${size}px`;
      }
      setSizePx(size);
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [text]);

  return (
    <span
      ref={spanRef}
      style={{ fontSize: sizePx }}
      className={`block w-full truncate leading-none text-[#1a1408] ${className}`}
      title={text}
    >
      {text}
    </span>
  );
}
