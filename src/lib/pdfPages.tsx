import { useEffect, useState, forwardRef, type CSSProperties, type InputHTMLAttributes, type ReactNode } from "react";
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
      className={`pointer-events-none absolute -top-4 left-0 whitespace-nowrap text-[8px] font-bold uppercase tracking-wide @max-h-[26px]:hidden ${
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
  const { className = "", ...rest } = props;
  return (
    <input
      ref={ref}
      {...rest}
      className={`h-full w-full min-w-0 whitespace-nowrap bg-transparent px-0.5 leading-none text-[#1a1408] outline-none placeholder:text-[#8a7a58] [font-size:clamp(5px,52cqh,13px)] ${className}`}
    />
  );
});
