import { useState, type FormEvent } from "react";
import { EMAIL, EMAIL_HREF, PHONE, PHONE_HREF } from "../lib/constants";
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

export function AuditSection() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [contactConsent, setContactConsent] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!contactConsent) {
      setError("Please confirm we can contact you about your free revenue audit.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await submitAuditLead({ ...form, contactConsent, marketingOptIn });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit. Please call us instead.");
    } finally {
      setSubmitting(false);
    }
  };

  const field = (key: keyof FormState, label: string, opts?: { optional?: boolean; type?: string }) => (
    <label className="block">
      <span className="mb-1.5 block text-sm text-mrg-muted">
        {label}
        {opts?.optional && <span className="text-mrg-muted/60"> (optional)</span>}
      </span>
      <input
        type={opts?.type ?? "text"}
        required={!opts?.optional}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="w-full rounded-xl border border-mrg-border bg-mrg-bg px-4 py-3 text-mrg-text outline-none transition-colors placeholder:text-mrg-muted/50 focus:border-mrg-gold"
      />
    </label>
  );

  return (
    <section
      id="audit"
      className="scroll-mt-20 bg-[radial-gradient(ellipse_80%_50%_at_50%_100%,rgba(201,168,76,0.15),transparent)] py-20 sm:py-28"
    >
      <div className="mx-auto max-w-2xl px-5">
        <SectionReveal className="text-center">
          <h2 className="font-display text-4xl text-mrg-text sm:text-5xl">
            See What Your Toronto Unit Could Actually Earn
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-mrg-muted">
            A free 15-minute revenue audit. We show you the gap between what you earn now and what
            your property should earn. No pitch. No obligation.
          </p>
        </SectionReveal>

        <SectionReveal delay={0.1} className="mt-10">
          {submitted ? (
            <div className="rounded-2xl border border-mrg-gold/40 bg-mrg-gold/10 p-8 text-center">
              <p className="font-display text-2xl text-mrg-text">You're in — check your inbox.</p>
              <p className="mt-3 text-mrg-muted">
                We just sent a confirmation email and will reach out shortly to schedule your
                15-minute audit. Or call now:{" "}
                <a href={PHONE_HREF} className="font-semibold text-mrg-gold">
                  {PHONE}
                </a>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-mrg-border bg-mrg-surface p-6 sm:p-8">
              <input
                type="text"
                name="_gotcha"
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
                aria-hidden
              />
              {field("name", "Name")}
              {field("email", "Email", { type: "email" })}
              {field("phone", "Phone", { type: "tel" })}
              {field("address", "Property address / neighbourhood")}
              {field("earnings", "Rough current monthly earnings", { optional: true })}

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-mrg-border/70 bg-mrg-bg/40 px-4 py-3">
                <input
                  type="checkbox"
                  required
                  checked={contactConsent}
                  onChange={(e) => setContactConsent(e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-mrg-gold"
                />
                <span className="text-sm leading-relaxed text-mrg-muted">
                  I agree to be contacted by Mandel Realty Group about my free revenue audit by
                  email or phone. <span className="text-mrg-text/80">(required)</span>
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
                  Also send me occasional Toronto short-term rental tips from MRG.{" "}
                  <span className="text-mrg-muted/70">(optional)</span>
                </span>
              </label>

              {error && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="mt-2 w-full rounded-full bg-mrg-gold py-4 font-semibold text-mrg-bg transition-all hover:bg-mrg-gold-light disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Book My Free Audit"}
              </button>
              <p className="text-center text-xs text-mrg-muted">
                No spam · We’ll reach out to book a 15-min slot.
              </p>
            </form>
          )}
        </SectionReveal>

        <SectionReveal delay={0.15} className="mt-8 text-center text-sm text-mrg-muted">
          <a href={PHONE_HREF} className="font-semibold text-mrg-gold hover:text-mrg-gold-light">
            {PHONE}
          </a>
          <span className="mx-2">·</span>
          <a href={EMAIL_HREF} className="text-mrg-muted hover:text-mrg-text">
            {EMAIL}
          </a>
        </SectionReveal>
      </div>
    </section>
  );
}
