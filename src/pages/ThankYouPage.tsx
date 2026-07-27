import { useEffect } from "react";
import { EMAIL, EMAIL_HREF, PHONE, PHONE_HREF } from "../lib/constants";
import { trackMetaLead } from "../lib/metaPixel";
import { LEAD_HANDOFF_KEY } from "../lib/submitAuditLead";

export function ThankYouPage() {
  useEffect(() => {
    document.title = "Thank You | Mandel Realty Group";
    const robots = document.querySelector('meta[name="robots"]');
    if (robots) robots.setAttribute("content", "noindex, nofollow");
    trackMetaLead();
    try {
      sessionStorage.removeItem(LEAD_HANDOFF_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div className="min-h-dvh bg-mrg-bg text-mrg-text">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(245,197,24,0.07),_transparent_55%)]"
        aria-hidden
      />

      <header className="relative z-10 border-b border-white/8 bg-mrg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-center gap-2.5 px-4 py-4">
          <img src="/mrg-logo-white.png" alt="" aria-hidden className="h-7 w-auto" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mrg-gold">
              Mandel Realty Group
            </p>
            <p className="text-xs text-mrg-muted">Call confirmed</p>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex min-h-[70dvh] items-center justify-center px-4 py-12 sm:px-5 sm:py-20">
        <div className="mx-auto w-full max-w-lg rounded-[1.5rem] bg-mrg-surface-elevated p-6 text-center ring-1 ring-white/12 sm:rounded-[1.75rem] sm:p-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-mrg-gold">
            Mandel Realty Group
          </p>
          <h1 className="mt-3 font-display text-3xl text-mrg-text sm:text-4xl">
            You&apos;re on the calendar.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-mrg-muted sm:text-base">
            Check your email for the exact time and calendar invite. We&apos;ll call the number you
            provided — and if you have a live listing, we&apos;ll look it up before we talk.
          </p>
          <a
            href={PHONE_HREF}
            className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-mrg-gold px-8 text-sm font-semibold text-black transition-colors hover:bg-mrg-gold-light sm:w-auto"
          >
            Call {PHONE}
          </a>
          <p className="mt-5 text-sm text-mrg-muted">
            Or email{" "}
            <a href={EMAIL_HREF} className="text-mrg-gold hover:text-mrg-gold-light">
              {EMAIL}
            </a>
          </p>
          <a
            href="/"
            className="mt-8 inline-block text-sm text-mrg-muted underline-offset-4 hover:text-mrg-text hover:underline"
          >
            ← Back to home
          </a>
        </div>
      </main>
    </div>
  );
}
