import { useEffect, useState } from "react";

type Shot = {
  src: string;
  thumb?: string;
  label: string;
  alt: string;
};

/**
 * Secondary trust: small thumbs → full uncropped dashboard in a lightbox.
 */
export function DashboardScreenshotThumbs({ shots }: { shots: Shot[] }) {
  const [open, setOpen] = useState<Shot | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <div className="flex flex-wrap gap-3">
        {shots.map((shot) => (
          <button
            key={shot.src}
            type="button"
            onClick={() => setOpen(shot)}
            className="group flex items-center gap-3 rounded-xl bg-mrg-bg/60 p-2 pr-3 text-left ring-1 ring-white/10 transition-colors hover:ring-white/25"
          >
            <span className="relative h-12 w-10 overflow-hidden rounded-md bg-white">
              <img
                src={shot.thumb ?? shot.src}
                alt=""
                className="h-full w-full object-cover object-top"
                loading="lazy"
              />
            </span>
            <span>
              <span className="block text-xs font-medium text-mrg-text group-hover:text-mrg-gold">
                View real dashboard
              </span>
              <span className="block text-[11px] text-mrg-muted">{shot.label}</span>
            </span>
          </button>
        ))}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal
          aria-label={open.alt}
          onClick={() => setOpen(null)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-md overflow-auto rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(null)}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
              aria-label="Close"
            >
              ×
            </button>
            <img src={open.src} alt={open.alt} className="block w-full" />
            <p className="bg-mrg-bg px-4 py-3 text-center text-xs text-mrg-muted">{open.label}</p>
          </div>
        </div>
      )}
    </>
  );
}
