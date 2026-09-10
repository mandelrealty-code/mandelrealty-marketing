import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  CONTACT_CONSENT_ERROR,
  EARNINGS_SUMMARY,
  FIT_CHECK_HANDOFF_KEY,
  PHONE,
  PHONE_HREF,
  TESTIMONIALS,
  WHATSAPP_HREF,
} from "../lib/constants";
import { submitAuditLead, LEAD_HANDOFF_KEY } from "../lib/submitAuditLead";
import { setPageSeo } from "../lib/pageSeo";
import { formatCallSlotLabel } from "../../shared/callSlots";
import {
  BOOK_CALL_PLANS,
  bookCallPlanLabel,
  normalizeBookCallPlanId,
  type BookCallPlanId,
} from "../../shared/bookCallPlans";
import {
  PERMIT_OPTIONS,
  PROPERTY_STAGES,
  STR_ALLOWED_OPTIONS,
} from "../../shared/qualifierOptions";
import { EARNINGS_OPTIONS } from "../components/FitCheckSection";
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

type Stage = "interest" | "qualify" | "yes_details" | "no_details" | "book";

const STEP_LABELS = ["Plan", "Listing", "Details", "Book"] as const;

const trustQuote = TESTIMONIALS[0];

/**
 * Book a call funnel — white hub chrome, Instant Form–style steps.
 * Visual language from Claude Design `docs/MRG-Book-A-Call.dc.html`.
 */
export function AdsLandingPage() {
  const [stage, setStage] = useState<Stage>("interest");
  const [interestedPlan, setInterestedPlan] = useState<BookCallPlanId | null>(null);
  const [hasListing, setHasListing] = useState<"yes" | "no" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [contactConsent, setContactConsent] = useState(false);
  const [callStartIso, setCallStartIso] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPageSeo({
      title: "Book a Free 15-Minute Call | Mandel Realty Group",
      description:
        "Book a free 15-minute call with Mandel Realty Group. Tell us which plan you’re interested in — Full Service, Growth, Essentials, or Furniture Investment.",
      path: "/book-a-call",
    });

    let planFromUrl: BookCallPlanId | null = null;
    try {
      const q = new URLSearchParams(window.location.search);
      planFromUrl = normalizeBookCallPlanId(q.get("plan"));
      if (planFromUrl) setInterestedPlan(planFromUrl);
    } catch {
      /* ignore */
    }

    try {
      const raw = sessionStorage.getItem(FIT_CHECK_HANDOFF_KEY);
      if (!raw) {
        if (planFromUrl) setStage("qualify");
        return;
      }
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
        interestedPlan?: string;
      };
      const handoffPlan = normalizeBookCallPlanId(data.interestedPlan);
      if (handoffPlan) setInterestedPlan(handoffPlan);
      else if (planFromUrl) setInterestedPlan(planFromUrl);

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
      else if (handoffPlan || planFromUrl) setStage("qualify");
    } catch {
      if (planFromUrl) setStage("qualify");
    }
  }, []);

  useEffect(() => {
    if (stage === "interest") return;
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
      setError("Pick a call time. We’ll call the number you entered.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const planLabel = bookCallPlanLabel(interestedPlan);
    const source =
      interestedPlan && interestedPlan !== "not-sure"
        ? `/book-a-call?plan=${interestedPlan}`
        : "/book-a-call";
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
        source,
        contactConsent,
        marketingOptIn: false,
        propertyStage: hasListing === "no" ? form.propertyStage : undefined,
        permitStatus: hasListing === "no" ? form.permitStatus : undefined,
        strAllowed: hasListing === "no" ? form.strAllowed : undefined,
        interestedPlan: interestedPlan || undefined,
      });
      try {
        sessionStorage.setItem(
          LEAD_HANDOFF_KEY,
          JSON.stringify({
            leadId: result.leadId,
            hasListing: result.hasListing,
            name: form.name.trim(),
            interestedPlan: planLabel || undefined,
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
    "w-full rounded-[14px] border border-[#dddddd] bg-white px-[15px] py-[13px] text-[15px] font-medium text-[#222222] outline-none transition-colors placeholder:text-[#a0a0a0] focus:border-[#c4a35a]";

  const primaryBtn =
    "ml-auto inline-flex min-h-12 items-center justify-center rounded-full bg-[#c4a35a] px-6 py-3.5 text-[15px] font-bold text-[#1f1a10] transition-colors hover:bg-[#dcc084] disabled:cursor-not-allowed disabled:opacity-40";

  const backBtn =
    "inline-flex min-h-12 items-center justify-center border-0 bg-transparent px-0 text-sm font-bold text-[#717171] transition-colors hover:text-[#222222]";

  const stepIndex =
    stage === "interest"
      ? 0
      : stage === "qualify"
        ? 1
        : stage === "yes_details" || stage === "no_details"
          ? 2
          : 3;

  const yesReady = Boolean(form.listingTitle.trim() && form.address.trim());
  const noReady = Boolean(
    form.propertyStage && form.strAllowed && form.permitStatus && form.address.trim(),
  );

  const pickPlan = (id: BookCallPlanId) => {
    setInterestedPlan(id);
    setStage("qualify");
  };

  const planAccent =
    BOOK_CALL_PLANS.find((p) => p.id === interestedPlan)?.accent || "#8a8a8a";

  const mayAug = EARNINGS_SUMMARY.mayAug2026.toLocaleString();
  const year2025 = EARNINGS_SUMMARY.year2025.toLocaleString();

  const bookSupport = [
    interestedPlan && interestedPlan !== "not-sure"
      ? `We’ll focus on ${bookCallPlanLabel(interestedPlan)}.`
      : null,
    hasListing === "yes"
      ? "MRG will review your listing before we call."
      : "No listing yet is fine. We’ll cover fit and next steps.",
  ]
    .filter(Boolean)
    .join(" ");

  const optionClass = (active: boolean) =>
    `w-full min-h-12 rounded-2xl px-4 py-3.5 text-left text-[15px] font-medium leading-snug transition-all ${
      active
        ? "border border-[#c4a35a] bg-[#fbf9f4] text-[#222222]"
        : "border border-[#dddddd] bg-white text-[#222222] hover:border-[#c4a35a]"
    }`;

  const proofBlock = (
    <div className="flex flex-col gap-3.5 rounded-[20px] border border-[#ebebeb] bg-[#f7f7f7] p-5">
      <span className="text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[#717171]">
        Proof
      </span>
      <div className="overflow-hidden rounded-[14px] border border-[#ebebeb] bg-white p-3">
        <EarningsComparisonChart variant="light" />
        <div className="mt-3 border-t border-[#ebebeb] pt-3">
          <DashboardScreenshotThumbs variant="light" shots={[...DASHBOARD_SHOTS]} />
        </div>
      </div>
      <p className="text-sm font-medium leading-[1.55] text-[#5e5e5e]">
        Just <strong className="text-[#222222]">4 months</strong> of 2026 ({`$${mayAug}`}) already
        beat the host&apos;s <strong className="text-[#222222]">entire 2025</strong> ({`$${year2025}`}
        ). Same unit, same platform.
      </p>
      <p className="text-sm font-medium leading-[1.55] text-[#5e5e5e]">
        “{trustQuote.quote}” · {trustQuote.name}, {trustQuote.location}
      </p>
    </div>
  );

  return (
    <div className="min-h-dvh bg-white font-sans text-[#222222]">
      <header className="sticky top-0 z-20 border-b border-[#ebebeb] bg-white">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-3 px-5 py-3.5 sm:gap-5 sm:px-6">
          <a href="/" className="mr-auto block" aria-label="Mandel Realty Group home">
            <img
              src="/hub/mrg-logo.png"
              alt="Mandel Realty Group"
              className="block h-10 w-auto sm:h-11"
            />
          </a>
          <nav className="hidden items-center gap-1 text-[14.5px] font-semibold sm:flex">
            <a
              href="/#plans"
              className="rounded-full px-3 py-2 text-[#5e5e5e] transition-colors hover:text-[#222222]"
            >
              Plans
            </a>
            <a
              href="/revenueaudit/"
              className="rounded-full px-3 py-2 text-[#5e5e5e] transition-colors hover:text-[#222222]"
            >
              Revenue audit
            </a>
          </nav>
          <div className="flex items-center gap-2.5">
            <a
              href={PHONE_HREF}
              className="whitespace-nowrap rounded-full border border-[#dddddd] px-3.5 py-2 text-sm font-bold text-[#222222] transition-colors hover:border-[#222222] sm:px-4"
            >
              {PHONE}
            </a>
            <span className="hidden whitespace-nowrap rounded-full border border-[#ecdfc2] bg-[#f7f2e6] px-4 py-2 text-sm font-bold text-[#8a6f2e] sm:inline">
              Book a call
            </span>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-[1120px] gap-10 px-5 pb-16 pt-8 sm:px-6 sm:pt-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:gap-14 lg:pb-16 lg:pt-14">
          <div className="flex flex-col gap-5 lg:gap-[22px] lg:pt-1.5">
            <p className="text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[#8a6f2e]">
              Free 15-minute call
            </p>
            <h1 className="text-[clamp(1.85rem,4.5vw,3rem)] font-extrabold leading-[1.03] tracking-[-0.04em] text-balance">
              Book a call. We will show you the fit.
            </h1>
            <p className="max-w-[40ch] text-[17px] font-medium leading-[1.55] text-[#5e5e5e]">
              Short call. Toronto based, working across Canada and the U.S. No pressure, no
              obligation.
            </p>

            <div className="hidden lg:block">{proofBlock}</div>

            <div className="hidden flex-col gap-2 border-t border-[#ebebeb] pt-[18px] lg:flex">
              <span className="text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[#717171]">
                Prefer to talk now
              </span>
              <div className="flex flex-wrap gap-2">
                <a
                  href={PHONE_HREF}
                  className="rounded-full border border-[#dddddd] px-4 py-2.5 text-sm font-bold text-[#222222] transition-colors hover:border-[#222222]"
                >
                  {PHONE}
                </a>
                <a
                  href={WHATSAPP_HREF}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-[#dddddd] px-4 py-2.5 text-sm font-bold text-[#222222] transition-colors hover:border-[#222222]"
                >
                  WhatsApp
                </a>
              </div>
            </div>
          </div>

          <aside id="book" ref={formCardRef} className="min-w-0 scroll-mt-24 lg:sticky lg:top-6">
            <div className="overflow-hidden rounded-[26px] border border-[#ebebeb] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
              <div className="flex items-center gap-3 border-b border-[#ebebeb] bg-white px-5 py-[18px] sm:px-[26px]">
                <img
                  src="/hub/mrg-logo.png"
                  alt=""
                  aria-hidden
                  className="block h-[30px] w-auto"
                />
                <span className="ml-auto text-sm font-bold tracking-[-0.01em] text-[#222222]">
                  Free 15-minute call
                </span>
              </div>

              <div className="flex gap-2.5 px-5 pt-[18px] sm:px-[26px]">
                {STEP_LABELS.map((label, i) => (
                  <div key={label} className="flex flex-1 flex-col gap-[7px]">
                    <div className="h-1 overflow-hidden rounded-full bg-[#ebebeb]">
                      <div
                        className="h-full rounded-full bg-[#c4a35a] transition-[width] duration-[420ms] ease-out"
                        style={{ width: i <= stepIndex ? "100%" : "0%" }}
                      />
                    </div>
                    <span
                      className={`text-[11.5px] font-bold uppercase tracking-[0.06em] ${
                        i === stepIndex ? "text-[#8a6f2e]" : "text-[#a0a0a0]"
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                ))}
              </div>

              <div className="p-5 sm:p-[26px]">
                {stage === "interest" && (
                  <div className="flex flex-col gap-[18px]">
                    <div className="flex flex-col gap-[7px]">
                      <h2 className="text-[clamp(1.35rem,3vw,1.625rem)] font-extrabold tracking-[-0.035em]">
                        What are you interested in?
                      </h2>
                      <p className="text-[15px] font-medium leading-[1.5] text-[#717171]">
                        Pick a plan so we prep the right conversation, or choose not sure.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      {BOOK_CALL_PLANS.map((plan) => {
                        const active = interestedPlan === plan.id;
                        return (
                          <button
                            key={plan.id}
                            type="button"
                            onClick={() => pickPlan(plan.id)}
                            className={`flex w-full items-stretch gap-3.5 rounded-2xl border px-4 py-3.5 text-left transition-colors ${
                              active
                                ? "border-[#c4a35a] bg-[#fbf9f4] shadow-[0_8px_24px_rgba(0,0,0,0.05)]"
                                : "border-[#ebebeb] bg-white hover:border-[#c4a35a] hover:bg-[#fbf9f4]"
                            }`}
                          >
                            <span
                              className="w-[7px] shrink-0 rounded-full"
                              style={{ background: plan.accent }}
                              aria-hidden
                            />
                            <span className="block min-w-0">
                              <span className="block text-[15.5px] font-bold tracking-[-0.015em] text-[#222222]">
                                {plan.label}
                              </span>
                              <span className="mt-[3px] block text-[13.5px] font-medium text-[#717171]">
                                {plan.blurb}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {stage === "qualify" && (
                  <div className="flex flex-col gap-[18px]">
                    {interestedPlan && (
                      <button
                        type="button"
                        onClick={() => setStage("interest")}
                        className="inline-flex w-fit items-center gap-[9px] rounded-full border border-[#ebebeb] bg-[#f7f7f7] px-3.5 py-[7px] text-[13px] font-bold text-[#222222] transition-colors hover:border-[#c4a35a]"
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: planAccent }}
                          aria-hidden
                        />
                        {bookCallPlanLabel(interestedPlan)}{" "}
                        <span className="text-[#8a6f2e]">. change</span>
                      </button>
                    )}
                    <div className="flex flex-col gap-[7px]">
                      <h2 className="text-[clamp(1.35rem,3vw,1.625rem)] font-extrabold tracking-[-0.035em]">
                        Do you have an Airbnb listing live right now?
                      </h2>
                      <p className="text-[15px] font-medium leading-[1.5] text-[#717171]">
                        This changes what we prep before the call.
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        className="rounded-[18px] border border-[#ebebeb] bg-white p-5 text-left transition-colors hover:border-[#c4a35a]"
                        onClick={() => {
                          setHasListing("yes");
                          setForm((f) => ({
                            ...f,
                            earnings: f.earnings || "$2,500 – $5,000 / mo",
                          }));
                          setStage("yes_details");
                        }}
                      >
                        <span className="block text-[17px] font-extrabold tracking-[-0.02em]">
                          Yes, it is live
                        </span>
                        <span className="mt-[5px] block text-[13.5px] font-medium text-[#717171]">
                          Already hosting guests
                        </span>
                      </button>
                      <button
                        type="button"
                        className="rounded-[18px] border border-[#ebebeb] bg-white p-5 text-left transition-colors hover:border-[#c4a35a]"
                        onClick={() => {
                          setHasListing("no");
                          setForm((f) => ({ ...f, earnings: "", listingTitle: "" }));
                          setStage("no_details");
                        }}
                      >
                        <span className="block text-[17px] font-extrabold tracking-[-0.02em]">
                          No, not yet
                        </span>
                        <span className="mt-[5px] block text-[13.5px] font-medium text-[#717171]">
                          Launching or exploring
                        </span>
                      </button>
                    </div>
                    {!interestedPlan && (
                      <button type="button" onClick={() => setStage("interest")} className={backBtn}>
                        Back
                      </button>
                    )}
                  </div>
                )}

                {stage === "yes_details" && (
                  <div className="flex flex-col gap-[18px]">
                    <div className="flex flex-col gap-[7px]">
                      <h2 className="text-[clamp(1.35rem,3vw,1.625rem)] font-extrabold tracking-[-0.035em]">
                        Tell us about the listing
                      </h2>
                      <p className="text-[15px] font-medium leading-[1.5] text-[#717171]">
                        So MRG can look it up before the call. No link needed.
                      </p>
                    </div>
                    <label className="flex flex-col gap-[7px]">
                      <span className="text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[#717171]">
                        Airbnb listing title
                      </span>
                      <input
                        type="text"
                        value={form.listingTitle}
                        onChange={(e) => setForm((f) => ({ ...f, listingTitle: e.target.value }))}
                        placeholder="Bright 2 bed near the lake"
                        className={fieldClass}
                        enterKeyHint="next"
                      />
                    </label>
                    <label className="flex flex-col gap-[7px]">
                      <span className="text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[#717171]">
                        Property address
                      </span>
                      <input
                        type="text"
                        value={form.address}
                        onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                        placeholder="Street, city"
                        className={fieldClass}
                        autoComplete="street-address"
                        enterKeyHint="next"
                      />
                    </label>
                    <div className="flex flex-col gap-[9px]">
                      <span className="text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[#717171]">
                        Typical monthly revenue
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {EARNINGS_OPTIONS.map((opt) => {
                          const active = form.earnings === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setForm((f) => ({ ...f, earnings: opt }))}
                              className={`rounded-full border px-[15px] py-[9px] text-[13.5px] font-bold transition-colors ${
                                active
                                  ? "border-[#c4a35a] bg-[#fbf9f4] text-[#222222]"
                                  : "border-[#dddddd] bg-white text-[#222222] hover:border-[#c4a35a]"
                              }`}
                            >
                              {opt.replace(" / mo", "")}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-3.5 pt-1">
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
                  <div className="flex flex-col gap-[18px]">
                    <div className="flex flex-col gap-[7px]">
                      <h2 className="text-[clamp(1.35rem,3vw,1.625rem)] font-extrabold tracking-[-0.035em]">
                        A few quick questions
                      </h2>
                      <p className="text-[15px] font-medium leading-[1.5] text-[#717171]">
                        Helps MRG know if we’re the right fit before the call.
                      </p>
                    </div>

                    <div className="max-h-[min(58dvh,32rem)] space-y-5 overflow-y-auto overscroll-contain pr-0.5 sm:max-h-none sm:overflow-visible">
                      <fieldset className="space-y-2">
                        <legend className="text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[#717171]">
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
                        <legend className="text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[#717171]">
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
                        <legend className="text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[#717171]">
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

                      <label className="flex flex-col gap-[7px]">
                        <span className="text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[#717171]">
                          Property address
                        </span>
                        <input
                          type="text"
                          value={form.address}
                          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                          placeholder="e.g. 123 King St W, Toronto"
                          className={fieldClass}
                          autoComplete="street-address"
                          enterKeyHint="done"
                        />
                      </label>
                    </div>

                    <div className="flex items-center gap-3.5 border-t border-[#ebebeb] pt-4 sm:border-0 sm:pt-1">
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
                  <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
                    <div className="flex flex-col gap-[7px]">
                      <h2 className="text-[clamp(1.35rem,3vw,1.625rem)] font-extrabold tracking-[-0.035em]">
                        Lock in your call
                      </h2>
                      <p className="text-[15px] font-medium leading-[1.5] text-[#717171]">
                        {bookSupport}
                      </p>
                    </div>

                    <input
                      type="text"
                      name="_gotcha"
                      tabIndex={-1}
                      autoComplete="off"
                      className="hidden"
                      aria-hidden
                    />

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="flex flex-col gap-[7px] sm:col-span-2">
                        <span className="text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[#717171]">
                          Name
                        </span>
                        <input
                          required
                          value={form.name}
                          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                          placeholder="First and last"
                          className={fieldClass}
                          autoComplete="name"
                          enterKeyHint="next"
                        />
                      </label>
                      <label className="flex flex-col gap-[7px]">
                        <span className="text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[#717171]">
                          Phone
                        </span>
                        <input
                          required
                          type="tel"
                          inputMode="tel"
                          value={form.phone}
                          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                          placeholder="(647) 000-0000"
                          className={fieldClass}
                          autoComplete="tel"
                          enterKeyHint="next"
                        />
                      </label>
                      <label className="flex flex-col gap-[7px]">
                        <span className="text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[#717171]">
                          Email
                        </span>
                        <input
                          required
                          type="email"
                          inputMode="email"
                          value={form.email}
                          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                          placeholder="you@email.com"
                          className={fieldClass}
                          autoComplete="email"
                          enterKeyHint="next"
                        />
                      </label>
                    </div>

                    <div className="flex flex-col gap-3 rounded-[18px] border border-[#ebebeb] bg-[#fcfcfc] p-4">
                      <div className="flex items-baseline gap-2.5">
                        <span className="text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[#717171]">
                          Pick a time
                        </span>
                      </div>
                      <CallTimePicker value={callStartIso} onChange={setCallStartIso} />
                      {callStartIso && (
                        <p className="text-sm font-medium text-[#8a6f2e]">
                          Selected: {formatCallSlotLabel(callStartIso)}
                        </p>
                      )}
                    </div>

                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        required
                        checked={contactConsent}
                        onChange={(e) => setContactConsent(e.target.checked)}
                        className="mt-1 h-5 w-5 shrink-0 accent-[#c4a35a]"
                      />
                      <span className="text-sm font-medium leading-snug text-[#5e5e5e]">
                        Mandel Realty Group can call me about Airbnb management.{" "}
                        <span className="text-[#222222]">(required)</span>
                      </span>
                    </label>

                    {error && (
                      <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                      </p>
                    )}

                    <div className="flex items-center gap-3.5">
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
                        {submitting ? "Booking…" : "Book my free call"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            <p className="mt-4 text-center text-xs text-[#717171] lg:hidden">
              Or call{" "}
              <a href={PHONE_HREF} className="font-bold text-[#8a6f2e]">
                {PHONE}
              </a>
              {" · "}
              <a
                href={WHATSAPP_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-[#8a6f2e]"
              >
                WhatsApp
              </a>
            </p>
          </aside>

          <div className="lg:hidden">{proofBlock}</div>
        </section>
      </main>

      <footer className="border-t border-[#ebebeb] px-5 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] text-center text-xs text-[#717171]">
        © {new Date().getFullYear()} Mandel Realty Group · Toronto · Canada &amp; U.S.
      </footer>
    </div>
  );
}
