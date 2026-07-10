import { useEffect, useRef, useState } from "react";
import { useInView, useMotionValue, useReducedMotion, useSpring } from "framer-motion";

function formatCurrency(n: number) {
  return n.toLocaleString("en-CA", { maximumFractionDigits: 0 });
}

export function CountUp({
  value,
  className,
  prefix = "$",
  startOnMount = false,
}: {
  value: number;
  className?: string;
  prefix?: string;
  /** When true, animates on mount instead of waiting for scroll into view. */
  startOnMount?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reducedMotion = useReducedMotion();
  const inView = useInView(ref, { once: true, amount: 0.1 });
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { duration: 2, bounce: 0 });
  const formatted = `${prefix}${formatCurrency(value)}`;
  const shouldAnimate = !reducedMotion && (startOnMount || inView);
  const [display, setDisplay] = useState(reducedMotion ? formatted : `${prefix}0`);

  useEffect(() => {
    if (reducedMotion) {
      setDisplay(formatted);
      return;
    }

    if (!shouldAnimate) return;

    const unsub = spring.on("change", (v) => {
      setDisplay(`${prefix}${formatCurrency(Math.round(v))}`);
    });
    motionVal.set(value);
    return unsub;
  }, [shouldAnimate, motionVal, value, spring, prefix, reducedMotion, formatted]);

  // Never leave the hero stuck at $0 if intersection observer fails (common on mobile).
  useEffect(() => {
    if (shouldAnimate || reducedMotion) return;

    const timeout = setTimeout(() => {
      setDisplay((current) => (current === `${prefix}0` ? formatted : current));
    }, 1200);

    return () => clearTimeout(timeout);
  }, [shouldAnimate, formatted, prefix, reducedMotion]);

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  );
}
