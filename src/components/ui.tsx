import { EMAIL, EMAIL_CTA_LEAD, EMAIL_HREF, PHONE, PHONE_HREF, WHATSAPP_HREF } from "../lib/constants";

const pillBase =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all active:scale-[0.98]";

const sizeClasses = {
  default: "px-5 py-2.5 text-sm",
  large: "px-7 py-3.5 text-sm sm:text-base",
  compact: "px-4 py-2 text-xs sm:text-sm",
} as const;

type Size = keyof typeof sizeClasses;

function WhatsAppIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function PhoneIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6.62 10.79a15.15 15.15 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.4 21 3 13.6 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.25 1.02l-2.2 2.19z" />
    </svg>
  );
}

export function WhatsAppButton({
  className = "",
  size = "default",
  label = "WhatsApp",
}: {
  className?: string;
  size?: Size;
  label?: string;
}) {
  return (
    <a
      href={WHATSAPP_HREF}
      target="_blank"
      rel="noopener noreferrer"
      className={`${pillBase} bg-mrg-green text-white hover:brightness-110 ${sizeClasses[size]} ${className}`}
    >
      <WhatsAppIcon />
      {label}
    </a>
  );
}

export function CallButton({
  className = "",
  size = "default",
  label = "Call Now",
  variant = "primary",
}: {
  className?: string;
  size?: Size;
  label?: string;
  variant?: "primary" | "secondary" | "white";
}) {
  const variants = {
    primary: "bg-mrg-gold text-black hover:bg-mrg-gold-light",
    secondary: "border border-white/25 bg-transparent text-white hover:border-white/50 hover:bg-white/5",
    white: "bg-white text-black hover:bg-white/90",
  } as const;

  return (
    <a href={PHONE_HREF} className={`${pillBase} ${variants[variant]} ${sizeClasses[size]} ${className}`}>
      <PhoneIcon />
      {label}
    </a>
  );
}

export function EstimateButton({
  className = "",
  size = "default",
  label = "See what your listing could earn →",
  variant = "primary",
  href = "/#fit-check",
}: {
  className?: string;
  size?: Size;
  label?: string;
  variant?: "primary" | "secondary";
  href?: string;
}) {
  const variants = {
    primary: "bg-mrg-gold text-black hover:bg-mrg-gold-light",
    secondary: "border border-white/25 bg-transparent text-white hover:border-white/50 hover:bg-white/5",
  } as const;

  return (
    <a href={href} className={`${pillBase} ${variants[variant]} ${sizeClasses[size]} ${className}`}>
      {label}
    </a>
  );
}

export function EmailButton({
  className = "",
  size = "default",
  label = "Email for Estimate",
  variant = "secondary",
}: {
  className?: string;
  size?: Size;
  label?: string;
  variant?: "primary" | "secondary";
}) {
  const variants = {
    primary: "bg-mrg-gold text-black hover:bg-mrg-gold-light",
    secondary: "border border-white/25 bg-transparent text-white hover:border-white/50 hover:bg-white/5",
  } as const;

  return (
    <a href={EMAIL_HREF} className={`${pillBase} ${variants[variant]} ${sizeClasses[size]} ${className}`}>
      {label}
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

export { WhatsAppIcon, PhoneIcon };
