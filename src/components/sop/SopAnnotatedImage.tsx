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

/** Screenshot with pin captions overlaid (numbers may already be baked into the image). */
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
          const preferLeft = pin.x > 0.62;
          return (
            <div
              key={pin.id}
              className="pointer-events-none absolute z-10 max-w-[46%] -translate-y-1/2"
              style={{
                left: preferLeft ? undefined : `${pin.x * 100}%`,
                right: preferLeft ? `${(1 - pin.x) * 100}%` : undefined,
                top: `${pin.y * 100}%`,
                paddingLeft: preferLeft ? 0 : "1.35rem",
                paddingRight: preferLeft ? "1.35rem" : 0,
              }}
            >
              <div
                className={`inline-flex max-w-full items-start gap-1.5 rounded-md border border-[#c4a35a]/55 bg-[#0a0a0a]/92 px-2 py-1 shadow-lg backdrop-blur-sm ${
                  preferLeft ? "flex-row-reverse text-right" : ""
                }`}
              >
                <span className="mt-0.5 flex h-4 min-w-[16px] shrink-0 items-center justify-center rounded-full bg-[#c4a35a] px-1 font-mono text-[9px] font-bold text-black">
                  {pin.number}
                </span>
                <span className="text-[11px] font-semibold leading-snug text-[#f5f5f5]">
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
