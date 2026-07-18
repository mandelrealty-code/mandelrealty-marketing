import { PHONE, PHONE_HREF } from "../lib/constants";

export function AuditButton({
  className = "",
  size = "default",
  label,
}: {
  className?: string;
  size?: "default" | "large";
  label?: string;
}) {
  const base =
    "inline-flex items-center justify-center rounded-lg font-semibold uppercase tracking-wide transition-all bg-mrg-gold text-mrg-bg hover:bg-mrg-gold-light active:scale-[0.98]";
  const sizes =
    size === "large"
      ? "px-8 py-4 text-sm sm:text-base w-full sm:w-auto"
      : "px-5 py-2.5 text-xs sm:text-sm";

  return (
    <a href="/#audit" className={`${base} ${sizes} ${className}`}>
      {label ?? "Book Your Free 15-Min Revenue Audit"}
    </a>
  );
}

export function CallButton({
  className = "",
  size = "default",
  label,
}: {
  className?: string;
  size?: "default" | "large";
  label?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg border border-mrg-gold/50 font-semibold uppercase tracking-wide text-mrg-gold transition-all hover:border-mrg-gold hover:bg-mrg-gold/10 active:scale-[0.98]";
  const sizes =
    size === "large"
      ? "px-8 py-4 text-sm sm:text-base w-full sm:w-auto"
      : "px-5 py-2.5 text-xs sm:text-sm";

  return (
    <a href={PHONE_HREF} className={`${base} ${sizes} ${className}`}>
      <span aria-hidden className="text-base leading-none">
        ☎
      </span>
      {label ?? `Call ${PHONE}`}
    </a>
  );
}

export function PhoneLink({ className = "" }: { className?: string }) {
  return (
    <a
      href={PHONE_HREF}
      className={`font-semibold text-mrg-gold hover:text-mrg-gold-light transition-colors ${className}`}
    >
      {PHONE}
    </a>
  );
}
