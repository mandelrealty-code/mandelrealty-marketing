import { useEffect, useState, type FormEvent } from "react";
import {
  CONTACT_CONSENT_ERROR,
  FIT_CHECK_HANDOFF_KEY,
  PHONE,
  PHONE_HREF,
  TESTIMONIALS,
  WHATSAPP_HREF,
} from "../lib/constants";
import { submitAuditLead } from "../lib/submitAuditLead";
import { formatCallSlotLabel } from "../../shared/callSlots";
import { EarningsWheel } from "../components/FitCheckSection";
import { EarningsComparisonChart } from "../components/EarningsComparisonChart";
import { DashboardScreenshotThumbs } from "../components/DashboardScreenshotThumbs";
import { CallTimePicker } from "../components/CallTimePicker";

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
};

const EMPTY: FormState = {
  name: "",
  email: "",
  phone: "",
  address: "",
  earnings: "",
};

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
  const [callStartIso, setCallStartIso] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Book a Call | Mandel Realty Group";
    const robots = document.querySelector('meta[name="robots"]');
    if (robots) robots.setAttribute("content", "noindex, nofollow");

    try {
      const raw = sessionStorage.getItem(FIT_CHECK_HANDOFF_KEY);
      if (!raw) return;
      sessionStorage.removeItem(FIT_CHECK_HANDOFF_KEY);
      const data = JSON.parse(raw) as {
        hasListing?: "yes" | "no";
        address?: string;
        earnings?: string;
        name?: string;
        email?: string;
        phone?: string;
      };
      if (data.hasListing === "yes" || data.hasListing === "no") {
        setHasListing(data.hasListing);
      }
      setForm((f) => ({
        ...f,
        address: data.address?.trim() || f.address,
        earnings: data.earnings?.trim() || f.earnings,
        name: data.name?.trim() || f.name,
        email: data.email?.trim() || f.email,
        phone: data.phone?.trim() || f.phone,
      }));
      if (data.address?.trim()) {
        setStage("book");
      } else if (data.hasListing) {
        setStage("details");
      }
    } catch {
      /* ignore bad handoff */
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!contactConsent) {
      setError(CONTACT_CONSENT_ERROR);
      return;
    }
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      setError("Add your name, phone, and email so we can confirm the call.");
      return;
    }
    if (!callStartIso) {
      setError("Pick a call time — we’ll call the number you entered.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await submitAuditLead({
        name: form.name,
        email: form.email,
        phone: form.phone,
        address: form.address,
        earnings: form.earnings,
        hasListing: hasListing === "yes" ? "yes" : hasListing === "no" ? "no" : "unknown",
        callStartIso,
        callBooking: formatCallSlotLabel(callStartIso),
        source: "/book-a-call",
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
            <div id="book" className="scroll-mt-6 lg:sticky lg:top-6">
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
                    15 minutes — we call your phone. Pick an exact time (24h+ notice).
                  </p>

                  <input
                    type="text"
                    name="_gotcha"
                    tabIndex={-1}
                    autoComplete="off"
                    className="hidden"
                    aria-hidden
                  />

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

                  <div className="mt-2 space-y-3">
                    <p className="text-sm font-medium text-mrg-text">Pick when we should call you</p>
                    <CallTimePicker value={callStartIso} onChange={setCallStartIso} />
                    {callStartIso && (
                      <p className="text-sm text-mrg-gold">
                        Selected: {formatCallSlotLabel(callStartIso)}
                      </p>
                    )}
                  </div>

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
                      disabled={submitting || !callStartIso}
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
            <ol className="mt-8 space-y-4">
              {[
                {
                  step: "01",
                  title: "Book your 15-minute call",
                  detail: "Tell us about your property. Takes under a minute to get started.",
                },
                {
                  step: "02",
                  title: "We walk through real comps",
                  detail:
                    "Nearby properties, seasonality, and occupancy — a clear look at what's left on the table.",
                },
                {
                  step: "03",
                  title: "You decide if it's a fit",
                  detail: "No pressure. No obligation. Stay only if the numbers make sense.",
                },
              ].map((item) => (
                <li
                  key={item.step}
                  className="flex gap-4 rounded-2xl bg-mrg-surface px-5 py-4 ring-1 ring-white/8 sm:px-6"
                >
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-mrg-gold">
                    {item.step}
                  </span>
                  <div>
                    <p className="font-semibold text-mrg-text">{item.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-mrg-muted">{item.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-8 text-center">
              <a
                href="#book"
                className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-mrg-gold px-8 text-base font-semibold text-mrg-bg transition-opacity hover:opacity-90"
              >
                Book my call →
              </a>
              <p className="mt-3 text-sm text-mrg-muted">
                No hard sell. No obligation. Just a real look at your numbers.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-mrg-border/40 py-8 text-center text-xs text-mrg-muted">
        © {new Date().getFullYear()} Mandel Realty Group · Toronto · Canada &amp; U.S.
      </footer>
    </div>
  );
}
