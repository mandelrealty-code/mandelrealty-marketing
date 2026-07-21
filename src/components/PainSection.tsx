import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
} from "framer-motion";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { PAIN_CARDS } from "../lib/constants";
import { SectionReveal } from "./SectionReveal";

type PainId = (typeof PAIN_CARDS)[number]["id"];

const ease = [0.22, 1, 0.36, 1] as const;

function PainIcon({ id, active }: { id: PainId; active: boolean }) {
  const props = {
    className: "h-7 w-7",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (id) {
    case "burnout":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 14.5c1.2-1 2.3-1.5 3.5-1.5s2.3.5 3.5 1.5" />
          <path d="M9 10h.01M15 10h.01" />
          <motion.path
            d="M12 3v3"
            animate={active ? { opacity: [0.35, 1, 0.35], y: [0, 1, 0] } : { opacity: 0.7 }}
            transition={{ duration: 1.4, repeat: active ? Infinity : 0, ease: "easeInOut" }}
          />
        </svg>
      );
    case "underperforming":
      return (
        <svg {...props}>
          <path d="M4 19h16" />
          <motion.path
            d="M5 8l4 4 3-3 5 6"
            initial={false}
            animate={active ? { pathLength: 1, opacity: 1 } : { pathLength: 1, opacity: 0.85 }}
            transition={{ duration: 0.7, ease }}
          />
          <motion.circle
            cx="17"
            cy="15"
            r="1.4"
            fill="currentColor"
            animate={active ? { scale: [1, 1.35, 1] } : { scale: 1 }}
            transition={{ duration: 1.2, repeat: active ? Infinity : 0 }}
          />
        </svg>
      );
    case "coasting":
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5.5 19a6.5 6.5 0 0113 0" />
          <motion.path
            d="M16.5 5.5l3 3M19.5 5.5l-3 3"
            animate={active ? { opacity: [0.4, 1, 0.4] } : { opacity: 0.75 }}
            transition={{ duration: 1.1, repeat: active ? Infinity : 0 }}
          />
        </svg>
      );
    case "upside":
      return (
        <svg {...props}>
          <path d="M4 19h16" />
          <motion.path
            d="M5 15l4-4 3 2 6-7"
            animate={active ? { pathLength: [0.2, 1] } : { pathLength: 1 }}
            transition={{ duration: 0.8, ease }}
          />
          <motion.path
            d="M15 6h4v4"
            animate={active ? { x: [0, 1, 0], y: [0, -1, 0] } : {}}
            transition={{ duration: 1.1, repeat: active ? Infinity : 0 }}
          />
        </svg>
      );
  }
}

function PainCard({
  card,
  index,
  active,
  onActivate,
  cardRef,
}: {
  card: (typeof PAIN_CARDS)[number];
  index: number;
  active: boolean;
  onActivate: () => void;
  cardRef: (el: HTMLButtonElement | null) => void;
}) {
  const reducedMotion = useReducedMotion();
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const handleMove = (e: MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };

  const spotlight = useMotionTemplate`radial-gradient(280px circle at ${mouseX}px ${mouseY}px, rgba(245,197,24,0.12), transparent 55%)`;

  return (
    <motion.button
      ref={cardRef}
      type="button"
      onMouseEnter={onActivate}
      onFocus={onActivate}
      onMouseMove={handleMove}
      onClick={onActivate}
      className={`group relative w-full overflow-hidden rounded-3xl border p-6 text-left transition-colors sm:p-7 ${
        active
          ? "border-mrg-gold/35 bg-mrg-surface-elevated"
          : "border-white/10 bg-mrg-surface hover:border-white/15"
      }`}
      initial={reducedMotion ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, delay: index * 0.08, ease }}
      whileHover={reducedMotion ? undefined : { y: -4 }}
      layout
    >
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: spotlight }}
        aria-hidden
      />

      <div className="relative flex items-start gap-4">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-colors ${
            active ? "bg-mrg-gold text-black" : "bg-mrg-bg text-mrg-muted group-hover:text-mrg-text"
          }`}
        >
          <PainIcon id={card.id} active={active} />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${
              active ? "text-mrg-gold" : "text-mrg-muted"
            }`}
          >
            {String(index + 1).padStart(2, "0")} · {card.eyebrow}
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-mrg-text sm:text-2xl">
            {card.title}
          </h3>
          <motion.p
            className="mt-2 text-sm leading-relaxed text-mrg-muted sm:text-[15px]"
            initial={false}
            animate={{ opacity: active ? 1 : 0.72 }}
          >
            {card.detail}
          </motion.p>
        </div>
      </div>
    </motion.button>
  );
}

export function PainSection() {
  const [activeId, setActiveId] = useState<PainId>(PAIN_CARDS[0].id);
  const cardEls = useRef<Partial<Record<PainId, HTMLButtonElement | null>>>({});
  const active = PAIN_CARDS.find((c) => c.id === activeId) ?? PAIN_CARDS[0];
  const activeIndex = PAIN_CARDS.findIndex((c) => c.id === activeId);
  const hovering = useRef(false);
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  // Stable scroll sync: pick the card closest to viewport focus line,
  // only switch when clearly ahead (hysteresis) and not while hovering.
  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      if (hovering.current) return;

      const targetY = window.innerHeight * 0.42;
      let bestId: PainId | null = null;
      let bestDist = Infinity;

      for (const card of PAIN_CARDS) {
        const el = cardEls.current[card.id];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        const dist = Math.abs(mid - targetY);
        if (dist < bestDist) {
          bestDist = dist;
          bestId = card.id;
        }
      }

      const currentId = activeIdRef.current;
      if (!bestId || bestId === currentId) return;

      const currentEl = cardEls.current[currentId];
      if (currentEl) {
        const rect = currentEl.getBoundingClientRect();
        const currentDist = Math.abs(rect.top + rect.height / 2 - targetY);
        if (currentDist - bestDist < 56) return;
      }

      setActiveId(bestId);
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const activate = (id: PainId) => {
    setActiveId(id);
  };

  return (
    <section className="relative border-t border-mrg-border/40 py-20 sm:py-28">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_10%_20%,rgba(245,197,24,0.06),transparent)]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl px-5">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.15fr)] lg:items-start lg:gap-14 xl:gap-20">
          <aside className="lg:sticky lg:top-24 lg:z-10 lg:self-start">
            <SectionReveal>
              <h2 className="text-4xl font-bold tracking-tight text-mrg-text sm:text-5xl lg:text-[3.25rem] lg:leading-[1.05]">
                Sound familiar?
              </h2>
              <p className="mt-4 max-w-md text-base leading-relaxed text-mrg-muted sm:text-lg">
                If any of this is why you&apos;re here, you&apos;re in the right place.
              </p>
            </SectionReveal>

            <SectionReveal delay={0.08} className="mt-8 hidden lg:block">
              <div className="rounded-3xl bg-mrg-surface-elevated/95 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.35)] ring-1 ring-white/10 backdrop-blur-md">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-mrg-muted">
                  Now reading
                </p>
                <p className="mt-3 text-2xl font-semibold tracking-tight text-mrg-text transition-opacity duration-200">
                  {active.title}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-mrg-muted transition-opacity duration-200">
                  {active.detail}
                </p>

                <div className="mt-6 flex gap-1.5">
                  {PAIN_CARDS.map((card, i) => (
                    <button
                      key={card.id}
                      type="button"
                      aria-label={`Show ${card.eyebrow}`}
                      onClick={() => {
                        hovering.current = true;
                        activate(card.id);
                        cardEls.current[card.id]?.scrollIntoView({
                          behavior: "smooth",
                          block: "center",
                        });
                        window.setTimeout(() => {
                          hovering.current = false;
                        }, 700);
                      }}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        i === activeIndex ? "bg-mrg-gold" : "bg-white/10 hover:bg-white/20"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </SectionReveal>
          </aside>

          <div
            className="flex flex-col gap-3 sm:gap-4"
            onMouseLeave={() => {
              hovering.current = false;
            }}
          >
            {PAIN_CARDS.map((card, i) => (
              <PainCard
                key={card.id}
                card={card}
                index={i}
                active={activeId === card.id}
                onActivate={() => {
                  hovering.current = true;
                  activate(card.id);
                }}
                cardRef={(el) => {
                  cardEls.current[card.id] = el;
                  if (el) el.dataset.painId = card.id;
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

