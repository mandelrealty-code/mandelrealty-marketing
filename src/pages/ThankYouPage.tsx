import { useEffect } from "react";
import { EMAIL, EMAIL_HREF, PHONE, PHONE_HREF } from "../lib/constants";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { trackMetaLead } from "../lib/metaPixel";

export function ThankYouPage() {
  useEffect(() => {
    document.title = "Thank You | Mandel Realty Group";
    const robots = document.querySelector('meta[name="robots"]');
    if (robots) robots.setAttribute("content", "noindex, nofollow");
    trackMetaLead();
  }, []);

  return (
    <>
      <Header />
      <main className="flex min-h-[70vh] items-center justify-center px-5 py-20">
        <div className="mx-auto max-w-lg text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mrg-gold">
            Request received
          </p>
          <h1 className="mt-4 font-display text-4xl text-mrg-text sm:text-5xl">
            We&apos;ll be in touch.
          </h1>
          <p className="mt-5 text-base leading-relaxed text-mrg-muted sm:text-lg">
            We&apos;ll call you at the number you provided to talk through what your listing may be
            leaving on the table — and how we can help you earn more.
          </p>
          <p className="mt-8 text-sm text-mrg-muted">Need to talk sooner?</p>
          <a
            href={PHONE_HREF}
            className="mt-3 inline-flex rounded-full bg-mrg-gold px-8 py-3.5 font-semibold text-mrg-bg transition-colors hover:bg-mrg-gold-light"
          >
            Call {PHONE}
          </a>
          <p className="mt-6 text-sm text-mrg-muted">
            Or email{" "}
            <a href={EMAIL_HREF} className="text-mrg-gold hover:text-mrg-gold-light">
              {EMAIL}
            </a>
          </p>
          <a
            href="/"
            className="mt-10 inline-block text-sm text-mrg-muted underline-offset-4 hover:text-mrg-text hover:underline"
          >
            ← Back to home
          </a>
        </div>
      </main>
      <Footer />
    </>
  );
}
