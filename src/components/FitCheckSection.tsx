import { useState, type FormEvent } from "react";
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

export function FitCheckSection() {
  const [step, setStep] = useState(0);
  const [hasListing, setHasListing] = useState<string | null>(null);
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
            ? "No listing yet"
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
    "rounded-2xl border border-white/15 bg-mrg-bg px-5 py-5 text-center text-base font-semibold text-mrg-text transition-all hover:border-white/35 hover:bg-white/5 active:scale-[0.98]";

  return (
    <section
      id="fit-check"
      className="scroll-mt-24 border-t border-mrg-border/40 py-20 sm:py-28"
    >
      {/* Keep #audit for any old links */}
      <div id="audit" className="mx-auto max-w-2xl px-5">
        <SectionReveal className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mrg-gold">
            30-second fit check
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-mrg-text sm:text-4xl md:text-5xl">
            See if we&apos;re a fit
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-mrg-muted">
            Answer a couple of quick questions and talk to a specialist about what your property
            could earn.
          </p>
        </SectionReveal>

        <SectionReveal delay={0.08} className="mt-10">
          <div className="rounded-3xl bg-mrg-surface-elevated p-6 sm:p-8">
            <div className="mb-8 flex gap-2" aria-hidden>
              {Array.from({ length: STEPS }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${
                    i <= step ? "bg-mrg-gold" : "bg-white/10"
                  }`}
                />
              ))}
            </div>

            {step === 0 && (
              <div className="text-center">
                <h3 className="text-xl font-semibold text-mrg-text sm:text-2xl">
                  Do you currently have an Airbnb listing?
                </h3>
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    className={choiceClass}
                    onClick={() => {
                      setHasListing("yes");
                      setStep(1);
                    }}
                  >
                    Yes, I do
                  </button>
                  <button
                    type="button"
                    className={choiceClass}
                    onClick={() => {
                      setHasListing("no");
                      setStep(1);
                    }}
                  >
                    Not yet
                  </button>
                </div>
              </div>
            )}

            {step === 1 && (
              <div>
                <h3 className="text-center text-xl font-semibold text-mrg-text sm:text-2xl">
                  Where&apos;s the property?
                </h3>
                <p className="mt-2 text-center text-sm text-mrg-muted">
                  City or neighbourhood is enough for now.
                </p>
                <label className="mt-8 block">
                  <span className="mb-1.5 block text-sm text-mrg-muted">Property location</span>
                  <input
                    type="text"
                    required
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    placeholder="e.g. Downtown Toronto"
                    className="w-full rounded-xl border border-mrg-border bg-mrg-bg px-4 py-3 text-mrg-text outline-none transition-colors placeholder:text-mrg-muted/50 focus:border-mrg-gold"
                  />
                </label>
                {hasListing === "yes" && (
                  <label className="mt-4 block">
                    <span className="mb-1.5 block text-sm text-mrg-muted">
                      Rough current monthly earnings{" "}
                      <span className="text-mrg-muted/60">(optional)</span>
                    </span>
                    <input
                      type="text"
                      value={form.earnings}
                      onChange={(e) => setForm((f) => ({ ...f, earnings: e.target.value }))}
                      placeholder="e.g. $3,000"
                      className="w-full rounded-xl border border-mrg-border bg-mrg-bg px-4 py-3 text-mrg-text outline-none transition-colors placeholder:text-mrg-muted/50 focus:border-mrg-gold"
                    />
                  </label>
                )}
                <div className="mt-8 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(0)}
                    className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-mrg-muted hover:text-mrg-text"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={!form.address.trim()}
                    onClick={() => setStep(2)}
                    className="flex-1 rounded-full bg-mrg-gold py-3 text-sm font-semibold text-black transition-all hover:bg-mrg-gold-light disabled:opacity-50"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="text-center text-xl font-semibold text-mrg-text sm:text-2xl">
                  How should we reach you?
                </h3>
                <input
                  type="text"
                  name="_gotcha"
                  tabIndex={-1}
                  autoComplete="off"
                  className="hidden"
                  aria-hidden
                />
                <label className="block">
                  <span className="mb-1.5 block text-sm text-mrg-muted">Name</span>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-xl border border-mrg-border bg-mrg-bg px-4 py-3 text-mrg-text outline-none transition-colors focus:border-mrg-gold"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm text-mrg-muted">Email</span>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full rounded-xl border border-mrg-border bg-mrg-bg px-4 py-3 text-mrg-text outline-none transition-colors focus:border-mrg-gold"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm text-mrg-muted">Phone</span>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full rounded-xl border border-mrg-border bg-mrg-bg px-4 py-3 text-mrg-text outline-none transition-colors focus:border-mrg-gold"
                  />
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-mrg-border/70 bg-mrg-bg/40 px-4 py-3">
                  <input
                    type="checkbox"
                    required
                    checked={contactConsent}
                    onChange={(e) => setContactConsent(e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 accent-mrg-gold"
                  />
                  <span className="text-sm leading-relaxed text-mrg-muted">
                    I agree to be contacted by Mandel Realty Group about my custom earnings estimate
                    by email or phone. <span className="text-mrg-text/80">(required)</span>
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
                    Also send me occasional short-term rental tips from MRG.{" "}
                    <span className="text-mrg-muted/70">(optional)</span>
                  </span>
                </label>

                {error && (
                  <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {error}
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-mrg-muted hover:text-mrg-text"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 rounded-full bg-mrg-gold py-3.5 text-sm font-semibold text-black transition-all hover:bg-mrg-gold-light disabled:opacity-60"
                  >
                    {submitting ? "Submitting…" : "Get my earnings estimate"}
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
