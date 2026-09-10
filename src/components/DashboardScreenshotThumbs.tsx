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
export function DashboardScreenshotThumbs({
  shots,
  variant = "dark",
}: {
  shots: Shot[];
  variant?: "dark" | "light" | "lightBlue" | "lightGreen" | "lightOrange";
}) {
  const [open, setOpen] = useState<Shot | null>(null);
  const light =
    variant === "light" ||
    variant === "lightBlue" ||
    variant === "lightGreen" ||
    variant === "lightOrange";
  const blue = variant === "lightBlue";
  const green = variant === "lightGreen";
  const orange = variant === "lightOrange";

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

  const thumbBtn = green
    ? "group flex items-center gap-3 rounded-xl border border-[#ebebeb] bg-[#f7f7f7] p-2 pr-3 text-left transition-colors hover:border-[#12B76A]/45 hover:bg-[#eaf8f1]"
    : blue
      ? "group flex items-center gap-3 rounded-xl border border-[#ebebeb] bg-[#f7f7f7] p-2 pr-3 text-left transition-colors hover:border-[#2F6BFF]/45 hover:bg-[#eef3ff]"
      : orange
        ? "group flex items-center gap-3 rounded-xl border border-[#ebebeb] bg-[#f7f7f7] p-2 pr-3 text-left transition-colors hover:border-[#FF4716]/45 hover:bg-[#fff3ee]"
        : light
          ? "group flex items-center gap-3 rounded-xl border border-[#ebebeb] bg-[#f7f7f7] p-2 pr-3 text-left transition-colors hover:border-[#c4a35a]/55 hover:bg-[#fbf7ee]"
          : "group flex items-center gap-3 rounded-xl bg-mrg-bg/60 p-2 pr-3 text-left ring-1 ring-white/10 transition-colors hover:ring-white/25";

  const titleCls = green
    ? "block text-xs font-semibold text-[#222222] group-hover:text-[#0d8f53]"
    : blue
      ? "block text-xs font-semibold text-[#222222] group-hover:text-[#1b4fd6]"
      : orange
        ? "block text-xs font-semibold text-[#222222] group-hover:text-[#d63a10]"
        : light
          ? "block text-xs font-semibold text-[#222222] group-hover:text-[#8a6f2e]"
          : "block text-xs font-medium text-mrg-text group-hover:text-mrg-gold";

  return (
    <>
      <div className="flex flex-wrap gap-3">
        {shots.map((shot) => (
          <button
            key={shot.src}
            type="button"
            onClick={() => setOpen(shot)}
            className={thumbBtn}
          >
            <span
              className={
                light
                  ? "relative h-12 w-10 overflow-hidden rounded-md border border-[#ebebeb] bg-white"
                  : "relative h-12 w-10 overflow-hidden rounded-md bg-white"
              }
            >
              <img
                src={shot.thumb ?? shot.src}
                alt=""
                className="h-full w-full object-cover object-top"
                loading="lazy"
              />
            </span>
            <span>
              <span className={titleCls}>View real dashboard</span>
              <span
                className={
                  light
                    ? "block text-[11px] text-[#717171]"
                    : "block text-[11px] text-mrg-muted"
                }
              >
                {shot.label}
              </span>
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
            <p
              className={
                light
                  ? "bg-[#f7f7f7] px-4 py-3 text-center text-xs text-[#717171]"
                  : "bg-mrg-bg px-4 py-3 text-center text-xs text-mrg-muted"
              }
            >
              {open.label}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
