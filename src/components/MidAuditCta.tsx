import { useState, type FormEvent } from "react";
import { PHONE, PHONE_HREF } from "../lib/constants";
import { submitAuditLead } from "../lib/submitAuditLead";
import { SectionReveal } from "./SectionReveal";

type FormState = {
  name: string;
  email: string;
  phone: string;
  address: string;
};

const EMPTY: FormState = {
  name: "",
  email: "",
  phone: "",
  address: "",
};

export function MidAuditCta() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [contactConsent, setContactConsent] = useState(false);
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
      await submitAuditLead({
        ...form,
        earnings: "",
        contactConsent,
        marketingOptIn: false,
      });
      window.location.assign("/thank-you");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit. Please call us instead.");
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-mrg-border bg-mrg-bg px-4 py-3 text-mrg-text outline-none transition-colors placeholder:text-mrg-muted/50 focus:border-mrg-gold";

  return (
    <section id="mid-audit" className="scroll-mt-24 border-b border-mrg-border/40 py-16 sm:py-20">
      <div className="mx-auto max-w-4xl px-5">
        <SectionReveal className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mrg-gold">
            Free revenue audit
          </p>
          <h2 className="mt-3 font-display text-3xl text-mrg-text sm:text-4xl">
            See what your unit can earn
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-mrg-muted">
            Drop your details — we&apos;ll show you the gap between what you make now and what the
            unit should make. 15 minutes. No pitch.
          </p>
        </SectionReveal>

        <SectionReveal delay={0.08} className="mt-8">
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              name="_gotcha"
              tabIndex={-1}
              autoComplete="off"
              className="hidden"
              aria-hidden
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="sr-only">Name</span>
                <input
                  required
                  placeholder="Name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="sr-only">Email</span>
                <input
                  required
                  type="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="sr-only">Phone</span>
                <input
                  required
                  type="tel"
                  placeholder="Phone"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="sr-only">Neighbourhood or address</span>
                <input
                  required
                  placeholder="Neighbourhood or address"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className={inputClass}
                />
              </label>
            </div>

            <label className="flex cursor-pointer items-start gap-3 px-1 pt-1">
              <input
                type="checkbox"
                required
                checked={contactConsent}
                onChange={(e) => setContactConsent(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 accent-mrg-gold"
              />
              <span className="text-sm leading-relaxed text-mrg-muted">
                Contact me about my free revenue audit.{" "}
                <span className="text-mrg-text/70">(required)</span>
              </span>
            </label>

            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full bg-mrg-gold px-8 py-4 font-semibold text-mrg-bg transition-all hover:bg-mrg-gold-light disabled:opacity-60 sm:w-auto"
              >
                {submitting ? "Submitting…" : "Get My Free Audit"}
              </button>
              <a
                href={PHONE_HREF}
                className="text-center text-sm font-semibold text-mrg-gold hover:text-mrg-gold-light sm:text-left"
              >
                Or call {PHONE}
              </a>
            </div>
          </form>
        </SectionReveal>
      </div>
    </section>
  );
}
