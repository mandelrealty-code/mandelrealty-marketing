import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

type Props = {
  beforeSrc?: string | null;
  afterSrc?: string | null;
  beforeAlt?: string;
  afterAlt?: string;
};

function PlaceholderPanel({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-mrg-surface px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-white/20 text-mrg-muted">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="8.5" cy="10" r="1.5" fill="currentColor" />
          <path d="M3 16l5-4 4 3 3-2 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <p className="text-sm text-mrg-muted">{label}</p>
    </div>
  );
}

export function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
  beforeAlt = "Before",
  afterAlt = "After · Managed",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50);
  const [dragging, setDragging] = useState(false);
  const reducedMotion = useReducedMotion();
  const hasImages = Boolean(beforeSrc && afterSrc);

  const updateFromClientX = (clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(98, Math.max(2, next)));
  };

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: PointerEvent) => {
      e.preventDefault();
      updateFromClientX(e.clientX);
    };
    const onUp = () => setDragging(false);

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging]);

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
      className="w-full"
    >
      <div
        ref={containerRef}
        className="relative aspect-[16/10] w-full cursor-ew-resize touch-none overflow-hidden rounded-3xl border border-dashed border-white/20 bg-mrg-surface select-none sm:aspect-[2/1]"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
          updateFromClientX(e.clientX);
        }}
        role="slider"
        aria-label="Before and after photo comparison"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(position)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setPosition((p) => Math.max(2, p - 3));
          if (e.key === "ArrowRight") setPosition((p) => Math.min(98, p + 3));
        }}
      >
        {hasImages ? (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${afterSrc})` }}
              role="img"
              aria-label={afterAlt}
            />
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url(${beforeSrc})`,
                clipPath: `inset(0 ${100 - position}% 0 0)`,
              }}
              role="img"
              aria-label={beforeAlt}
            />
          </>
        ) : (
          <>
            <div className="absolute inset-0">
              <PlaceholderPanel label="Add MANAGED listing photo" />
            </div>
            <div
              className="absolute inset-0"
              style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
            >
              <PlaceholderPanel label="Add BEFORE photo" />
            </div>
          </>
        )}

        <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-sm sm:text-xs">
          Before
        </span>
        <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-mrg-green px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white sm:text-xs">
          After · Managed
        </span>

        <div
          className="absolute inset-y-0 z-10 w-0.5 bg-white shadow-[0_0_12px_rgba(0,0,0,0.5)]"
          style={{ left: `${position}%`, transform: "translateX(-50%)" }}
        >
          <div className="absolute top-1/2 left-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-mrg-bg/90 shadow-lg backdrop-blur-sm">
            <span className="flex items-center gap-0.5 text-white" aria-hidden>
              <svg width="10" height="14" viewBox="0 0 10 14" fill="none">
                <path
                  d="M8 1L2 7l6 6"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <svg width="10" height="14" viewBox="0 0 10 14" fill="none">
                <path
                  d="M2 1l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
