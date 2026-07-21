import { CallButton, WhatsAppButton } from "./ui";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-mrg-border/50 bg-mrg-bg/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
        <a href="/" className="flex items-center gap-2.5 sm:gap-3">
          <img
            src="/mrg-logo-white.png"
            alt=""
            aria-hidden
            className="h-7 w-auto shrink-0 sm:h-8"
          />
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-mrg-text sm:text-sm">
            Mandel Realty Group
          </span>
        </a>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <WhatsAppButton className="hidden sm:inline-flex" size="compact" />
          <CallButton size="compact" />
        </div>
      </div>
    </header>
  );
}
