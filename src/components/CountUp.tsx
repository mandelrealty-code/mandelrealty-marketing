import { useEffect, useRef, useState } from "react";
import { useInView, useMotionValue, useSpring } from "framer-motion";

function formatCurrency(n: number) {
  return n.toLocaleString("en-CA", { maximumFractionDigits: 0 });
}

export function CountUp({
  value,
  className,
  prefix = "$",
}: {
  value: number;
  className?: string;
  prefix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { duration: 2, bounce: 0 });
  const [display, setDisplay] = useState(`${prefix}0`);

  useEffect(() => {
    if (inView) motionVal.set(value);
  }, [inView, motionVal, value]);

  useEffect(() => {
    const unsub = spring.on("change", (v) => {
      setDisplay(`${prefix}${formatCurrency(Math.round(v))}`);
    });
    return unsub;
  }, [spring, prefix]);

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  );
}
