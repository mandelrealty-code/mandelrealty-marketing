import { EMAIL, EMAIL_CTA_LEAD, EMAIL_HREF, PHONE, PHONE_HREF } from "../lib/constants";

export function CallButton({
  className = "",
  size = "default",
  label,
  variant = "primary",
}: {
  className?: string;
  size?: "default" | "large";
  label?: string;
  variant?: "primary" | "secondary";
}) {
  const base =
    variant === "primary"
      ? "inline-flex items-center justify-center gap-2 rounded-lg font-semibold uppercase tracking-wide transition-all bg-mrg-gold text-mrg-bg hover:bg-mrg-gold-light active:scale-[0.98]"
      : "inline-flex items-center justify-center gap-2 rounded-lg border border-mrg-gold/50 font-semibold uppercase tracking-wide text-mrg-gold transition-all hover:border-mrg-gold hover:bg-mrg-gold/10 active:scale-[0.98]";
  const sizes =
    size === "large"
      ? "px-8 py-4 text-sm sm:text-base w-full sm:w-auto"
      : "px-5 py-2.5 text-xs sm:text-sm";

  return (
    <a href={PHONE_HREF} className={`${base} ${sizes} ${className}`}>
      <span aria-hidden className="text-base leading-none">
        ☎
      </span>
      {label ?? `Call Our Experts: ${PHONE}`}
    </a>
  );
}

export function EmailCta({ className = "" }: { className?: string }) {
  return (
    <p className={`text-sm leading-relaxed text-mrg-muted sm:text-base ${className}`}>
      {EMAIL_CTA_LEAD}{" "}
      <a href={EMAIL_HREF} className="font-semibold text-mrg-gold hover:text-mrg-gold-light">
        {EMAIL}
      </a>
    </p>
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
