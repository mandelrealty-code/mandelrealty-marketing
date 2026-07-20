import { CTA_HEADLINE, PHONE, PHONE_HREF } from "../lib/constants";
import { CallButton, EstimateButton } from "./ui";

const NAV = [
  { href: "/#proof", label: "Proof" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#audit", label: "Get Estimate" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-mrg-border/60 bg-mrg-bg/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
        <a href="/" className="flex items-center gap-2.5 sm:gap-3">
          <img
            src="/mrg-logo-white.png"
            alt=""
            aria-hidden
            className="h-7 w-auto shrink-0 sm:h-8"
          />
          <span className="font-display text-xl text-mrg-text sm:text-2xl">
            MRG<span className="text-mrg-gold">.</span>
          </span>
        </a>
        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm text-mrg-muted transition-colors hover:text-mrg-text"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <a
            href={PHONE_HREF}
            className="hidden text-sm font-semibold text-mrg-gold transition-colors hover:text-mrg-gold-light xl:inline"
          >
            {PHONE}
          </a>
          <CallButton
            className="hidden shrink-0 sm:inline-flex"
            label="Call"
            variant="secondary"
          />
          <EstimateButton className="hidden shrink-0 sm:inline-flex" label="Get Estimate" />
          <a
            href={PHONE_HREF}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-mrg-gold/40 text-mrg-gold transition-colors hover:border-mrg-gold hover:bg-mrg-gold/10 sm:hidden"
            aria-label={CTA_HEADLINE}
          >
            <span aria-hidden className="text-lg leading-none">
              ☎
            </span>
          </a>
          <EstimateButton className="shrink-0 sm:hidden" label="Estimate" />
        </div>
      </div>
    </header>
  );
}
