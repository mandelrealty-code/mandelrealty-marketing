import { useEffect, useState, type FormEvent } from "react";
import {
  CALENDLY_URL,
  CONTACT_CONSENT_ERROR,
  PHONE,
  PHONE_HREF,
  TESTIMONIALS,
  WHATSAPP_HREF,
} from "../lib/constants";
import { submitAuditLead } from "../lib/submitAuditLead";
import { EarningsWheel } from "../components/FitCheckSection";
import { EarningsComparisonChart } from "../components/EarningsComparisonChart";
import { DashboardScreenshotThumbs } from "../components/DashboardScreenshotThumbs";

const DASHBOARD_SHOTS = [
  {
    src: "/proof/2025-comparison-full.png",
    thumb: "/proof/2025-comparison.png",
    label: "2025 · before MRG",
    alt: "Full Airbnb earnings comparison for 2025 before Mandel Realty Group",
  },
  {
    src: "/proof/2026-comparison-full.png",
    thumb: "/proof/2026-comparison.png",
    label: "2026 · with MRG",
    alt: "Full Airbnb earnings comparison for 2026 with Mandel Realty Group",
  },
] as const;

type FormState = {
  name: string;
  email: string;
  phone: string;
  address: string;
  earnings: string;
  callSlot: string;
};

const EMPTY: FormState = {
  name: "",
  email: "",
  phone: "",
  address: "",
  earnings: "",
  callSlot: "",
};

const CALL_SLOTS = [
  "Today · morning",
  "Today · afternoon",
  "Today · evening",
  "Tomorrow · morning",
  "Tomorrow · afternoon",
  "This week · anytime",
] as const;

const trustQuote = TESTIMONIALS[0];

/**
 * Ads lander: one primary conversion = book the call flow.
 * Phone/WhatsApp are demoted so Google Ads can optimize on form submits.
 */
export function AdsLandingPage() {
  const [stage, setStage] = useState<"qualify" | "details" | "book">("qualify");
  const [hasListing, setHasListing] = useState<"yes" | "no" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [contactConsent, setContactConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const useCalendly = Boolean(CALENDLY_URL.trim());

  useEffect(() => {
    document.title = "Book a Call | Mandel Realty Group";
    const robots = document.querySelector('meta[name="robots"]');
    if (robots) robots.setAttribute("content", "noindex, nofollow");
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!contactConsent) {
      setError(CONTACT_CONSENT_ERROR);
      return;
    }
    if (!useCalendly && !form.callSlot) {
      setError("Pick a time that works for your call.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const listingNote =
        hasListing === "yes"
          ? "Call booking · Has existing Airbnb listing"
          : "Call booking · No listing yet — property location captured";
      await submitAuditLead({
        name: form.name,
        email: form.email,
        phone: form.phone,
        address: form.address,
        earnings: [listingNote, form.callSlot || "Calendly", form.earnings]
          .filter(Boolean)
          .join(" · "),
        contactConsent,
        marketingOptIn: false,
      });
      window.location.assign("/thank-you");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not book. Please call us instead.");
      setSubmitting(false);
    }
  };

  const fieldClass =
    "w-full rounded-2xl border border-transparent bg-mrg-bg px-4 py-4 text-base text-mrg-text outline-none ring-1 ring-white/10 transition-all placeholder:text-mrg-muted/40 focus:ring-mrg-gold/50";

  const choiceClass =
    "rounded-2xl border border-white/10 bg-mrg-bg px-5 py-6 text-center transition-all hover:border-mrg-gold/40 hover:bg-mrg-gold/5 active:scale-[0.98]";

  return (
    <div className="min-h-screen bg-mrg-bg text-mrg-text">
      <header className="border-b border-mrg-border/40">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <a href="/book-a-call" className="flex items-center gap-2.5">
            <img src="/mrg-logo-white.png" alt="" aria-hidden className="h-7 w-auto" />
            <span className="text-xs font-semibold uppercase tracking-[0.12em] sm:text-sm">
              Mandel Realty Group
            </span>
          </a>
          <a
            href={PHONE_HREF}
            className="text-sm text-mrg-muted transition-colors hover:text-mrg-text"
          >
            {PHONE}
          </a>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 py-10 sm:py-14 lg:py-16">
          {/* Mobile: short pitch first, then quiz — no scrolling past trust to convert */}
          <div className="mb-8 max-w-xl lg:hidden">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mrg-gold">
              Toronto-based · Canada &amp; U.S.
            </p>
            <h1 className="mt-3 text-[clamp(1.85rem,7vw,2.4rem)] font-bold leading-[1.08] tracking-tight">
              How much is your listing leaving on the table?
            </h1>
            <p className="mt-3 text-base text-mrg-muted">
              Book a 15-minute call. We&apos;ll show you — and how to earn more.
            </p>
          </div>

          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:gap-12">
            {/* Desktop supporting column */}
            <div className="hidden lg:block">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mrg-gold">
                Toronto-based · Canada &amp; U.S.
              </p>
              <h1 className="mt-4 text-[clamp(2rem,4.8vw,3.25rem)] font-bold leading-[1.08] tracking-tight">
                How much is your listing leaving on the table?
              </h1>
              <p className="mt-4 max-w-md text-base leading-relaxed text-mrg-muted sm:text-lg">
                Book a 15-minute call. We&apos;ll show you — and how to earn more.
              </p>

              <div className="mt-8 rounded-2xl bg-mrg-surface p-5 ring-1 ring-white/8">
                <EarningsComparisonChart />
                <div className="mt-4 border-t border-white/8 pt-4">
                  <DashboardScreenshotThumbs shots={[...DASHBOARD_SHOTS]} />
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <blockquote className="flex gap-4 rounded-2xl bg-mrg-surface-elevated p-5 ring-1 ring-white/8">
                  <img
                    src="/hero-unit.png"
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-full object-cover ring-1 ring-white/15"
                  />
                  <div className="min-w-0">
                    <p className="text-sm leading-relaxed text-mrg-text">
                      &ldquo;{trustQuote.quote}&rdquo;
                    </p>
                    <p className="mt-3 text-xs text-mrg-muted">
                      {trustQuote.name} · {trustQuote.location} · {trustQuote.badge}
                    </p>
                  </div>
                </blockquote>

                <div className="flex flex-wrap gap-2 text-xs text-mrg-muted">
                  <span className="rounded-full bg-mrg-surface px-3 py-1.5 ring-1 ring-white/8">
                    Only 20 properties — no cookie-cutter service
                  </span>
                  <span className="rounded-full bg-mrg-surface px-3 py-1.5 ring-1 ring-white/8">
                    Hands-on or virtual
                  </span>
                  <span className="rounded-full bg-mrg-surface px-3 py-1.5 text-mrg-gold ring-1 ring-mrg-gold/25">
                    A few partnership spots open
                  </span>
                </div>
              </div>

              <p className="mt-8 text-sm text-mrg-muted">
                Or reach us directly:{" "}
                <a href={PHONE_HREF} className="text-mrg-text underline-offset-2 hover:underline">
                  {PHONE}
                </a>
                {" · "}
                <a
                  href={WHATSAPP_HREF}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-mrg-text underline-offset-2 hover:underline"
                >
                  WhatsApp
                </a>
              </p>
            </div>

            {/* Dominant conversion card — first after mobile headline */}
            <div className="lg:sticky lg:top-6">
              <div className="rounded-[1.75rem] bg-mrg-surface-elevated p-6 shadow-[0_28px_70px_rgba(0,0,0,0.45)] ring-1 ring-white/12 sm:p-8">
                <div className="mb-6 flex gap-2" aria-hidden>
                  {(["qualify", "details", "book"] as const).map((s, i) => (
                    <div
                      key={s}
                      className={`h-1.5 flex-1 rounded-full ${
                        (stage === "qualify" && i === 0) ||
                        (stage === "details" && i <= 1) ||
                        (stage === "book" && i <= 2)
                          ? "bg-mrg-gold"
                          : "bg-white/10"
                      }`}
                    />
                  ))}
                </div>

              {stage === "qualify" && (
                <div className="text-center">
                  <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                    Do you currently have an Airbnb listing?
                  </h2>
                  <p className="mt-2 text-sm text-mrg-muted">
                    15 minutes, no pressure — just your numbers.
                  </p>
                  <div className="mt-8 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      className={choiceClass}
                      onClick={() => {
                        setHasListing("yes");
                        setForm((f) => ({
                          ...f,
                          earnings: f.earnings || "$2,500 – $5,000 / mo",
                        }));
                        setStage("details");
                      }}
                    >
                      <span className="block font-semibold">Yes, I do</span>
                      <span className="mt-1 block text-xs text-mrg-muted">Live listing</span>
                    </button>
                    <button
                      type="button"
                      className={choiceClass}
                      onClick={() => {
                        setHasListing("no");
                        setForm((f) => ({ ...f, earnings: "" }));
                        setStage("details");
                      }}
                    >
                      <span className="block font-semibold">Not yet</span>
                      <span className="mt-1 block text-xs text-mrg-muted">Property in mind</span>
                    </button>
                  </div>
                </div>
              )}

              {stage === "details" && (
                <div>
                  <h2 className="text-center text-xl font-bold tracking-tight sm:text-2xl">
                    {hasListing === "yes" ? "Where’s the property?" : "Where will it be?"}
                  </h2>
                  <p className="mt-2 text-center text-sm text-mrg-muted">
                    15 minutes, no pressure — just your numbers.
                  </p>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    placeholder="e.g. Downtown Toronto"
                    className={`${fieldClass} mt-6`}
                    autoComplete="address-level2"
                  />
                  {hasListing === "yes" && (
                    <EarningsWheel
                      value={form.earnings}
                      onChange={(earnings) => setForm((f) => ({ ...f, earnings }))}
                    />
                  )}
                  <div className="mt-8 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStage("qualify")}
                      className="rounded-full px-5 py-3.5 text-sm font-semibold text-mrg-muted hover:text-mrg-text"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={!form.address.trim() || (hasListing === "yes" && !form.earnings)}
                      onClick={() => setStage("book")}
                      className="flex-1 rounded-full bg-mrg-gold py-3.5 text-sm font-semibold text-black hover:bg-mrg-gold-light disabled:opacity-40"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              )}

              {stage === "book" && (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <h2 className="text-center text-xl font-bold tracking-tight sm:text-2xl">
                    Lock in your call
                  </h2>
                  <p className="text-center text-sm text-mrg-muted">
                    15 minutes, no pressure — just your numbers.
                  </p>

                  <input
                    type="text"
                    name="_gotcha"
                    tabIndex={-1}
                    autoComplete="off"
                    className="hidden"
                    aria-hidden
                  />

                  {useCalendly ? (
                    <div className="mt-4 overflow-hidden rounded-2xl bg-white">
                      <iframe
                        title="Book a call"
                        src={CALENDLY_URL}
                        className="h-[520px] w-full border-0"
                      />
                    </div>
                  ) : (
                    <>
                      <p className="pt-2 text-sm font-medium text-mrg-text">Pick a time</p>
                      <div className="grid grid-cols-2 gap-2">
                        {CALL_SLOTS.map((slot) => {
                          const active = form.callSlot === slot;
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setForm((f) => ({ ...f, callSlot: slot }))}
                              className={`rounded-xl px-3 py-3 text-left text-sm font-medium transition-all ${
                                active
                                  ? "bg-mrg-gold text-black"
                                  : "bg-mrg-bg text-mrg-muted ring-1 ring-white/10 hover:text-mrg-text"
                              }`}
                            >
                              {slot}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}

                  <div className="space-y-3 pt-2">
                    <input
                      required
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Your name"
                      className={fieldClass}
                      autoComplete="name"
                    />
                    <input
                      required
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="Phone number"
                      className={fieldClass}
                      autoComplete="tel"
                    />
                    <input
                      required
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="Email"
                      className={fieldClass}
                      autoComplete="email"
                    />
                  </div>

                  <label className="flex cursor-pointer items-start gap-3 px-1 pt-2">
                    <input
                      type="checkbox"
                      required
                      checked={contactConsent}
                      onChange={(e) => setContactConsent(e.target.checked)}
                      className="mt-1 h-4 w-4 shrink-0 accent-mrg-gold"
                    />
                    <span className="text-sm text-mrg-muted">
                      Call me about what my listing could earn.{" "}
                      <span className="text-mrg-text/70">(required)</span>
                    </span>
                  </label>

                  {error && (
                    <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                      {error}
                    </p>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setStage("details")}
                      className="rounded-full px-5 py-3.5 text-sm font-semibold text-mrg-muted hover:text-mrg-text"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 rounded-full bg-mrg-gold py-3.5 text-sm font-semibold text-black hover:bg-mrg-gold-light disabled:opacity-60"
                    >
                      {submitting ? "Booking…" : "Confirm my call →"}
                    </button>
                  </div>
                </form>
              )}
              </div>
            </div>

            {/* Mobile trust — after the quiz so conversion comes first */}
            <div className="space-y-4 lg:hidden">
              <div className="rounded-2xl bg-mrg-surface p-5 ring-1 ring-white/8">
                <EarningsComparisonChart />
                <div className="mt-4 border-t border-white/8 pt-4">
                  <DashboardScreenshotThumbs shots={[...DASHBOARD_SHOTS]} />
                </div>
              </div>

              <blockquote className="flex gap-4 rounded-2xl bg-mrg-surface-elevated p-5 ring-1 ring-white/8">
                <img
                  src="/hero-unit.png"
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-full object-cover ring-1 ring-white/15"
                />
                <div className="min-w-0">
                  <p className="text-sm leading-relaxed text-mrg-text">
                    &ldquo;{trustQuote.quote}&rdquo;
                  </p>
                  <p className="mt-3 text-xs text-mrg-muted">
                    {trustQuote.name} · {trustQuote.location} · {trustQuote.badge}
                  </p>
                </div>
              </blockquote>

              <div className="flex flex-wrap gap-2 text-xs text-mrg-muted">
                <span className="rounded-full bg-mrg-surface px-3 py-1.5 ring-1 ring-white/8">
                  Only 20 properties — no cookie-cutter service
                </span>
                <span className="rounded-full bg-mrg-surface px-3 py-1.5 text-mrg-gold ring-1 ring-mrg-gold/25">
                  A few partnership spots open
                </span>
              </div>

              <p className="text-sm text-mrg-muted">
                Or reach us:{" "}
                <a href={PHONE_HREF} className="text-mrg-text underline-offset-2 hover:underline">
                  {PHONE}
                </a>
                {" · "}
                <a
                  href={WHATSAPP_HREF}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-mrg-text underline-offset-2 hover:underline"
                >
                  WhatsApp
                </a>
              </p>
            </div>
          </div>
        </section>

        <section className="border-t border-mrg-border/40 py-12 sm:py-16">
          <div className="mx-auto max-w-3xl px-5">
            <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
              Same listing. <span className="text-mrg-gold">More money.</span>
            </h2>
            <dl className="mt-8 space-y-3">
              {[
                {
                  q: "Do I need a long-term contract?",
                  a: "No. Month to month — stay because the numbers work, not because you're locked in.",
                },
                {
                  q: "I'm outside Toronto. Can you still help?",
                  a: "Yes. We manage listings across Canada and the U.S. — hands-on or fully virtual, depending on what the property needs.",
                },
                {
                  q: "How is the estimate calculated?",
                  a: "From real comps in your area — comparable listings, seasonality, and occupancy — not a generic one-size formula.",
                },
              ].map((item) => (
                <div
                  key={item.q}
                  className="rounded-2xl bg-mrg-surface px-5 py-4 ring-1 ring-white/8 sm:px-6"
                >
                  <dt className="font-semibold text-mrg-text">{item.q}</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-mrg-muted">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>

      <footer className="border-t border-mrg-border/40 py-8 text-center text-xs text-mrg-muted">
        © {new Date().getFullYear()} Mandel Realty Group · Toronto · Canada &amp; U.S.
      </footer>
    </div>
  );
}
