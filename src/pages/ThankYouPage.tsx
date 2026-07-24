import { useEffect, useState } from "react";
import { EMAIL, EMAIL_HREF, PHONE, PHONE_HREF } from "../lib/constants";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { trackMetaLead } from "../lib/metaPixel";
import { LEAD_HANDOFF_KEY } from "../lib/submitAuditLead";

type Handoff = {
  leadId: string | null;
  hasListing: "yes" | "no" | "unknown";
  name?: string;
};

const STAGES = [
  { value: "own_ready", label: "I own a property and want to start Airbnb" },
  { value: "buying", label: "I’m buying or renovating soon" },
  { value: "researching", label: "Just researching — no property yet" },
] as const;

const PERMITS = [
  { value: "have", label: "I already have an STR permit" },
  { value: "applying", label: "I’m applying / will apply" },
  { value: "unknown", label: "Not sure if I need one" },
  { value: "not_planning", label: "Not planning to get one" },
] as const;

const TIMELINES = [
  { value: "asap", label: "ASAP" },
  { value: "1_3_months", label: "1–3 months" },
  { value: "later", label: "3+ months / just curious" },
] as const;

function ConfirmedBlock() {
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mrg-gold">Call booked</p>
      <h1 className="mt-4 font-display text-4xl text-mrg-text sm:text-5xl">
        You&apos;re on the calendar.
      </h1>
      <p className="mt-5 text-base leading-relaxed text-mrg-muted sm:text-lg">
        Check your email for the exact time and calendar invite. We&apos;ll call the number you
        provided — and if you have a live listing, reply to that email with your Airbnb link so we
        can prepare.
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
    </>
  );
}

export function ThankYouPage() {
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [ready, setReady] = useState(false);
  const [propertyStage, setPropertyStage] = useState("");
  const [permitStatus, setPermitStatus] = useState("");
  const [launchTimeline, setLaunchTimeline] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Thank You | Mandel Realty Group";
    const robots = document.querySelector('meta[name="robots"]');
    if (robots) robots.setAttribute("content", "noindex, nofollow");
    trackMetaLead();

    try {
      const raw = sessionStorage.getItem(LEAD_HANDOFF_KEY);
      if (raw) {
        const data = JSON.parse(raw) as Handoff;
        setHandoff(data);
        // Keep handoff until qualifier finishes so refresh doesn't lose leadId mid-flow
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const showQualifier =
    ready &&
    !done &&
    handoff?.hasListing === "no" &&
    Boolean(handoff.leadId);

  const submitQualifier = async () => {
    if (!handoff?.leadId) return;
    if (!propertyStage || !permitStatus || !launchTimeline) {
      setError("Please answer all three questions.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/lead-qualify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: handoff.leadId,
          propertyStage,
          permitStatus,
          launchTimeline,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not save.");
      try {
        sessionStorage.removeItem(LEAD_HANDOFF_KEY);
      } catch {
        /* ignore */
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSubmitting(false);
    }
  };

  const choiceClass = (active: boolean) =>
    `w-full rounded-2xl px-4 py-3.5 text-left text-sm font-medium transition-all ring-1 ${
      active
        ? "bg-mrg-gold text-black ring-mrg-gold"
        : "bg-mrg-surface text-mrg-text ring-white/10 hover:ring-mrg-gold/40"
    }`;

  return (
    <>
      <Header />
      <main className="flex min-h-[70vh] items-center justify-center px-5 py-20">
        <div className={`mx-auto w-full text-center ${showQualifier ? "max-w-xl" : "max-w-lg"}`}>
          {!ready ? null : showQualifier ? (
            <div className="text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mrg-gold">
                Call booked
              </p>
              <h1 className="mt-4 font-display text-3xl text-mrg-text sm:text-4xl">
                Quick questions so we can prepare
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-mrg-muted sm:text-base">
                Your call is confirmed. These 3 answers help us know if we&apos;re the right fit —
                takes about 20 seconds.
              </p>

              <div className="mt-8 space-y-6">
                <fieldset className="space-y-2">
                  <legend className="text-sm font-semibold text-mrg-text">
                    Where are you at?
                  </legend>
                  {STAGES.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      className={choiceClass(propertyStage === o.value)}
                      onClick={() => setPropertyStage(o.value)}
                    >
                      {o.label}
                    </button>
                  ))}
                </fieldset>

                <fieldset className="space-y-2">
                  <legend className="text-sm font-semibold text-mrg-text">STR permit?</legend>
                  {PERMITS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      className={choiceClass(permitStatus === o.value)}
                      onClick={() => setPermitStatus(o.value)}
                    >
                      {o.label}
                    </button>
                  ))}
                </fieldset>

                <fieldset className="space-y-2">
                  <legend className="text-sm font-semibold text-mrg-text">
                    When do you want to launch?
                  </legend>
                  {TIMELINES.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      className={choiceClass(launchTimeline === o.value)}
                      onClick={() => setLaunchTimeline(o.value)}
                    >
                      {o.label}
                    </button>
                  ))}
                </fieldset>
              </div>

              {error && (
                <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </p>
              )}

              <button
                type="button"
                disabled={submitting}
                onClick={submitQualifier}
                className="mt-8 w-full rounded-full bg-mrg-gold py-3.5 text-sm font-semibold text-black hover:bg-mrg-gold-light disabled:opacity-60"
              >
                {submitting ? "Saving…" : "Save & finish →"}
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    sessionStorage.removeItem(LEAD_HANDOFF_KEY);
                  } catch {
                    /* ignore */
                  }
                  setDone(true);
                }}
                className="mt-3 w-full py-2 text-sm text-mrg-muted hover:text-mrg-text"
              >
                Skip for now
              </button>
            </div>
          ) : (
            <ConfirmedBlock />
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
