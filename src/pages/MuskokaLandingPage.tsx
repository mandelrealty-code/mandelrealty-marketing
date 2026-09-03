import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { CallTimePicker } from "../components/CallTimePicker";
import { EMAIL, EMAIL_HREF, PHONE, PHONE_HREF, WHATSAPP_HREF } from "../lib/constants";
import { submitAuditLead } from "../lib/submitAuditLead";
import { formatCallSlotLabel } from "../../shared/callSlots";
import "./muskoka.css";

type PlanId = "full" | "growth" | "essentials" | "furniture";

const PAINS = [
  {
    n: "01",
    title: "Midnight messages during your own week at the lake",
    detail:
      "The hot tub, the gate code, the boat lift. Guests expect an answer in minutes, and Airbnb scores you on it.",
  },
  {
    n: "02",
    title: "Back-to-back Saturday turnovers on lake roads",
    detail:
      "Same-day check-out and check-in, forty minutes from town, with a cleaner who has three other cottages that morning.",
  },
  {
    n: "03",
    title: "Soft mid-weeks while the neighbours are full",
    detail:
      "June and September carry real demand in Muskoka — but only if the calendar and the rate move to meet it.",
  },
  {
    n: "04",
    title: "Set-and-forget pricing through the weekends that matter",
    detail:
      "Victoria Day, Canada Day, Civic, Thanksgiving, ski weeks — flat rates leave thousands on the table every season.",
  },
  {
    n: "05",
    title: "A listing that still looks like 2016 pine and plaid",
    detail:
      "Two bays over, glass-and-cedar photography is taking the summer bookings — and the summer rate.",
  },
] as const;

const CHAIN = [
  {
    step: "STEP 01",
    title: "Systems",
    detail:
      "Pricing rules, turnover schedule, restock lists, screening and a single calendar of record.",
    accent: false,
  },
  {
    step: "STEP 02",
    title: "Guest experience",
    detail:
      "Answered in minutes, arrival that works after an eight-hour drive, a cottage that photographs like it lives.",
    accent: false,
  },
  {
    step: "STEP 03",
    title: "Reviews",
    detail:
      "Review requests timed and worded, issues intercepted before they become a four-star.",
    accent: false,
  },
  {
    step: "STEP 04",
    title: "Visibility",
    detail:
      'Rating and response feed placement. Your listing surfaces for "Muskoka lakefront" searches, not page four.',
    accent: false,
  },
  {
    step: "STEP 05",
    title: "Bookings",
    detail:
      "Long weekends sold early at the right rate; mid-weeks and shoulders filled instead of discounted late.",
    accent: false,
  },
  {
    step: "STEP 06",
    title: "Money",
    detail:
      "One monthly report: revenue, occupancy, ADR, review trend, and what we are changing next month.",
    accent: true,
  },
] as const;

const SERVICES = [
  "Dynamic daily pricing",
  "Listing + photo optimization",
  "24/7 guest communication",
  "Cleaning & turnover coordination",
  "Inventory & restock",
  "Review & reputation",
  "Monthly performance reporting",
  "Guest ID & screening",
  "Furniture makeover (Standard / Full Service)",
  "Growth Partnership for hosts with history",
] as const;

const PLANS: { id: PlanId; label: string; meta: string }[] = [
  { id: "full", label: "Full Service / Standard", meta: "20% – 25% of revenue" },
  { id: "growth", label: "Growth Partnership", meta: "Performance-tied · history required" },
  { id: "essentials", label: "Managed Essentials", meta: "$199 or $349 / month" },
  { id: "furniture", label: "Furniture Investment", meta: "Pairs with Standard / Full Service" },
];

const TESTIMONIALS = [
  {
    quote:
      "I assumed a manager meant giving up a fifth of the revenue for nothing. First quarter with MRG came in meaningfully ahead of what I was doing alone, and I have not touched the calendar since April.",
    name: "Dan R. · Lake Muskoka, Port Carling",
    badge: "+40% REVENUE",
  },
  {
    quote:
      "Guests used to wait until morning for an answer. Now they get one in minutes, at 11pm, from someone who knows which key opens the boathouse. We went from 4.6 to 4.9 in one summer.",
    name: "Priya M. · Lake of Bays, Dwight",
    badge: "4.9★",
  },
  {
    quote:
      "Three cottages on two lakes, one cleaner shared between them. MRG untangled the schedule and sends one report a month I can actually read. My accountant is happier than I am.",
    name: "Marc & Ellen T. · Gravenhurst + Bracebridge",
    badge: "3 COTTAGES",
  },
  {
    quote:
      "Civic weekend used to be four turnovers and a fight with the cleaning schedule. This year I spent it on the dock with my kids and found out afterwards it was our best week ever.",
    name: "Sarah K. · Huntsville, Peninsula Lake",
    badge: "HANDS-OFF SUMMERS",
  },
] as const;

const FAQ = [
  {
    q: "What does it cost — percentage or fixed?",
    a: "Both exist. Full Service / Standard management runs 20–25% of gross booking revenue — you pay only when the cottage earns. Managed Essentials is fixed at $199 or $349 a month and you keep cleaning and on-site work. Growth Partnership ties our fee to growth above a benchmark. HST applies to fees on every plan.",
  },
  {
    q: "Are you actually in Muskoka, or managing from Toronto?",
    a: "Both, deliberately. We are Toronto-based and run always-on virtual operations — messaging, pricing, screening, reporting — with local execution where it has to be local: cleaners, linen, handyman, snow, water and dock help, coordinated on the ground at your lake.",
  },
  {
    q: "My cottage has never been rented. Can you still take it?",
    a: "Yes — Full Service / Standard or Managed Essentials both work from a standing start, including the launch: photography, listing build, pricing strategy, house manual. Growth Partnership is the exception; it needs an existing live listing with booking history so we can set an honest Benchmark Revenue.",
  },
  {
    q: "How fast can we onboard?",
    a: "An existing listing can move onto our systems in days — access, pricing rules, messaging and the turnover calendar first, then optimization. A new launch depends on photography and the makeover scope, and we will give you a dated plan on the call rather than a promise here.",
  },
  {
    q: "Do you cover Bracebridge, Gravenhurst, Huntsville, Port Carling?",
    a: "Yes. Muskoka cottages are an active focus: Bracebridge, Gravenhurst, Huntsville, Lake of Bays, Port Carling and the surrounding lakes. MRG also manages properties across Canada and the US, so seasonal playbooks come from more than one market.",
  },
  {
    q: "Who pays cleaning, maintenance, insurance and taxes?",
    a: "Cleaning is charged to guests and coordinated by us on Full Service / Standard; on Managed Essentials you keep your own cleaner and schedule. Insurance, property taxes, utilities and repairs stay with the owner on every plan unless we agree otherwise in writing. Our fees exclude cleaning and other pass-throughs.",
  },
  {
    q: "Can I get the furniture makeover on any plan?",
    a: "No. The Furniture Investment Program pairs with Standard (~20%) or Full Service (~25%) only — those are the plans where we control the guest experience end to end. It is not available with Growth Partnership or Managed Essentials.",
  },
] as const;

const EARNINGS_OPTIONS = [
  { value: "Not rented yet", label: "Not rented yet" },
  { value: "Under $3,000 / month", label: "Under $3,000 / month" },
  { value: "$3,000 – $6,000 / month", label: "$3,000 – $6,000 / month" },
  { value: "$6,000 – $10,000 / month", label: "$6,000 – $10,000 / month" },
  { value: "$10,000 – $20,000 / month", label: "$10,000 – $20,000 / month" },
  { value: "$20,000+ / month", label: "$20,000+ / month" },
] as const;

const NAV = [
  { href: "#pains", label: "The reality" },
  { href: "#how", label: "How it works" },
  { href: "#plans", label: "Plans" },
  { href: "#proof", label: "Proof" },
  { href: "#faq", label: "FAQ" },
] as const;

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.76, delay, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

function PlanDetail({ plan }: { plan: PlanId }) {
  if (plan === "full") {
    return (
      <div className="flex flex-col gap-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
          <div className="flex max-w-xl flex-col gap-2.5">
            <h3 className="mk-serif m-0 text-[28px] leading-tight text-[var(--mk-paper)] sm:text-[34px]">
              Full Service / Standard management
            </h3>
            <p className="m-0 text-[15px] font-light leading-relaxed text-[var(--mk-soft)] sm:text-base">
              Hands-off hosting. We run the cottage as a business and you get a monthly report and a
              deposit.
            </p>
          </div>
          <div className="shrink-0 sm:text-right">
            <div className="mk-serif text-[42px] leading-none text-[var(--mk-lake)] sm:text-[46px]">
              20–25%
            </div>
            <div className="mk-mono mt-2 text-[11px] uppercase tracking-[0.12em] text-[var(--mk-quiet)]">
              of gross revenue
            </div>
          </div>
        </div>
        <div className="grid gap-x-10 gap-y-0 sm:grid-cols-2">
          {[
            "24/7 guest messaging",
            "Cleaning & turnover coordination",
            "Dynamic daily pricing",
            "Inventory & restock",
            "Listing optimization & photo direction",
            "Review protection & reputation",
            "Guest ID & screening",
            "Monthly performance reporting",
          ].map((item) => (
            <span
              key={item}
              className="border-t border-white/10 py-2.5 text-[15px] font-light text-[var(--mk-soft)]"
            >
              {item}
            </span>
          ))}
        </div>
        <div className="rounded-xl border border-[oklch(0.83_0.098_78/0.22)] bg-[oklch(0.83_0.098_78/0.09)] px-5 py-4">
          <span className="text-[14.5px] font-light leading-relaxed text-[oklch(0.9_0.03_78)]">
            Furniture Investment Program can pair with Standard (~20%) or Full Service (~25%) only.
          </span>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <a
            href="#fit"
            className="mk-btn-primary inline-flex items-center justify-center rounded-[11px] px-6 py-3.5 text-[14.5px]"
          >
            Book a free 15-minute call
          </a>
          <span className="mk-mono text-[11px] uppercase tracking-[0.1em] text-[var(--mk-quiet)]">
            New or existing listings · HST on fees
          </span>
        </div>
      </div>
    );
  }

  if (plan === "growth") {
    return (
      <div className="flex flex-col gap-7">
        <div className="flex flex-col gap-2.5">
          <h3 className="mk-serif m-0 text-[28px] leading-tight text-[var(--mk-paper)] sm:text-[34px]">
            Growth Partnership
          </h3>
          <p className="m-0 max-w-xl text-[15px] font-light leading-relaxed text-[var(--mk-soft)] sm:text-base">
            For cottages already live with booking history. We agree on your monthly Benchmark
            Revenue, charge a low fee up to it, and a larger fee only on what we add above it.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { name: "Aligned Growth", low: "10%", high: "35%" },
            { name: "Confidence Partner", low: "5%", high: "45%" },
          ].map((tier) => (
            <div
              key={tier.name}
              className="flex flex-col gap-4 rounded-2xl border border-white/[0.13] bg-white/[0.06] p-6"
            >
              <span className="text-xl text-[var(--mk-paper)]">{tier.name}</span>
              <div className="flex items-baseline gap-2.5">
                <span className="mk-serif text-4xl text-[var(--mk-lake)]">{tier.low}</span>
                <span className="text-[13.5px] font-light text-[var(--mk-soft)]">up to benchmark</span>
              </div>
              <div className="flex items-baseline gap-2.5">
                <span className="mk-serif text-4xl text-[var(--mk-paper)]">{tier.high}</span>
                <span className="text-[13.5px] font-light text-[var(--mk-soft)]">
                  on revenue above it
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col">
          {[
            "Gross booking revenue = nightly + upsells. Cleaning and pass-throughs excluded.",
            "Requires an existing live listing with booking history to set the benchmark.",
            "HST applies to fees. Furniture Investment is not available with Growth.",
          ].map((line) => (
            <span
              key={line}
              className="border-t border-white/10 py-2.5 text-[15px] font-light text-[var(--mk-soft)]"
            >
              {line}
            </span>
          ))}
        </div>
        <a
          href="#fit"
          className="mk-btn-primary inline-flex w-fit items-center justify-center rounded-[11px] px-6 py-3.5 text-[14.5px]"
        >
          Set my benchmark on a call
        </a>
      </div>
    );
  }

  if (plan === "essentials") {
    return (
      <div className="flex flex-col gap-7">
        <div className="flex flex-col gap-2.5">
          <h3 className="mk-serif m-0 text-[28px] leading-tight text-[var(--mk-paper)] sm:text-[34px]">
            Managed Essentials
          </h3>
          <p className="m-0 max-w-xl text-[15px] font-light leading-relaxed text-[var(--mk-soft)] sm:text-base">
            Fixed monthly, no revenue share. You keep your cleaner and your on-lake logistics; we
            take the inbox and the calendar.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-3.5 rounded-2xl border border-white/[0.13] bg-white/[0.06] p-6">
            <span className="text-xl text-[var(--mk-paper)]">Message &amp; Book</span>
            <div className="flex items-baseline gap-2">
              <span className="mk-serif text-[42px] text-[var(--mk-lake)]">$199</span>
              <span className="text-[13.5px] font-light text-[var(--mk-soft)]">/ month</span>
            </div>
            {[
              "AI + VA guest messaging",
              "Booking confirmations",
              "Guest ID / screening",
              "Review requests",
              "Monthly snapshot",
            ].map((item) => (
              <span
                key={item}
                className="border-t border-white/[0.09] pt-2.5 text-[14.5px] font-light text-[var(--mk-soft)]"
              >
                {item}
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-3.5 rounded-2xl border border-[oklch(0.83_0.098_78/0.28)] bg-[oklch(0.83_0.098_78/0.08)] p-6">
            <span className="text-xl text-[var(--mk-paper)]">Message &amp; Optimize</span>
            <div className="flex items-baseline gap-2">
              <span className="mk-serif text-[42px] text-[var(--mk-lake)]">$349</span>
              <span className="text-[13.5px] font-light text-[var(--mk-soft)]">/ month</span>
            </div>
            {[
              "Everything in Message & Book",
              "Dynamic pricing",
              "Scheduled listing / photo optimization",
              "Monthly next-steps report",
            ].map((item) => (
              <span
                key={item}
                className="border-t border-white/[0.09] pt-2.5 text-[14.5px] font-light text-[var(--mk-soft)]"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col">
          {[
            "HST extra. Owner keeps cleaning, maintenance and on-site logistics.",
            "Optional Klarna 12-month path, about 5% off — no refunds on that path.",
          ].map((line) => (
            <span
              key={line}
              className="border-t border-white/10 py-2.5 text-[15px] font-light text-[var(--mk-soft)]"
            >
              {line}
            </span>
          ))}
        </div>
        <a
          href="#fit"
          className="mk-btn-primary inline-flex w-fit items-center justify-center rounded-[11px] px-6 py-3.5 text-[14.5px]"
        >
          Start with Essentials
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2.5">
        <h3 className="mk-serif m-0 text-[28px] leading-tight text-[var(--mk-paper)] sm:text-[34px]">
          Furniture Investment / cottage makeover
        </h3>
        <p className="m-0 max-w-xl text-[15px] font-light leading-relaxed text-[var(--mk-soft)] sm:text-base">
          A tired interior caps your nightly rate long before your lake does. We invest in the
          makeover so the listing can earn what the shoreline is worth — then re-shoot it and take
          it back to market.
        </p>
      </div>
      <div className="grid gap-x-10 sm:grid-cols-2">
        {[
          "Room-by-room plan for the spaces guests book on",
          "Sourcing, delivery and install coordinated",
          "Durable, cottage-appropriate spec — not showroom-only",
          "New photography and a rewritten listing after install",
        ].map((item) => (
          <span
            key={item}
            className="border-t border-white/10 py-2.5 text-[15px] font-light text-[var(--mk-soft)]"
          >
            {item}
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-2 rounded-xl border border-[oklch(0.83_0.098_78/0.22)] bg-[oklch(0.83_0.098_78/0.09)] px-5 py-4">
        <span className="text-[14.5px] font-normal text-[oklch(0.92_0.03_78)]">Pairing rules</span>
        <span className="text-[14.5px] font-light leading-relaxed text-[oklch(0.88_0.02_78)]">
          Available with Standard (~20%) or Full Service (~25%) only. Not available with Growth
          Partnership or Managed Essentials.
        </span>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <a
          href="#fit"
          className="mk-btn-primary inline-flex items-center justify-center rounded-[11px] px-6 py-3.5 text-[14.5px]"
        >
          Ask about a makeover
        </a>
        <span className="mk-mono text-[11px] uppercase tracking-[0.1em] text-[var(--mk-quiet)]">
          Scope agreed before anything is ordered
        </span>
      </div>
    </div>
  );
}

export function MuskokaLandingPage() {
  const [plan, setPlan] = useState<PlanId>("full");
  const [faqOpen, setFaqOpen] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [leadName, setLeadName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callStartIso, setCallStartIso] = useState("");
  const [consent, setConsent] = useState(false);
  const reduce = useReducedMotion();

  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 700], [0, reduce ? 0 : 126]);

  useEffect(() => {
    document.title = "Muskoka Cottage Management | Mandel Realty Group";
    const desc = document.querySelector('meta[name="description"]');
    if (desc) {
      desc.setAttribute(
        "content",
        "Muskoka cottage & short-term rental management by Mandel Realty Group. Dynamic pricing, turnovers, and 5-star guest ops for Bracebridge, Gravenhurst, Huntsville, Lake of Bays & Port Carling. Call (647) 381-7325.",
      );
    }
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      canonical.setAttribute("href", "https://www.mandelrealtygroup.com/muskoka");
    }
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!consent) {
      setError("Please confirm we can contact you about managing your cottage.");
      return;
    }
    if (!callStartIso) {
      setError("Please pick a call time.");
      return;
    }

    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const email = String(fd.get("email") ?? "").trim();
    const phone = String(fd.get("phone") ?? "").trim();
    const address = String(fd.get("area") ?? "").trim();
    const earnings = String(fd.get("earnings") ?? "").trim();
    const listing = String(fd.get("listing") ?? "").trim();

    setSubmitting(true);
    try {
      await submitAuditLead({
        name,
        email,
        phone,
        address,
        earnings,
        listingTitle: listing || undefined,
        hasListing: earnings === "Not rented yet" ? "no" : "yes",
        callBooking: formatCallSlotLabel(callStartIso),
        callStartIso,
        source: "muskoka-landing",
        contactConsent: true,
        marketingOptIn: false,
      });
      setLeadName(name.split(" ")[0] || name);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please call us.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="muskoka-page relative">
      <div className="muskoka-atmosphere" aria-hidden />

      <div className="relative z-[1] mx-auto w-full max-w-[1280px]">
        {/* NAV */}
        <header className="mk-glass-nav sticky top-0 z-40 px-5 py-3.5 sm:px-10">
          <div className="flex items-center justify-between gap-4">
            <a href="/muskoka" className="flex items-center gap-2.5 no-underline sm:gap-3">
              <img
                src="/mrg-logo-white.png"
                alt=""
                aria-hidden
                className="h-7 w-7 shrink-0 rounded-[3px] object-contain sm:h-8 sm:w-8"
              />
              <span className="flex items-baseline gap-2.5 sm:gap-3">
                <span className="text-[11px] font-light uppercase tracking-[0.22em] text-[var(--mk-paper)] sm:text-[13px] sm:tracking-[0.3em]">
                  Mandel Realty Group
                </span>
                <span className="hidden h-3.5 w-px bg-white/20 sm:inline-block" aria-hidden />
                <span className="mk-serif hidden text-lg italic text-[var(--mk-lake)] sm:inline">
                  Muskoka
                </span>
              </span>
            </a>

            <nav className="hidden items-center gap-7 lg:flex">
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="text-[13.5px] font-light text-[oklch(0.85_0.012_215)] no-underline transition-colors hover:text-[var(--mk-paper)]"
                >
                  {item.label}
                </a>
              ))}
              <div className="flex items-center gap-2.5">
                <a
                  href={PHONE_HREF}
                  className="mk-btn-ghost rounded-[10px] px-4 py-2.5 text-[13.5px] no-underline"
                >
                  {PHONE}
                </a>
                <a
                  href="#fit"
                  className="mk-btn-primary rounded-[10px] px-[18px] py-2.5 text-[13.5px] no-underline"
                >
                  Book a call
                </a>
              </div>
            </nav>

            <div className="flex items-center gap-2 lg:hidden">
              <a
                href="#fit"
                className="mk-btn-primary rounded-lg px-3 py-2 text-xs no-underline sm:text-[13px]"
              >
                Book
              </a>
              <button
                type="button"
                aria-expanded={menuOpen}
                aria-label="Menu"
                onClick={() => setMenuOpen((v) => !v)}
                className="rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-xs text-[var(--mk-paper)]"
              >
                {menuOpen ? "Close" : "Menu"}
              </button>
            </div>
          </div>
          {menuOpen && (
            <div className="mt-3 flex flex-col gap-1 border-t border-white/10 pt-3 lg:hidden">
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-2 py-2.5 text-sm font-light text-[var(--mk-soft)] no-underline"
                >
                  {item.label}
                </a>
              ))}
              <a
                href={PHONE_HREF}
                className="rounded-lg px-2 py-2.5 text-sm font-light text-[var(--mk-lake)] no-underline"
              >
                Call {PHONE}
              </a>
            </div>
          )}
        </header>

        {/* HERO */}
        <section className="relative h-[min(100dvh,820px)] min-h-[560px] overflow-hidden">
          <motion.div
            style={{ y: heroY }}
            className="absolute inset-[-6%_-2%] z-0 will-change-transform"
          >
            <div className={`h-full w-full ${reduce ? "" : "mk-drift"}`}>
              <img
                src="/muskoka/hero-lakeside.jpg"
                alt="Modern Muskoka cottage on the water at golden hour"
                className="mk-photo"
                fetchPriority="high"
              />
            </div>
          </motion.div>
          <div
            className="pointer-events-none absolute inset-0 z-[1]"
            style={{
              background:
                "linear-gradient(100deg, oklch(0.14 0.02 228 / 0.88) 0%, oklch(0.15 0.02 225 / 0.62) 42%, oklch(0.18 0.03 210 / 0.25) 72%, oklch(0.2 0.04 200 / 0.1) 100%)",
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 z-[1]"
            style={{
              background:
                "linear-gradient(180deg, oklch(0.13 0.02 228 / 0.55) 0%, transparent 26%, transparent 55%, oklch(0.16 0.02 224 / 0.92) 100%)",
            }}
          />
          <div className="relative z-[2] flex h-full flex-col justify-end px-5 pb-16 sm:px-10 sm:pb-24">
            <div className="flex max-w-[800px] flex-col gap-6 sm:gap-7">
              <Reveal>
                <div className="flex flex-col gap-2 sm:gap-3">
                  <span className="mk-serif text-base italic tracking-wide text-[var(--mk-lake)] sm:text-xl">
                    Muskoka cottage &amp; short-term rental management
                  </span>
                  <span className="text-[22px] font-extralight uppercase leading-tight tracking-[0.18em] text-[var(--mk-paper)] sm:text-[40px] sm:tracking-[0.22em]">
                    Mandel
                    <br />
                    Realty Group
                  </span>
                </div>
              </Reveal>
              <Reveal delay={0.07}>
                <div className="h-px w-16 bg-gradient-to-r from-[var(--mk-lake)] to-transparent sm:w-24" />
              </Reveal>
              <Reveal delay={0.12}>
                <h1 className="mk-serif m-0 text-[34px] leading-[1.05] tracking-[-0.015em] text-[var(--mk-paper)] text-pretty sm:text-[52px] lg:text-[68px]">
                  Cottages managed like a business — without you living in the inbox.
                </h1>
              </Reveal>
              <Reveal delay={0.18}>
                <p className="m-0 max-w-[620px] text-[15px] font-light leading-relaxed text-[var(--mk-soft)] sm:text-[18.5px]">
                  Dynamic pricing, turnovers and 5-star guest ops for lake country — so summer
                  weekends, shoulder Saturdays and winter stays all actually pay.
                </p>
              </Reveal>
              <Reveal delay={0.24}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <a
                    href="#fit"
                    className="mk-btn-primary inline-flex items-center justify-center rounded-xl px-7 py-4 text-[15px] no-underline"
                  >
                    Book a free 15-minute call
                  </a>
                  <a
                    href={PHONE_HREF}
                    className="mk-btn-ghost inline-flex items-center justify-center rounded-xl px-6 py-4 text-[15px] no-underline"
                  >
                    Call ({PHONE})
                  </a>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* SERVING */}
        <div className="flex flex-col gap-2 border-y border-white/[0.09] bg-white/[0.045] px-5 py-4 backdrop-blur-[18px] sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-10 sm:py-5">
          <span className="mk-mono text-[10px] uppercase leading-relaxed tracking-[0.14em] text-[oklch(0.78_0.02_210)] sm:text-[11.5px] sm:tracking-[0.16em]">
            Serving Bracebridge · Gravenhurst · Huntsville · Lake of Bays · Port Carling
          </span>
          <span className="mk-mono text-[10px] uppercase tracking-[0.14em] text-[var(--mk-quiet)] sm:text-[11.5px]">
            Toronto-based · Canada + US portfolios
          </span>
        </div>

        {/* PAINS */}
        <section id="pains" className="scroll-mt-24 px-5 py-16 sm:px-10 sm:py-[110px]">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,430px)_1fr] lg:gap-[72px]">
            <Reveal className="flex flex-col gap-5 lg:sticky lg:top-28 lg:self-start">
              <span className="mk-mono text-[11px] uppercase tracking-[0.18em] text-[var(--mk-lake)] sm:text-[11.5px]">
                01 — Cottage country reality
              </span>
              <h2 className="mk-serif m-0 text-[32px] leading-[1.08] text-[var(--mk-paper)] sm:text-[46px]">
                The lake is the easy part.
              </h2>
              <p className="m-0 text-[15px] font-light leading-relaxed text-[var(--mk-soft)] sm:text-[16.5px]">
                Muskoka rents at some of the highest nightly rates in Ontario — and asks the most in
                return. High season is eleven weeks long, the shoulders are unforgiving, and every
                one of them runs through your phone.
              </p>
            </Reveal>
            <div className="flex flex-col">
              {PAINS.map((p, i) => (
                <Reveal
                  key={p.n}
                  delay={0.05 * i}
                  className={`grid grid-cols-[36px_1fr] gap-4 border-t border-white/10 py-5 sm:grid-cols-[40px_1fr] sm:gap-6 sm:py-6 ${
                    i === PAINS.length - 1 ? "border-b" : ""
                  }`}
                >
                  <span className="mk-mono pt-1 text-xs text-[oklch(0.62_0.02_210)]">{p.n}</span>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-lg text-[var(--mk-paper)] sm:text-[21px]">{p.title}</span>
                    <span className="text-sm font-light leading-relaxed text-[var(--mk-muted)] sm:text-[15.5px]">
                      {p.detail}
                    </span>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* HOW */}
        <section id="how" className="scroll-mt-24 px-5 pb-16 sm:px-10 sm:pb-[120px]">
          <Reveal className="mb-10 flex max-w-[720px] flex-col gap-4 sm:mb-16 sm:gap-[18px]">
            <span className="mk-mono text-[11px] uppercase tracking-[0.18em] text-[var(--mk-lake)] sm:text-[11.5px]">
              02 — How MRG works
            </span>
            <h2 className="mk-serif m-0 text-[32px] leading-[1.08] text-[var(--mk-paper)] sm:text-[46px]">
              One chain, run properly, every week of the year.
            </h2>
            <p className="m-0 text-[15px] font-light leading-relaxed text-[var(--mk-soft)] sm:text-[16.5px]">
              Nothing exotic. Systems produce a better stay, better stays produce reviews, reviews
              buy visibility, visibility fills the calendar — and a full calendar priced correctly
              is the money.
            </p>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="mk-glass-panel overflow-hidden rounded-[20px]">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {CHAIN.map((c, i) => (
                  <div
                    key={c.step}
                    className={`flex flex-col gap-3.5 border-white/[0.09] p-6 sm:p-7 ${
                      i < CHAIN.length - 1 ? "border-b xl:border-b-0 xl:border-r" : ""
                    } ${c.accent ? "bg-[oklch(0.83_0.098_78/0.1)]" : ""} ${
                      i % 2 === 0 && i < 4 ? "sm:border-r" : ""
                    }`}
                  >
                    <span
                      className={`mk-mono text-[11px] tracking-[0.14em] ${
                        c.accent ? "text-[oklch(0.86_0.1_78)]" : "text-[var(--mk-lake)]"
                      }`}
                    >
                      {c.step}
                    </span>
                    <span className="mk-serif text-2xl text-[var(--mk-paper)]">{c.title}</span>
                    <span className="text-sm font-light leading-relaxed text-[var(--mk-muted)]">
                      {c.detail}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.12} className="mt-8 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-5">
            {SERVICES.map((s) => (
              <span
                key={s}
                className="border-t border-white/[0.09] py-3 text-[14.5px] font-light text-[var(--mk-soft)]"
              >
                {s}
              </span>
            ))}
          </Reveal>
        </section>

        {/* GALLERY */}
        <section id="gallery" className="scroll-mt-24 pb-16 sm:pb-[120px]">
          <Reveal className="mb-8 flex flex-col gap-6 px-5 sm:mb-9 sm:flex-row sm:items-end sm:justify-between sm:px-10">
            <div className="flex max-w-[640px] flex-col gap-4 sm:gap-[18px]">
              <span className="mk-mono text-[11px] uppercase tracking-[0.18em] text-[var(--mk-lake)] sm:text-[11.5px]">
                03 — What guests book
              </span>
              <h2 className="mk-serif m-0 text-[32px] leading-[1.08] text-[var(--mk-paper)] sm:text-[46px]">
                Cottages we run, photographed the way they rent.
              </h2>
            </div>
            <p className="m-0 max-w-[340px] text-[14.5px] font-light leading-relaxed text-[var(--mk-soft)] sm:text-[15.5px]">
              Every listing we take on gets re-shot, re-sequenced and re-written before its first
              night on market.
            </p>
          </Reveal>

          <div className="relative h-[280px] w-full sm:h-[420px] lg:h-[560px]">
            <img
              src="/muskoka/great-room.jpg"
              alt="Open great room with lake glass"
              className="mk-photo"
              loading="lazy"
            />
          </div>
          <div className="mt-3 flex items-center justify-between px-5 sm:px-10">
            <span className="mk-mono text-[10px] uppercase tracking-[0.14em] text-[var(--mk-quiet)] sm:text-[11px]">
              Great room · Lake of Bays
            </span>
            <span className="mk-mono text-[10px] uppercase tracking-[0.14em] text-[var(--mk-quiet)] sm:text-[11px]">
              Sleeps 10 · 4 br · dock
            </span>
          </div>

          <div className="mt-8 grid gap-5 px-5 sm:mt-10 sm:grid-cols-[1.35fr_1fr] sm:gap-5 sm:px-10">
            <div className="flex flex-col gap-3">
              <div className="relative h-[240px] overflow-hidden rounded-[18px] sm:h-[420px]">
                <img
                  src="/muskoka/dock-sunset.jpg"
                  alt="Private dock at sunset"
                  className="mk-photo"
                  loading="lazy"
                />
              </div>
              <span className="mk-mono text-[10px] uppercase tracking-[0.14em] text-[var(--mk-quiet)] sm:text-[11px]">
                Private dock · Port Carling
              </span>
            </div>
            <div className="grid gap-5 sm:grid-rows-2">
              <div className="flex flex-col gap-3">
                <div className="relative h-[200px] overflow-hidden rounded-[18px] sm:h-[194px]">
                  <img
                    src="/muskoka/kitchen-dining.jpg"
                    alt="Kitchen and dining opening to the lake"
                    className="mk-photo"
                    loading="lazy"
                  />
                </div>
                <span className="mk-mono text-[10px] uppercase tracking-[0.14em] text-[var(--mk-quiet)] sm:text-[11px]">
                  Kitchen &amp; dining
                </span>
              </div>
              <div className="flex flex-col gap-3">
                <div className="relative h-[200px] overflow-hidden rounded-[18px] sm:h-[194px]">
                  <img
                    src="/muskoka/primary-suite.jpg"
                    alt="Primary bedroom with water view"
                    className="mk-photo"
                    loading="lazy"
                  />
                </div>
                <span className="mk-mono text-[10px] uppercase tracking-[0.14em] text-[var(--mk-quiet)] sm:text-[11px]">
                  Primary suite
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-5 px-5 sm:grid-cols-3 sm:px-10">
            {[
              { src: "/muskoka/boathouse.jpg", alt: "Muskoka boathouse", cap: "Boathouse · Gravenhurst" },
              {
                src: "/muskoka/firepit-evening.jpg",
                alt: "Evening firepit by the lake",
                cap: "Evening shoreline",
              },
              {
                src: "/muskoka/winter-cottage.jpg",
                alt: "Winter Muskoka cottage",
                cap: "February · still booked",
              },
            ].map((img) => (
              <div key={img.src} className="flex flex-col gap-3">
                <div className="relative h-[200px] overflow-hidden rounded-[18px] sm:h-[250px]">
                  <img src={img.src} alt={img.alt} className="mk-photo" loading="lazy" />
                </div>
                <span className="mk-mono text-[10px] uppercase tracking-[0.14em] text-[var(--mk-quiet)] sm:text-[11px]">
                  {img.cap}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* PLANS */}
        <section id="plans" className="scroll-mt-24 px-5 pb-16 sm:px-10 sm:pb-[120px]">
          <Reveal className="mb-8 flex max-w-[700px] flex-col gap-4 sm:mb-10 sm:gap-[18px]">
            <span className="mk-mono text-[11px] uppercase tracking-[0.18em] text-[var(--mk-lake)] sm:text-[11.5px]">
              04 — What we offer
            </span>
            <h2 className="mk-serif m-0 text-[32px] leading-[1.08] text-[var(--mk-paper)] sm:text-[46px]">
              Four ways to work with us.
            </h2>
            <p className="m-0 text-[15px] font-light leading-relaxed text-[var(--mk-soft)] sm:text-[16.5px]">
              Pick the one that matches how much you want to keep. All fees are on gross booking
              revenue — nightly plus upsells, excluding cleaning and pass-throughs. HST applies to
              fees.
            </p>
          </Reveal>

          <div className="grid gap-5 lg:grid-cols-[300px_1fr] xl:grid-cols-[340px_1fr]">
            <div className="flex flex-col gap-2.5">
              {PLANS.map((p) => {
                const active = plan === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlan(p.id)}
                    className={`mk-glass-tile relative cursor-pointer rounded-2xl px-[22px] py-5 text-left transition-colors ${
                      active ? "bg-white/[0.09]" : "hover:bg-white/[0.09]"
                    }`}
                  >
                    {active && (
                      <span className="absolute top-[18px] bottom-[18px] left-0 w-[3px] rounded-r-[3px] bg-[var(--mk-lake)]" />
                    )}
                    <span className="block text-[17px] text-[var(--mk-paper)] sm:text-[17.5px]">
                      {p.label}
                    </span>
                    <span className="mk-mono mt-1.5 block text-[11px] tracking-[0.1em] text-[oklch(0.8_0.05_78)] sm:text-[11.5px]">
                      {p.meta}
                    </span>
                  </button>
                );
              })}
              <p className="m-0 mt-2 px-1 text-[13px] font-light leading-relaxed text-[oklch(0.72_0.014_215)]">
                Not sure which fits? The 15-minute call ends with a recommendation, not a pitch.
              </p>
            </div>

            <div className="mk-glass-feature min-h-[420px] rounded-[20px] p-6 sm:p-10">
              <PlanDetail plan={plan} />
            </div>
          </div>
        </section>

        {/* PROOF */}
        <section id="proof" className="scroll-mt-24 px-5 pb-16 sm:px-10 sm:pb-[120px]">
          <Reveal>
            <div className="mk-glass-feature grid gap-10 rounded-3xl p-6 sm:gap-14 sm:p-12 lg:grid-cols-[1fr_1.1fr]">
              <div className="flex flex-col gap-5">
                <span className="mk-mono text-[11px] uppercase tracking-[0.18em] text-[var(--mk-lake)] sm:text-[11.5px]">
                  05 — Proof of systems
                </span>
                <h2 className="mk-serif m-0 text-[30px] leading-[1.08] text-[var(--mk-paper)] sm:text-[42px]">
                  Same unit. Same building. Different operator.
                </h2>
                <p className="m-0 text-[15px] font-light leading-relaxed text-[var(--mk-soft)] sm:text-base">
                  A Toronto client came to us after a full year of self-managing. We kept the
                  property and changed the operating system: pricing, photography, listing copy,
                  response times, review flow.
                </p>
                <div className="mt-1 flex flex-col gap-6 sm:flex-row sm:items-end sm:gap-10">
                  <div className="flex flex-col gap-2">
                    <span className="mk-mono text-[10px] uppercase tracking-[0.14em] text-[var(--mk-quiet)] sm:text-[10.5px]">
                      Full year 2025 · before MRG
                    </span>
                    <span className="mk-serif text-[36px] leading-none text-[var(--mk-soft)] sm:text-[44px]">
                      $26,995
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="mk-mono text-[10px] uppercase tracking-[0.14em] text-[var(--mk-lake)] sm:text-[10.5px]">
                      May–Aug 2026 · with MRG
                    </span>
                    <span className="mk-serif text-[48px] leading-none text-[var(--mk-lake)] sm:text-[56px]">
                      $33,713
                    </span>
                  </div>
                </div>
                <p className="m-0 text-[15px] font-light leading-relaxed text-[var(--mk-soft)]">
                  Four months beat the entire previous year —{" "}
                  <strong className="font-medium text-[var(--mk-paper)]">
                    +159% against the same months
                  </strong>{" "}
                  a year earlier.
                </p>
                <span className="mk-mono text-[11px] leading-relaxed tracking-[0.06em] text-[oklch(0.68_0.02_210)]">
                  Verified Airbnb host dashboard · Toronto client. Same playbook we run for Muskoka
                  cottages — we don&apos;t publish Muskoka dashboards we haven&apos;t earned yet.
                </span>
              </div>

              <div className="flex flex-col gap-4">
                <span className="mk-mono text-[10px] uppercase tracking-[0.14em] text-[oklch(0.72_0.02_210)] sm:text-[10.5px]">
                  Change vs same month, prior year
                </span>
                <div className="grid min-h-[220px] flex-1 grid-cols-2 items-end gap-4 sm:min-h-[300px] sm:grid-cols-4 sm:gap-5">
                  {[
                    { label: "MAY", value: "+99%", h: "65%" },
                    { label: "JUNE · FROM $0", value: "$8,755", h: "88%" },
                    { label: "JULY", value: "+90%", h: "58%" },
                    { label: "AUGUST", value: "+91%", h: "60%" },
                  ].map((bar) => (
                    <div key={bar.label} className="flex h-full flex-col items-center gap-3">
                      <span className="mk-serif text-xl text-[var(--mk-lake)] sm:text-[30px]">
                        {bar.value}
                      </span>
                      <div
                        className={`mk-sheen mt-auto w-full rounded-t-[10px] bg-gradient-to-b from-[oklch(0.83_0.098_78/0.9)] to-[oklch(0.83_0.098_78/0.12)]`}
                        style={{ height: bar.h, minHeight: 80 }}
                      />
                      <span className="mk-mono text-center text-[10px] tracking-[0.14em] text-[oklch(0.78_0.02_210)] sm:text-[11px]">
                        {bar.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* TESTIMONIALS */}
        <section id="voices" className="scroll-mt-24 px-5 pb-16 sm:px-10 sm:pb-[120px]">
          <Reveal className="mb-10 flex max-w-[660px] flex-col gap-4 sm:mb-12 sm:gap-[18px]">
            <span className="mk-mono text-[11px] uppercase tracking-[0.18em] text-[var(--mk-lake)] sm:text-[11.5px]">
              06 — Owners
            </span>
            <h2 className="mk-serif m-0 text-[32px] leading-[1.08] text-[var(--mk-paper)] sm:text-[46px]">
              What cottage owners say after a season.
            </h2>
          </Reveal>
          <div className="grid gap-0 sm:grid-cols-2 sm:gap-x-16">
            {TESTIMONIALS.map((t, i) => (
              <Reveal
                key={t.name}
                delay={0.05 * i}
                className={`flex flex-col gap-[18px] border-t border-white/[0.11] py-8 ${
                  i >= 2 ? "border-b" : ""
                } ${i === 1 ? "sm:border-b-0" : ""} ${i === TESTIMONIALS.length - 1 ? "border-b" : ""}`}
              >
                <p className="mk-serif m-0 text-[22px] leading-[1.4] text-[var(--mk-paper)] text-pretty sm:text-[25px]">
                  “{t.quote}”
                </p>
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                  <span className="text-[14.5px] text-[oklch(0.9_0.012_215)]">{t.name}</span>
                  <span className="mk-mono rounded-[7px] border border-[oklch(0.83_0.098_78/0.28)] bg-[oklch(0.83_0.098_78/0.14)] px-2.5 py-1.5 text-[10px] tracking-[0.12em] text-[oklch(0.88_0.06_78)] sm:text-[10.5px]">
                    {t.badge}
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* CAPACITY */}
        <section className="px-5 pb-16 sm:px-10 sm:pb-[120px]">
          <Reveal>
            <div className="mk-glass-panel grid items-center gap-8 rounded-3xl p-7 sm:gap-14 sm:p-[54px_48px] lg:grid-cols-2">
              <div className="flex flex-col gap-[18px]">
                <span className="mk-mono text-[11px] uppercase tracking-[0.18em] text-[var(--mk-lake)] sm:text-[11.5px]">
                  07 — Boutique capacity
                </span>
                <h2 className="mk-serif m-0 text-[30px] leading-[1.08] text-[var(--mk-paper)] sm:text-[42px]">
                  We partner with about twenty listings at a time.
                </h2>
              </div>
              <div className="flex flex-col gap-[22px]">
                <p className="m-0 text-[15px] font-light leading-relaxed text-[var(--mk-soft)] sm:text-[16.5px]">
                  Not a franchise, not a call centre. Twenty is the number where every owner still
                  gets a named operator, a weekly eye on their calendar and a real conversation each
                  month. A small number of Muskoka spots open ahead of next season — when they are
                  taken, the list is closed until one frees up.
                </p>
                <a
                  href="#fit"
                  className="inline-flex w-fit items-center justify-center rounded-[11px] border border-[oklch(0.83_0.098_78/0.45)] bg-[oklch(0.83_0.098_78/0.12)] px-6 py-3.5 text-[14.5px] font-medium text-[oklch(0.9_0.06_78)] no-underline transition-colors hover:bg-[oklch(0.83_0.098_78/0.2)]"
                >
                  Check fit for my cottage
                </a>
              </div>
            </div>
          </Reveal>
        </section>

        {/* FAQ */}
        <section
          id="faq"
          className="scroll-mt-24 grid gap-10 px-5 pb-16 sm:px-10 sm:pb-[120px] lg:grid-cols-[minmax(0,380px)_1fr] lg:gap-[72px]"
        >
          <Reveal className="flex flex-col gap-[18px]">
            <span className="mk-mono text-[11px] uppercase tracking-[0.18em] text-[var(--mk-lake)] sm:text-[11.5px]">
              08 — Questions
            </span>
            <h2 className="mk-serif m-0 text-[32px] leading-[1.08] text-[var(--mk-paper)] sm:text-[46px]">
              Before you book the call.
            </h2>
            <p className="m-0 text-[15px] font-light leading-relaxed text-[var(--mk-soft)] sm:text-[15.5px]">
              Anything not answered here, ask on the call — or text it to{" "}
              <a href={PHONE_HREF} className="text-[var(--mk-lake)] no-underline hover:opacity-90">
                {PHONE}
              </a>
              .
            </p>
          </Reveal>
          <Reveal delay={0.06}>
            <div className="mk-glass-panel overflow-hidden rounded-[20px]">
              {FAQ.map((item, i) => {
                const open = faqOpen === i;
                return (
                  <button
                    key={item.q}
                    type="button"
                    onClick={() => setFaqOpen(open ? -1 : i)}
                    className={`w-full cursor-pointer border-0 bg-transparent px-5 py-6 text-left transition-colors hover:bg-white/[0.03] sm:px-[30px] sm:py-[26px] ${
                      i < FAQ.length - 1 ? "border-b border-white/[0.08]" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-6">
                      <span className="text-base text-[var(--mk-paper)] sm:text-lg">{item.q}</span>
                      <span className="mk-mono shrink-0 text-lg text-[var(--mk-lake)]">
                        {open ? "−" : "+"}
                      </span>
                    </div>
                    {open && (
                      <p className="mt-4 mb-0 max-w-[720px] text-[15px] font-light leading-relaxed text-[var(--mk-soft)] sm:text-[15.5px]">
                        {item.a}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </Reveal>
        </section>

        {/* FIT FORM */}
        <section id="fit" className="scroll-mt-24 relative overflow-hidden">
          <div className="absolute inset-0 z-0">
            <img
              src="/muskoka/firepit-evening.jpg"
              alt=""
              className="mk-photo"
              loading="lazy"
              aria-hidden
            />
          </div>
          <div
            className="pointer-events-none absolute inset-0 z-[1]"
            style={{
              background:
                "linear-gradient(180deg, oklch(0.16 0.02 224 / 0.94) 0%, oklch(0.16 0.02 224 / 0.7) 40%, oklch(0.15 0.02 224 / 0.9) 100%)",
            }}
          />
          <div className="relative z-[2] grid gap-10 px-5 py-16 sm:gap-16 sm:px-10 sm:py-[110px] lg:grid-cols-[1fr_1.05fr]">
            <Reveal className="flex flex-col gap-[22px]">
              <span className="mk-mono text-[11px] uppercase tracking-[0.18em] text-[var(--mk-lake)] sm:text-[11.5px]">
                09 — Free 15-minute call
              </span>
              <h2 className="mk-serif m-0 text-[34px] leading-[1.04] text-[var(--mk-paper)] sm:text-[50px]">
                Fifteen minutes, a real number, no pitch deck.
              </h2>
              <p className="m-0 max-w-[480px] text-[15px] font-light leading-relaxed text-[var(--mk-soft)] sm:text-[16.5px]">
                Tell us the lake, the bedrooms and roughly what it earns now. We come back with what
                we would change first, which plan fits, and what the season could realistically look
                like.
              </p>
              <div className="mt-1.5 flex flex-col gap-3.5">
                <a
                  href={PHONE_HREF}
                  className="mk-serif text-[28px] text-[var(--mk-lake)] no-underline sm:text-[34px]"
                >
                  {PHONE}
                </a>
                <a
                  href={EMAIL_HREF}
                  className="text-[15px] font-light text-[var(--mk-soft)] no-underline hover:text-[var(--mk-paper)] sm:text-[15.5px]"
                >
                  {EMAIL}
                </a>
                <a
                  href={WHATSAPP_HREF}
                  className="mk-mono text-[11px] uppercase tracking-[0.12em] text-[var(--mk-quiet)] no-underline hover:text-[var(--mk-soft)]"
                >
                  Prefer WhatsApp? Text the same number for an estimate.
                </a>
              </div>
            </Reveal>

            <Reveal delay={0.08}>
              <div className="mk-glass-form rounded-[22px] p-6 sm:p-10">
                {submitted ? (
                  <div className="flex min-h-[360px] flex-col justify-center gap-5">
                    <span className="mk-mono text-[11px] uppercase tracking-[0.16em] text-[var(--mk-lake)]">
                      Request received
                    </span>
                    <h3 className="mk-serif m-0 text-[30px] leading-tight text-[var(--mk-paper)] sm:text-[38px]">
                      Thanks, {leadName} — we have your cottage.
                    </h3>
                    <p className="m-0 text-base font-light leading-relaxed text-[var(--mk-soft)]">
                      We&apos;ll review your lake and what comparable cottages are earning, then
                      confirm your call time. If you&apos;d rather not wait, call us now — we&apos;ll
                      pull it up while you&apos;re on the line.
                    </p>
                    <a
                      href={PHONE_HREF}
                      className="mk-btn-primary inline-flex w-fit items-center justify-center rounded-xl px-6 py-3.5 text-[15px] no-underline"
                    >
                      Call {PHONE}
                    </a>
                  </div>
                ) : (
                  <form onSubmit={onSubmit} className="flex flex-col gap-[18px]">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {(
                        [
                          ["name", "Name", "text", "Dan Roberts", true],
                          ["email", "Email", "email", "you@email.com", true],
                          ["phone", "Phone", "tel", "(416) 000-0000", true],
                          ["area", "Lake / area or address", "text", "Lake of Bays, Dwight", true],
                        ] as const
                      ).map(([name, label, type, placeholder, required]) => (
                        <label key={name} className="flex flex-col gap-2">
                          <span className="mk-mono text-[10px] uppercase tracking-[0.14em] text-[oklch(0.78_0.02_210)] sm:text-[10.5px]">
                            {label}
                          </span>
                          <input
                            name={name}
                            type={type}
                            required={required}
                            placeholder={placeholder}
                            className="mk-input"
                            autoComplete={
                              name === "name"
                                ? "name"
                                : name === "email"
                                  ? "email"
                                  : name === "phone"
                                    ? "tel"
                                    : "street-address"
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <label className="flex flex-col gap-2">
                      <span className="mk-mono text-[10px] uppercase tracking-[0.14em] text-[oklch(0.78_0.02_210)] sm:text-[10.5px]">
                        Rough monthly earnings today
                      </span>
                      <select name="earnings" className="mk-input" defaultValue={EARNINGS_OPTIONS[2].value}>
                        {EARNINGS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="mk-mono text-[10px] uppercase tracking-[0.14em] text-[oklch(0.78_0.02_210)] sm:text-[10.5px]">
                        Listing URL{" "}
                        <span className="normal-case tracking-normal text-[oklch(0.66_0.02_210)]">
                          (optional)
                        </span>
                      </span>
                      <input
                        name="listing"
                        type="url"
                        placeholder="airbnb.ca/rooms/…"
                        className="mk-input"
                      />
                    </label>
                    <div className="flex flex-col gap-2">
                      <span className="mk-mono text-[10px] uppercase tracking-[0.14em] text-[oklch(0.78_0.02_210)] sm:text-[10.5px]">
                        Preferred call time
                      </span>
                      <CallTimePicker value={callStartIso} onChange={setCallStartIso} />
                    </div>
                    <label className="mt-0.5 flex cursor-pointer items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                        className="mt-0.5 h-[17px] w-[17px] shrink-0 accent-[var(--mk-lake)]"
                      />
                      <span className="text-[13.5px] font-light leading-relaxed text-[var(--mk-soft)]">
                        I agree that Mandel Realty Group may contact me by phone, text or email about
                        managing my cottage.
                      </span>
                    </label>
                    {error && (
                      <p className="m-0 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                        {error}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={submitting}
                      className="mk-btn-primary mt-1.5 w-full rounded-xl border-0 px-4 py-[17px] text-[15.5px]"
                    >
                      {submitting ? "Booking…" : "Book my free 15-minute call"}
                    </button>
                    <span className="mk-mono text-center text-[10px] leading-relaxed tracking-[0.08em] text-[oklch(0.68_0.02_210)] sm:text-[10.5px]">
                      No obligation · No revenue guarantees · We reply within one business day
                    </span>
                  </form>
                )}
              </div>
            </Reveal>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-white/[0.09] bg-[var(--mk-ink)] px-5 pb-10 pt-12 sm:px-10 sm:pt-14">
          <div className="flex flex-col gap-10 border-b border-white/[0.08] pb-10 lg:flex-row lg:justify-between">
            <div className="flex max-w-md flex-col gap-3.5">
              <span className="text-[15px] font-light uppercase tracking-[0.28em] text-[var(--mk-paper)]">
                Mandel Realty Group
              </span>
              <span className="text-[14.5px] font-light leading-relaxed text-[oklch(0.76_0.014_215)]">
                Muskoka cottage &amp; short-term rental management.
                <br />
                Toronto-based · portfolios across Canada and the US.
              </span>
            </div>
            <div className="flex flex-wrap gap-10 sm:gap-16">
              <div className="flex flex-col gap-2.5">
                <span className="mk-mono text-[10px] uppercase tracking-[0.14em] text-[oklch(0.66_0.02_210)] sm:text-[10.5px]">
                  Contact
                </span>
                <a
                  href={PHONE_HREF}
                  className="text-[14.5px] font-light text-[oklch(0.88_0.012_215)] no-underline hover:text-[var(--mk-paper)]"
                >
                  {PHONE}
                </a>
                <a
                  href={EMAIL_HREF}
                  className="text-[14.5px] font-light text-[oklch(0.88_0.012_215)] no-underline hover:text-[var(--mk-paper)]"
                >
                  {EMAIL}
                </a>
              </div>
              <div className="flex flex-col gap-2.5">
                <span className="mk-mono text-[10px] uppercase tracking-[0.14em] text-[oklch(0.66_0.02_210)] sm:text-[10.5px]">
                  Page
                </span>
                <a
                  href="#plans"
                  className="text-[14.5px] font-light text-[oklch(0.88_0.012_215)] no-underline hover:text-[var(--mk-paper)]"
                >
                  Plans &amp; fees
                </a>
                <a
                  href="#faq"
                  className="text-[14.5px] font-light text-[oklch(0.88_0.012_215)] no-underline hover:text-[var(--mk-paper)]"
                >
                  FAQ
                </a>
                <a
                  href="#fit"
                  className="text-[14.5px] font-light text-[oklch(0.88_0.012_215)] no-underline hover:text-[var(--mk-paper)]"
                >
                  Book a call
                </a>
              </div>
              <div className="flex flex-col gap-2.5">
                <span className="mk-mono text-[10px] uppercase tracking-[0.14em] text-[oklch(0.66_0.02_210)] sm:text-[10.5px]">
                  Legal
                </span>
                <a
                  href="/privacy"
                  className="text-[14.5px] font-light text-[oklch(0.88_0.012_215)] no-underline hover:text-[var(--mk-paper)]"
                >
                  Privacy policy
                </a>
                <a
                  href="/"
                  className="text-[14.5px] font-light text-[oklch(0.88_0.012_215)] no-underline hover:text-[var(--mk-paper)]"
                >
                  Main site
                </a>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <span className="mk-mono text-[10px] tracking-[0.1em] text-[oklch(0.6_0.02_210)] sm:text-[10.5px]">
              © 2026 Mandel Realty Group. Fees quoted exclude HST. No revenue guarantees.
            </span>
            <span className="mk-mono text-[10px] tracking-[0.1em] text-[oklch(0.6_0.02_210)] sm:text-[10.5px]">
              Bracebridge · Gravenhurst · Huntsville · Lake of Bays · Port Carling
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
