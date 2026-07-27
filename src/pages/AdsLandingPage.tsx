import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  CONTACT_CONSENT_ERROR,
  FIT_CHECK_HANDOFF_KEY,
  PHONE,
  PHONE_HREF,
  TESTIMONIALS,
  WHATSAPP_HREF,
} from "../lib/constants";
import { submitAuditLead, LEAD_HANDOFF_KEY } from "../lib/submitAuditLead";
import { formatCallSlotLabel } from "../../shared/callSlots";
import {
  PERMIT_OPTIONS,
  PROPERTY_STAGES,
  STR_ALLOWED_OPTIONS,
} from "../../shared/qualifierOptions";
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
  listingTitle: string;
  propertyStage: string;
  strAllowed: string;
  permitStatus: string;
};

const EMPTY: FormState = {
  name: "",
  email: "",
  phone: "",
  address: "",
  earnings: "",
  listingTitle: "",
  propertyStage: "",
  strAllowed: "",
  permitStatus: "",
};

type Stage = "qualify" | "yes_details" | "no_details" | "book";

const STEP_LABELS = ["Listing", "Details", "Book call"] as const;

const trustQuote = TESTIMONIALS[0];

/**
 * Ads lander — Instant Form–style funnel, then book the call.
 */
export function AdsLandingPage() {
  const [stage, setStage] = useState<Stage>("qualify");
  const [hasListing, setHasListing] = useState<"yes" | "no" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [contactConsent, setContactConsent] = useState(false);
  const [callStartIso, setCallStartIso] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formCardRef = useRef<HTMLDivElement>(null);

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
        listingTitle?: string;
        name?: string;
        email?: string;
        phone?: string;
        propertyStage?: string;
        strAllowed?: string;
        permitStatus?: string;
      };
      if (data.hasListing === "yes" || data.hasListing === "no") {
        setHasListing(data.hasListing);
      }
      setForm((f) => ({
        ...f,
        address: data.address?.trim() || f.address,
        earnings: data.earnings?.trim() || f.earnings,
        listingTitle: data.listingTitle?.trim() || f.listingTitle,
        name: data.name?.trim() || f.name,
        email: data.email?.trim() || f.email,
        phone: data.phone?.trim() || f.phone,
        propertyStage: data.propertyStage?.trim() || f.propertyStage,
        strAllowed: data.strAllowed?.trim() || f.strAllowed,
        permitStatus: data.permitStatus?.trim() || f.permitStatus,
      }));
      if (data.hasListing === "yes") setStage("yes_details");
      else if (data.hasListing === "no") setStage("no_details");
    } catch {
      /* ignore bad handoff */
    }
  }, []);

  useEffect(() => {
    if (stage === "qualify") return;
    formCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [stage]);

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
      const result = await submitAuditLead({
        name: form.name,
        email: form.email,
        phone: form.phone,
        address: form.address,
        earnings: form.earnings,
        listingTitle: form.listingTitle,
        hasListing: hasListing === "yes" ? "yes" : hasListing === "no" ? "no" : "unknown",
        callStartIso,
        callBooking: formatCallSlotLabel(callStartIso),
        source: "/book-a-call",
        contactConsent,
        marketingOptIn: false,
        propertyStage: hasListing === "no" ? form.propertyStage : undefined,
        permitStatus: hasListing === "no" ? form.permitStatus : undefined,
        strAllowed: hasListing === "no" ? form.strAllowed : undefined,
      });
      try {
        sessionStorage.setItem(
          LEAD_HANDOFF_KEY,
          JSON.stringify({
            leadId: result.leadId,
            hasListing: result.hasListing,
            name: form.name.trim(),
          }),
        );
      } catch {
        /* ignore */
      }
      window.location.assign("/thank-you");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not book. Please call us instead.");
      setSubmitting(false);
    }
  };

  const fieldClass =
    "w-full min-h-12 rounded-2xl border border-transparent bg-mrg-bg px-4 py-3.5 text-base text-mrg-text outline-none ring-1 ring-white/10 transition-all placeholder:text-mrg-muted/45 focus:ring-2 focus:ring-mrg-gold/50";

  const choiceClass =
    "min-h-[5.5rem] rounded-2xl border border-white/10 bg-mrg-bg px-4 py-5 text-center transition-all hover:border-mrg-gold/40 hover:bg-mrg-gold/5 active:scale-[0.98] sm:px-5 sm:py-6";

  const optionClass = (active: boolean) =>
    `w-full min-h-12 rounded-2xl px-4 py-3.5 text-left text-[15px] font-medium leading-snug transition-all ring-1 sm:text-sm ${
      active
        ? "bg-mrg-gold text-black ring-mrg-gold"
        : "bg-mrg-bg text-mrg-text ring-white/10 hover:ring-mrg-gold/40"
    }`;

  const primaryBtn =
    "flex min-h-12 flex-1 items-center justify-center rounded-full bg-mrg-gold px-5 text-sm font-semibold text-black transition-colors hover:bg-mrg-gold-light disabled:opacity-40";

  const backBtn =
    "inline-flex min-h-12 shrink-0 items-center justify-center rounded-full px-4 text-sm font-semibold text-mrg-muted hover:text-mrg-text sm:px-5";

  const stepIndex =
    stage === "qualify" ? 0 : stage === "yes_details" || stage === "no_details" ? 1 : 2;

  const yesReady = Boolean(form.listingTitle.trim() && form.address.trim());
  const noReady = Boolean(
    form.propertyStage && form.strAllowed && form.permitStatus && form.address.trim(),
  );

  return (
    <div className="min-h-dvh bg-mrg-bg text-mrg-text">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(245,197,24,0.07),_transparent_55%)]"
        aria-hidden
      />

      <header className="relative z-10 border-b border-white/8 bg-mrg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-5 sm:py-4">
          <a href="/book-a-call" className="flex min-w-0 items-center gap-2.5">
            <img src="/mrg-logo-white.png" alt="" aria-hidden className="h-7 w-auto shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-mrg-gold sm:text-[11px]">
                Mandel Realty Group
              </p>
              <p className="truncate text-xs text-mrg-muted sm:text-sm">Book a free call</p>
            </div>
          </a>
          <a
            href={PHONE_HREF}
            className="shrink-0 rounded-full bg-white/5 px-3 py-2 text-xs font-medium text-mrg-text ring-1 ring-white/10 transition-colors hover:bg-white/10 sm:px-4 sm:text-sm"
          >
            {PHONE}
          </a>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto max-w-6xl px-4 pb-10 pt-6 sm:px-5 sm:py-14 lg:py-16">
          <div className="mb-6 max-w-xl lg:hidden">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-mrg-gold">
              Toronto-based · Canada &amp; U.S.
            </p>
            <h1 className="mt-2 text-[clamp(1.75rem,7vw,2.35rem)] font-bold leading-[1.08] tracking-tight">
              How much is your listing leaving on the table?
            </h1>
            <p className="mt-2.5 text-[15px] leading-relaxed text-mrg-muted">
              Book a free 15-minute call with{" "}
              <span className="text-mrg-text">Mandel Realty Group</span>.
            </p>
          </div>

          <div className="grid min-w-0 gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:gap-12">
            <div className="hidden min-w-0 lg:block">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mrg-gold">
                Mandel Realty Group · Toronto
              </p>
              <h1 className="mt-4 text-[clamp(2rem,4.8vw,3.25rem)] font-bold leading-[1.08] tracking-tight">
                How much is your listing leaving on the table?
              </h1>
              <p className="mt-4 max-w-md text-base leading-relaxed text-mrg-muted sm:text-lg">
                Book a free 15-minute call. We&apos;ll show you — and how to earn more.
              </p>

              <div className="mt-8 rounded-2xl bg-mrg-surface p-5 ring-1 ring-white/8">
                <EarningsComparisonChart />
                <div className="mt-4 border-t border-white/8 pt-4">
                  <DashboardScreenshotThumbs shots={[...DASHBOARD_SHOTS]} />
                </div>
              </div>

              <blockquote className="mt-6 flex gap-4 rounded-2xl bg-mrg-surface-elevated p-5 ring-1 ring-white/8">
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

              <p className="mt-8 text-sm text-mrg-muted">
                Or reach us:{" "}
                <a href={PHONE_HREF} className="text-mrg-gold hover:text-mrg-gold-light">
                  {PHONE}
                </a>
                {" · "}
                <a
                  href={WHATSAPP_HREF}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-mrg-gold hover:text-mrg-gold-light"
                >
                  WhatsApp
                </a>
              </p>
            </div>

            <div
              id="book"
              ref={formCardRef}
              className="min-w-0 scroll-mt-20 lg:sticky lg:top-6 lg:scroll-mt-6"
            >
              <div className="w-full min-w-0 overflow-hidden rounded-[1.5rem] bg-mrg-surface-elevated shadow-[0_24px_60px_rgba(0,0,0,0.5)] ring-1 ring-white/12 sm:rounded-[1.75rem]">
                <div className="flex items-center gap-3 border-b border-white/8 bg-mrg-bg/60 px-4 py-3.5 sm:px-6">
                  <img
                    src="/mrg-logo-white.png"
                    alt=""
                    aria-hidden
                    className="h-8 w-auto shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mrg-gold">
                      Mandel Realty Group
                    </p>
                    <p className="truncate text-sm font-medium text-mrg-text">
                      Free 15-minute call
                    </p>
                  </div>
                </div>

                <div className="p-4 sm:p-7">
                  <div className="mb-5" aria-hidden>
                    <div className="flex gap-1.5 sm:gap-2">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-full ${
                            i <= stepIndex ? "bg-mrg-gold" : "bg-white/10"
                          }`}
                        />
                      ))}
                    </div>
                    <div className="mt-2 flex justify-between text-[10px] font-medium uppercase tracking-wider text-mrg-muted">
                      {STEP_LABELS.map((label, i) => (
                        <span
                          key={label}
                          className={i === stepIndex ? "text-mrg-gold" : undefined}
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>

                  {stage === "qualify" && (
                    <div className="text-center">
                      <h2 className="text-lg font-bold tracking-tight sm:text-2xl">
                        Do you have an Airbnb listing live right now?
                      </h2>
                      <p className="mt-2 text-sm text-mrg-muted">
                        No pressure — just a quick look at your numbers with MRG.
                      </p>
                      <div className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-2">
                        <button
                          type="button"
                          className={choiceClass}
                          onClick={() => {
                            setHasListing("yes");
                            setForm((f) => ({
                              ...f,
                              earnings: f.earnings || "$2,500 – $5,000 / mo",
                            }));
                            setStage("yes_details");
                          }}
                        >
                          <span className="block font-semibold text-mrg-text">
                            Yes — it&apos;s live
                          </span>
                          <span className="mt-1 block text-xs text-mrg-muted">Has a listing</span>
                        </button>
                        <button
                          type="button"
                          className={choiceClass}
                          onClick={() => {
                            setHasListing("no");
                            setForm((f) => ({ ...f, earnings: "", listingTitle: "" }));
                            setStage("no_details");
                          }}
                        >
                          <span className="block font-semibold text-mrg-text">No — not yet</span>
                          <span className="mt-1 block text-xs text-mrg-muted">Starting out</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {stage === "yes_details" && (
                    <div>
                      <h2 className="text-center text-lg font-bold tracking-tight sm:text-2xl">
                        Tell us about the listing
                      </h2>
                      <p className="mt-2 text-center text-sm text-mrg-muted">
                        So MRG can look it up before the call — no link needed.
                      </p>
                      <div className="mt-5 space-y-3 sm:mt-6">
                        <input
                          type="text"
                          value={form.listingTitle}
                          onChange={(e) => setForm((f) => ({ ...f, listingTitle: e.target.value }))}
                          placeholder="Airbnb listing title"
                          className={fieldClass}
                          enterKeyHint="next"
                        />
                        <input
                          type="text"
                          value={form.address}
                          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                          placeholder="Property address (street, city)"
                          className={fieldClass}
                          autoComplete="street-address"
                          enterKeyHint="next"
                        />
                      </div>
                      <EarningsWheel
                        value={form.earnings}
                        onChange={(earnings) => setForm((f) => ({ ...f, earnings }))}
                      />
                      <div className="mt-6 flex gap-2 sm:mt-8 sm:gap-3">
                        <button type="button" onClick={() => setStage("qualify")} className={backBtn}>
                          Back
                        </button>
                        <button
                          type="button"
                          disabled={!yesReady}
                          onClick={() => setStage("book")}
                          className={primaryBtn}
                        >
                          Continue
                        </button>
                      </div>
                    </div>
                  )}

                  {stage === "no_details" && (
                    <div>
                      <h2 className="text-center text-lg font-bold tracking-tight sm:text-2xl">
                        A few quick questions
                      </h2>
                      <p className="mt-2 text-center text-sm text-mrg-muted">
                        Helps MRG know if we&apos;re the right fit before the call.
                      </p>

                      <div className="mt-5 max-h-[min(58dvh,32rem)] space-y-5 overflow-y-auto overscroll-contain pr-0.5 sm:mt-6 sm:max-h-none sm:overflow-visible">
                        <fieldset className="space-y-2">
                          <legend className="text-sm font-semibold text-mrg-gold">
                            Where are you in the process?
                          </legend>
                          {PROPERTY_STAGES.map((o) => (
                            <button
                              key={o.value}
                              type="button"
                              className={optionClass(form.propertyStage === o.value)}
                              onClick={() => setForm((f) => ({ ...f, propertyStage: o.value }))}
                            >
                              {o.label}
                            </button>
                          ))}
                        </fieldset>

                        <fieldset className="space-y-2">
                          <legend className="text-sm font-semibold text-mrg-gold">
                            Does your building or area allow Airbnb?
                          </legend>
                          {STR_ALLOWED_OPTIONS.map((o) => (
                            <button
                              key={o.value}
                              type="button"
                              className={optionClass(form.strAllowed === o.value)}
                              onClick={() => setForm((f) => ({ ...f, strAllowed: o.value }))}
                            >
                              {o.label}
                            </button>
                          ))}
                        </fieldset>

                        <fieldset className="space-y-2">
                          <legend className="text-sm font-semibold text-mrg-gold">
                            STR permit status
                          </legend>
                          {PERMIT_OPTIONS.map((o) => (
                            <button
                              key={o.value}
                              type="button"
                              className={optionClass(form.permitStatus === o.value)}
                              onClick={() => setForm((f) => ({ ...f, permitStatus: o.value }))}
                            >
                              {o.label}
                            </button>
                          ))}
                        </fieldset>

                        <div>
                          <label className="text-sm font-semibold text-mrg-gold">
                            What&apos;s the property address?
                          </label>
                          <input
                            type="text"
                            value={form.address}
                            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                            placeholder="e.g. 123 King St W, Toronto"
                            className={`${fieldClass} mt-2`}
                            autoComplete="street-address"
                            enterKeyHint="done"
                          />
                        </div>
                      </div>

                      <div className="mt-5 flex gap-2 border-t border-white/8 pt-4 sm:mt-8 sm:gap-3 sm:border-0 sm:pt-0">
                        <button type="button" onClick={() => setStage("qualify")} className={backBtn}>
                          Back
                        </button>
                        <button
                          type="button"
                          disabled={!noReady}
                          onClick={() => setStage("book")}
                          className={primaryBtn}
                        >
                          Continue
                        </button>
                      </div>
                    </div>
                  )}

                  {stage === "book" && (
                    <form onSubmit={handleSubmit} className="space-y-3">
                      <h2 className="text-center text-lg font-bold tracking-tight sm:text-2xl">
                        Lock in your call
                      </h2>
                      <p className="text-center text-sm text-mrg-muted">
                        {hasListing === "yes"
                          ? "MRG will review your listing before we call."
                          : "No listing yet is fine — we’ll cover fit and next steps."}
                      </p>

                      <input
                        type="text"
                        name="_gotcha"
                        tabIndex={-1}
                        autoComplete="off"
                        className="hidden"
                        aria-hidden
                      />

                      <div className="space-y-3 pt-1">
                        <input
                          required
                          value={form.name}
                          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                          placeholder="Your name"
                          className={fieldClass}
                          autoComplete="name"
                          enterKeyHint="next"
                        />
                        <input
                          required
                          type="tel"
                          inputMode="tel"
                          value={form.phone}
                          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                          placeholder="Phone number"
                          className={fieldClass}
                          autoComplete="tel"
                          enterKeyHint="next"
                        />
                        <input
                          required
                          type="email"
                          inputMode="email"
                          value={form.email}
                          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                          placeholder="Email"
                          className={fieldClass}
                          autoComplete="email"
                          enterKeyHint="next"
                        />
                      </div>

                      <label className="flex cursor-pointer items-start gap-3 px-0.5 pt-2">
                        <input
                          type="checkbox"
                          required
                          checked={contactConsent}
                          onChange={(e) => setContactConsent(e.target.checked)}
                          className="mt-1 h-5 w-5 shrink-0 accent-mrg-gold"
                        />
                        <span className="text-sm leading-snug text-mrg-muted">
                          Mandel Realty Group can call me about Airbnb management.{" "}
                          <span className="text-mrg-text/70">(required)</span>
                        </span>
                      </label>

                      <div className="mt-1 min-w-0 space-y-3">
                        <p className="text-sm font-medium text-mrg-text">
                          Pick when we should call you
                        </p>
                        <CallTimePicker value={callStartIso} onChange={setCallStartIso} />
                        {callStartIso && (
                          <p className="break-words text-sm text-mrg-gold">
                            Selected: {formatCallSlotLabel(callStartIso)}
                          </p>
                        )}
                      </div>

                      {error && (
                        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                          {error}
                        </p>
                      )}

                      <div className="flex gap-2 pt-2 sm:gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setStage(hasListing === "yes" ? "yes_details" : "no_details")
                          }
                          className={backBtn}
                        >
                          Back
                        </button>
                        <button
                          type="submit"
                          disabled={submitting || !callStartIso}
                          className={primaryBtn}
                        >
                          {submitting ? "Booking…" : "Confirm my call →"}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>

              <p className="mt-4 text-center text-xs text-mrg-muted lg:hidden">
                Or call{" "}
                <a href={PHONE_HREF} className="font-medium text-mrg-gold">
                  {PHONE}
                </a>
              </p>
            </div>

            <div className="space-y-4 lg:hidden">
              <div className="rounded-2xl bg-mrg-surface p-4 ring-1 ring-white/8 sm:p-5">
                <EarningsComparisonChart />
                <div className="mt-4 border-t border-white/8 pt-4">
                  <DashboardScreenshotThumbs shots={[...DASHBOARD_SHOTS]} />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/8 px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] text-center text-xs text-mrg-muted">
        © {new Date().getFullYear()} Mandel Realty Group · Toronto · Canada &amp; U.S.
      </footer>
    </div>
  );
}
