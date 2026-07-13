export const PHONE = "647-381-7325";
export const PHONE_HREF = "tel:+16473817325";
export const EMAIL = "info@mandelrealtygroup.com";
export const EMAIL_HREF = "mailto:info@mandelrealtygroup.com";

export const HERO_AMOUNT = 26995;

export const PROOF_ROWS = [
  {
    period: "Full Year 2025",
    before: "$26,995",
    withMrg: "—",
    lift: "Entire year before MRG",
    highlight: false,
  },
  {
    period: "May 2026",
    before: "$1,886",
    withMrg: "$3,748",
    lift: "+99%",
    highlight: false,
  },
  {
    period: "June 2026",
    before: "$0 (empty)",
    withMrg: "$8,755",
    lift: "MRG filled it",
    highlight: false,
  },
  {
    period: "July 2026",
    before: "$5,370",
    withMrg: "$10,235",
    lift: "+90%",
    highlight: false,
  },
  {
    period: "August 2026",
    before: "$5,729",
    withMrg: "$10,975",
    lift: "+91%",
    highlight: false,
  },
  {
    period: "May–Aug Total",
    before: "$12,985",
    withMrg: "$33,713",
    lift: "+159%",
    highlight: true,
  },
] as const;

export const BAR_COMPARISONS = [
  {
    month: "July 2026",
    before: 5370,
    withMrg: 10235,
    beforeLabel: "$5,370",
    withMrgLabel: "$10,235",
  },
  {
    month: "August 2026",
    before: 5729,
    withMrg: 10975,
    beforeLabel: "$5,729",
    withMrgLabel: "$10,975",
  },
] as const;

export const HOW_CARDS = [
  {
    step: "01",
    title: "Professional photography & full relisting",
    detail: "New photos, new copy, new positioning on Airbnb.",
  },
  {
    step: "02",
    title: "Earned Superhost in the first season",
    detail: "Reviews, response time, and standards — all protected from day one.",
  },
  {
    step: "03",
    title: "Dynamic pricing",
    detail: "Rates adjust daily based on demand, season, and local events.",
  },
  {
    step: "04",
    title: "24/7 guest communication",
    detail: "Every inquiry answered fast. Every issue handled before it becomes a review.",
  },
  {
    step: "05",
    title: "Post-checkout inspection every stay",
    detail: "Damage caught early. Supplies restocked. Listing always guest-ready.",
  },
] as const;

export const ESSENTIAL_FEATURES = [
  "Professional listing photography",
  "Design, furniture & staging advisory",
  "Full listing overhaul (title, description, SEO)",
  "Dynamic pricing — daily",
  "24/7 guest communication",
  "Cleaning coordination",
  "Superhost strategy & monitoring",
  "Monthly earnings report",
] as const;

export const FULL_SERVICE_FEATURES = [
  "Post-checkout inspection with full checklist",
  "Supplies & consumables verified every stay",
  "Preventative maintenance (filters, bulbs, batteries)",
  "Maintenance request handling & coordination",
  "Proactive Superhost badge protection",
  "Guest Favourite pursuit system",
  "Monthly performance review call with Ryan",
] as const;

export const FAQ_ITEMS = [
  {
    q: "Others charge 15% — why 20%?",
    a: "Our client paid less than 15% before us and made half as much. At 20% with MRG they net more than they ever did at 15% elsewhere.",
  },
  {
    q: "What's the difference between 20% and 25%?",
    a: "Full Service adds the operational layer: inspections, supplies, preventative maintenance, and Superhost protection — the details that protect your reviews and ranking.",
  },
  {
    q: "Can you do a flat monthly fee?",
    a: "We work on percentage so we only earn more when you earn more. Our incentives are aligned with yours.",
  },
  {
    q: "I want to manage my own guests.",
    a: "You keep full visibility — every booking, dollar, and review in real time. We handle the work, you keep the control.",
  },
  {
    q: "How do I know these numbers are real?",
    a: "Every figure is from the Airbnb dashboard. We'll show you the screenshots on your audit call.",
  },
] as const;
