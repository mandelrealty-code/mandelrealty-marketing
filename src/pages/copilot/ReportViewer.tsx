import { useEffect, useState, type UIEvent } from "react";
import { getDocument, GlobalWorkerOptions, version } from "pdfjs-dist";
import type { ReportView } from "../../../shared/copilot/reportView";

if (typeof window !== "undefined") {
  GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
}

export function ReportViewer({
  view,
  onClose,
}: {
  view: ReportView | { status: "loading"; id: string };
  onClose: () => void;
}) {
  const open = view.status === "open" ? view : null;
  const [page, setPage] = useState(1);
  const [sheets, setSheets] = useState<string[]>([]);
  const [shown, setShown] = useState("");
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    setPage(1);
    setDownloaded(false);
  }, [open?.id]);

  useEffect(() => {
    const data = open?.data;
    if (!data) {
      setSheets([]);
      setShown("");
      return;
    }
    let cancelled = false;
    setSheets([]);
    setShown("");
    const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
    void (async () => {
      try {
        const pdf = await getDocument({ data: bytes }).promise;
        const next: string[] = [];
        for (let index = 1; index <= pdf.numPages; index += 1) {
          const sheet = await pdf.getPage(index);
          const viewport = sheet.getViewport({ scale: 2 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await sheet.render({ canvas, canvasContext: ctx, viewport }).promise;
          next.push(canvas.toDataURL("image/png"));
        }
        if (!cancelled) setSheets(next);
      } catch {
        if (!cancelled) setShown("This report could not be shown.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open?.id, open?.data]);

  function onScroll(event: UIEvent<HTMLDivElement>) {
    const scroller = event.currentTarget;
    const box = scroller.getBoundingClientRect();
    let current = 1;
    scroller.querySelectorAll<HTMLElement>("[data-page]").forEach((item) => {
      if (item.getBoundingClientRect().top < box.top + box.height * 0.45) current = Number(item.dataset.page) || current;
    });
    setPage(current);
  }

  function download() {
    if (!open) return;
    const bytes = Uint8Array.from(atob(open.data), (char) => char.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: open.mime || "application/pdf" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = open.filename || `${open.id}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Revoking at once can cancel the save in some browsers. Give it a moment first.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDownloaded(true);
    window.setTimeout(() => setDownloaded(false), 2000);
  }

  const title = open?.title || "Report";
  const id = view.status === "loading" ? view.id : view.id;
  const pages = open?.pages || sheets.length || 1;

  return (
    <aside className="cp-rv cp-rv-dock" role="complementary" aria-label={title}>
      <div className="cp-rv-bar">
        <button type="button" className="cp-rv-back" aria-label="Back to chat" title="Back to chat" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M12 7H2M6 3L2 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </button>
        <div className="cp-rv-name">
          <span className="t">{title}</span>
          <span className="s">
            <span className="id">{id}</span>
            {open ? ` · Page ${page} of ${pages}` : ""}
          </span>
        </div>
        {open ? (
          <button type="button" className="cp-rv-dl" onClick={download}>
            <svg width="12" height="13" viewBox="0 0 12 13" aria-hidden="true">
              <path d="M6 1v8M2.5 5.5L6 9l3.5-3.5M1 12h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            {downloaded ? "Downloaded" : "Download"}
          </button>
        ) : null}
        <button type="button" className="cp-rv-x" aria-label="Close report" title="Close" onClick={onClose}>
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </svg>
        </button>
      </div>
      <div className="cp-rv-pages" onScroll={onScroll}>
        {view.status === "missing" ? <p className="cp-rv-note">{view.line}</p> : null}
        {view.status === "loading" ? <p className="cp-rv-note">Opening the report.</p> : null}
        {shown ? <p className="cp-rv-note">{shown}</p> : null}
        {sheets.map((src, index) => (
          <div key={index} className="cp-rv-page" data-page={index + 1}>
            <img src={src} alt={`Page ${index + 1}`} />
          </div>
        ))}
      </div>
    </aside>
  );
}
