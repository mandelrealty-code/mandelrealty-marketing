import { PHONE, PHONE_HREF } from "../lib/constants";

export function AuditButton({
  className = "",
  size = "default",
}: {
  className?: string;
  size?: "default" | "large";
}) {
  const base =
    "inline-flex items-center justify-center rounded-full font-semibold transition-all bg-mrg-gold text-mrg-bg hover:bg-mrg-gold-light active:scale-[0.98]";
  const sizes =
    size === "large"
      ? "px-8 py-4 text-base sm:text-lg w-full sm:w-auto"
      : "px-6 py-3 text-sm sm:text-base";

  return (
    <a href="#audit" className={`${base} ${sizes} ${className}`}>
      Book Your Free 15-Min Revenue Audit
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
