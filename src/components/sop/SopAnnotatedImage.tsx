import type { SopStepPin } from "../../../shared/pm/sopTypes";

type Props = {
  src: string;
  alt: string;
  pins?: SopStepPin[] | null;
  className?: string;
  imgClassName?: string;
  onClick?: () => void;
  zoomHint?: boolean;
};

function pinCaption(pin: SopStepPin): string {
  return String(pin.label || "").trim();
}

/** Screenshot with pin callouts: one pill = number + caption (covers baked pin circles). */
export function SopAnnotatedImage({
  src,
  alt,
  pins,
  className = "",
  imgClassName = "w-full max-h-96 object-contain",
  onClick,
  zoomHint = false,
}: Props) {
  const labeled = (pins || []).filter((p) => pinCaption(p));

  return (
    <div className={`space-y-2 ${className}`}>
      <div
        className={`relative overflow-hidden rounded-md border border-white/10 bg-[#151515] ${
          onClick ? "cursor-zoom-in group" : ""
        }`}
        onClick={onClick}
      >
        <img src={src} alt={alt} className={imgClassName} />

        {labeled.map((pin) => {
          const caption = pinCaption(pin);
          const preferLeft = pin.x > 0.72;
          return (
            <div
              key={pin.id}
              className="pointer-events-none absolute z-10 max-w-[min(52%,280px)]"
              style={{
                left: `${pin.x * 100}%`,
                top: `${pin.y * 100}%`,
                transform: preferLeft
                  ? "translate(-85%, -50%)"
                  : "translate(-15%, -50%)",
              }}
            >
              <div
                className={`inline-flex max-w-full items-center gap-1.5 rounded-full border border-black/25 bg-[#c4a35a] px-2 py-1 shadow-[0_2px_10px_rgba(0,0,0,0.45)] ${
                  preferLeft ? "flex-row-reverse" : ""
                }`}
              >
                <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-[#0a0a0a] px-1.5 font-mono text-[10px] font-bold text-[#c4a35a]">
                  {pin.number}
                </span>
                <span className="pr-1 text-[11px] font-bold leading-snug text-[#0a0a0a]">
                  {caption}
                </span>
              </div>
            </div>
          );
        })}

        {zoomHint && onClick ? (
          <div className="absolute right-3 bottom-3 rounded border border-white/12 bg-black/85 px-2.5 py-1 text-[10.5px] font-semibold text-[#9a9590] transition group-hover:text-white">
            ⤢ Click to zoom
          </div>
        ) : null}
      </div>

      {labeled.length > 0 ? (
        <ol className="space-y-1 rounded-md border border-white/8 bg-[#0f0f0f] px-3 py-2.5">
          {labeled.map((pin) => (
            <li
              key={`legend-${pin.id}`}
              className="flex items-start gap-2 text-[12px] leading-snug text-[#cfc9c2]"
            >
              <span className="mt-0.5 flex h-4 min-w-[16px] shrink-0 items-center justify-center rounded-full bg-[#c4a35a] px-1 font-mono text-[9px] font-bold text-black">
                {pin.number}
              </span>
              <span>{pinCaption(pin)}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
