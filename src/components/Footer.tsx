import { PHONE, PHONE_HREF } from "../lib/constants";

const FOOTER_LINKS = [
  { href: "/#how", label: "About Us" },
  { href: "/#faq", label: "FAQ" },
  { href: "/#fit-check", label: "Get Estimate" },
  { href: "/#pricing", label: "Pricing" },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-mrg-border/40 py-14">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-5 text-center">
        <a href="/" className="flex items-center gap-2.5">
          <img src="/mrg-logo-white.png" alt="" aria-hidden className="h-7 w-auto" />
          <span className="text-sm font-semibold uppercase tracking-[0.12em] text-mrg-text">
            Mandel Realty Group
          </span>
        </a>
        <p className="max-w-md text-sm text-mrg-muted">
          Hands-on &amp; virtual Airbnb &amp; short-term rental management · Canada &amp; the U.S.
        </p>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-mrg-muted">
          {FOOTER_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="hover:text-mrg-text">
              {link.label}
            </a>
          ))}
        </nav>
        <div className="space-y-1 text-sm text-mrg-muted">
          <a href={PHONE_HREF} className="block font-semibold text-mrg-gold hover:text-mrg-gold-light">
            {PHONE}
          </a>
          <p>© {new Date().getFullYear()} Mandel Realty Group</p>
        </div>
      </div>
    </footer>
  );
}
