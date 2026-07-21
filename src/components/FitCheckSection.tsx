import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  CONTACT_CONSENT_ERROR,
  CTA_SUPPORT,
  EMAIL,
  EMAIL_CTA_LEAD,
  EMAIL_HREF,
  PHONE_HREF,
  CTA_HEADLINE,
} from "../lib/constants";
import { submitAuditLead } from "../lib/submitAuditLead";
import { SectionReveal } from "./SectionReveal";

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

const STEPS = 3;

export const EARNINGS_OPTIONS = [
  "Under $1,000 / mo",
  "$1,000 – $2,500 / mo",
  "$2,500 – $5,000 / mo",
  "$5,000 – $8,000 / mo",
  "$8,000 – $12,000 / mo",
  "$12,000+ / mo",
  "Prefer not to say",
] as const;

const ITEM_H = 44;

/** iOS-style snap scroll wheel for monthly earnings */
export function EarningsWheel({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const selectedIndex = Math.max(
    0,
    EARNINGS_OPTIONS.findIndex((o) => o === value),
  );

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const idx = EARNINGS_OPTIONS.findIndex((o) => o === value);
    const safe = idx >= 0 ? idx : 2;
    requestAnimationFrame(() => {
      el.scrollTop = safe * ITEM_H;
    });
  }, [value]);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / ITEM_H);
    const clamped = Math.min(EARNINGS_OPTIONS.length - 1, Math.max(0, idx));
    const next = EARNINGS_OPTIONS[clamped];
    if (next !== value) onChange(next);
  };

  return (
    <div className="relative mx-auto mt-6 w-full max-w-sm select-none">
      <p className="mb-3 text-center text-sm text-mrg-muted">Rough monthly earnings</p>
      <div className="relative overflow-hidden rounded-2xl bg-mrg-bg ring-1 ring-white/10">
        {/* Selection band */}
        <div
          className="pointer-events-none absolute inset-x-3 top-1/2 z-10 h-11 -translate-y-1/2 rounded-xl border border-mrg-gold/40 bg-mrg-gold/10"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-12 bg-gradient-to-b from-mrg-bg to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-12 bg-gradient-to-t from-mrg-bg to-transparent"
          aria-hidden
        />
        <div
          ref={scrollerRef}
          onScroll={onScroll}
          className="h-[132px] snap-y snap-mandatory overflow-y-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ paddingTop: ITEM_H, paddingBottom: ITEM_H }}
          role="listbox"
          aria-label="Monthly earnings"
        >
          {EARNINGS_OPTIONS.map((option, i) => {
            const active = i === selectedIndex || (!value && i === 2);
            return (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={active}
                className={`flex h-11 w-full snap-center items-center justify-center px-4 text-center text-[15px] transition-colors ${
                  option === value
                    ? "font-semibold text-mrg-text"
                    : "font-medium text-mrg-muted/55"
                }`}
                onClick={() => {
                  onChange(option);
                  scrollerRef.current?.scrollTo({ top: i * ITEM_H, behavior: "smooth" });
                }}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-mrg-muted/70">Scroll or tap to select</p>
    </div>
  );
}

const inputClass =
  "w-full rounded-2xl border border-transparent bg-mrg-bg px-4 py-4 text-base text-mrg-text outline-none ring-1 ring-white/10 transition-all placeholder:text-mrg-muted/40 focus:ring-mrg-gold/50";

export function FitCheckSection() {
  const [step, setStep] = useState(0);
  const [hasListing, setHasListing] = useState<"yes" | "no" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [contactConsent, setContactConsent] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!contactConsent) {
      setError(CONTACT_CONSENT_ERROR);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const listingNote =
        hasListing === "yes"
          ? "Has existing Airbnb listing"
          : hasListing === "no"
            ? "No listing yet — property location captured"
            : "";
      await submitAuditLead({
        ...form,
        earnings: [listingNote, form.earnings].filter(Boolean).join(" · "),
        contactConsent,
        marketingOptIn,
      });
      window.location.assign("/thank-you");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit. Please call us instead.");
      setSubmitting(false);
    }
  };

  const choiceClass =
    "rounded-2xl border border-white/10 bg-mrg-bg px-5 py-6 text-center transition-all hover:border-mrg-gold/40 hover:bg-mrg-gold/5 active:scale-[0.98]";

  return (
    <section
      id="fit-check"
      className="scroll-mt-24 border-t border-mrg-border/40 py-20 sm:py-28"
    >
      <div id="audit" className="mx-auto max-w-2xl px-5">
        <SectionReveal className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mrg-gold">
            30-second fit check
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-mrg-text sm:text-4xl md:text-5xl">
            See if we&apos;re a fit
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-mrg-muted">
            A few quick taps — then a specialist will show you what your property could earn.
          </p>
        </SectionReveal>

        <SectionReveal delay={0.08} className="mt-10">
          <div className="rounded-[1.75rem] bg-mrg-surface-elevated p-6 shadow-[0_24px_60px_rgba(0,0,0,0.35)] ring-1 ring-white/8 sm:p-9">
            <div className="mb-8 flex gap-2" aria-hidden>
              {Array.from({ length: STEPS }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    i <= step ? "bg-mrg-gold" : "bg-white/10"
                  }`}
                />
              ))}
            </div>

            {step === 0 && (
              <div className="text-center">
                <h3 className="text-xl font-semibold tracking-tight text-mrg-text sm:text-2xl">
                  Do you currently have an Airbnb listing?
                </h3>
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
                      setStep(1);
                    }}
                  >
                    <span className="block text-base font-semibold text-mrg-text">Yes, I do</span>
                    <span className="mt-1 block text-xs text-mrg-muted">Live listing running</span>
                  </button>
                  <button
                    type="button"
                    className={choiceClass}
                    onClick={() => {
                      setHasListing("no");
                      setForm((f) => ({ ...f, earnings: "" }));
                      setStep(1);
                    }}
                  >
                    <span className="block text-base font-semibold text-mrg-text">Not yet</span>
                    <span className="mt-1 block text-xs text-mrg-muted">Property in mind</span>
                  </button>
                </div>
              </div>
            )}

            {step === 1 && (
              <div>
                <h3 className="text-center text-xl font-semibold tracking-tight text-mrg-text sm:text-2xl">
                  {hasListing === "yes" ? "Where’s the property?" : "Where will it be?"}
                </h3>
                <p className="mt-2 text-center text-sm text-mrg-muted">
                  City or neighbourhood is enough for now.
                </p>

                <div className="mt-8">
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    placeholder="e.g. Downtown Toronto"
                    className={inputClass}
                    autoComplete="address-level2"
                  />
                </div>

                {hasListing === "yes" && (
                  <EarningsWheel
                    value={form.earnings}
                    onChange={(earnings) => setForm((f) => ({ ...f, earnings }))}
                  />
                )}

                {hasListing === "no" && (
                  <p className="mt-6 rounded-2xl bg-mrg-bg/80 px-4 py-3 text-center text-sm text-mrg-muted ring-1 ring-white/8">
                    No listing yet is fine — tell us the location and we&apos;ll still take a look.
                  </p>
                )}

                <div className="mt-8 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(0)}
                    className="rounded-full px-5 py-3.5 text-sm font-semibold text-mrg-muted hover:text-mrg-text"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={!form.address.trim() || (hasListing === "yes" && !form.earnings)}
                    onClick={() => setStep(2)}
                    className="flex-1 rounded-full bg-mrg-gold py-3.5 text-sm font-semibold text-black transition-all hover:bg-mrg-gold-light disabled:opacity-40"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <form onSubmit={handleSubmit} className="space-y-3">
                <h3 className="text-center text-xl font-semibold tracking-tight text-mrg-text sm:text-2xl">
                  Where should we send your estimate?
                </h3>
                <p className="text-center text-sm text-mrg-muted">
                  A specialist follows up — usually same day.
                </p>

                <input
                  type="text"
                  name="_gotcha"
                  tabIndex={-1}
                  autoComplete="off"
                  className="hidden"
                  aria-hidden
                />

                <div className="mt-6 space-y-3">
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Your name"
                    className={inputClass}
                    autoComplete="name"
                  />
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="Phone number"
                    className={inputClass}
                    autoComplete="tel"
                  />
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="Email"
                    className={inputClass}
                    autoComplete="email"
                  />
                </div>

                <label className="mt-2 flex cursor-pointer items-start gap-3 px-1 pt-2">
                  <input
                    type="checkbox"
                    required
                    checked={contactConsent}
                    onChange={(e) => setContactConsent(e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 accent-mrg-gold"
                  />
                  <span className="text-sm leading-relaxed text-mrg-muted">
                    Contact me about my earnings estimate.{" "}
                    <span className="text-mrg-text/70">(required)</span>
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-3 px-1">
                  <input
                    type="checkbox"
                    checked={marketingOptIn}
                    onChange={(e) => setMarketingOptIn(e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 accent-mrg-gold"
                  />
                  <span className="text-sm leading-relaxed text-mrg-muted">
                    Occasional STR tips from MRG{" "}
                    <span className="text-mrg-muted/60">(optional)</span>
                  </span>
                </label>

                {error && (
                  <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {error}
                  </p>
                )}

                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="rounded-full px-5 py-3.5 text-sm font-semibold text-mrg-muted hover:text-mrg-text"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 rounded-full bg-mrg-gold py-3.5 text-sm font-semibold text-black transition-all hover:bg-mrg-gold-light disabled:opacity-60"
                  >
                    {submitting ? "Submitting…" : "Get my estimate →"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </SectionReveal>

        <SectionReveal delay={0.12} className="mt-8 space-y-2 text-center text-sm text-mrg-muted">
          <p>{CTA_SUPPORT}</p>
          <a href={PHONE_HREF} className="block font-semibold text-mrg-gold hover:text-mrg-gold-light">
            {CTA_HEADLINE}
          </a>
          <p>
            {EMAIL_CTA_LEAD}{" "}
            <a href={EMAIL_HREF} className="font-semibold text-mrg-gold hover:text-mrg-gold-light">
              {EMAIL}
            </a>
          </p>
        </SectionReveal>
      </div>
    </section>
  );
}
