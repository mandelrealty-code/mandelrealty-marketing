export const PHONE = "647-381-7325";
export const PHONE_HREF = "tel:+16473817325";
export const WHATSAPP_HREF = "https://wa.me/16473817325";
export const EMAIL = "info@mandelrealtygroup.com";
export const EMAIL_HREF = "mailto:info@mandelrealtygroup.com";

export const CTA_HEADLINE = `Call Our Experts: ${PHONE}`;
export const CTA_SUPPORT =
  "Talk to a real Airbnb specialist — no obligation, just straight answers.";
export const EMAIL_CTA_LEAD = "Prefer email? Get your custom earnings estimate:";
export const CONTACT_CONSENT_ERROR =
  "Please confirm we can contact you about your custom earnings estimate.";

export const HERO_AMOUNT = 26995;

export const PAIN_CARDS = [
  {
    id: "burnout",
    eyebrow: "Burnout",
    title: "You're tired of hosting.",
    detail:
      "Midnight messages, back-to-back turnovers, and a calendar that never lets you fully switch off.",
  },
  {
    id: "underperforming",
    eyebrow: "Underperformance",
    title: "Your listing's underperforming.",
    detail:
      "You know the nights are there — but occupancy, ADR, or both keep coming in soft.",
  },
  {
    id: "coasting",
    eyebrow: "Weak management",
    title: "Your current manager is coasting.",
    detail:
      "Slow replies, set-and-forget pricing, and a listing that hasn't been touched in months.",
  },
  {
    id: "upside",
    eyebrow: "Missed upside",
    title: "You know it could earn more.",
    detail:
      "Same property, same platform — you're just not capturing what it's capable of.",
  },
] as const;


export const CHAIN_STEPS = [
  { id: "systems", label: "Proven systems", detail: "Pricing, ops, and guest standards dialed in." },
  { id: "experience", label: "Better guest experience", detail: "Fast replies, clean stays, zero friction." },
  { id: "reviews", label: "Better reviews", detail: "Ratings climb — and stay protected." },
  { id: "visibility", label: "Higher visibility", detail: "Airbnb pushes winners higher in search." },
  { id: "bookings", label: "More bookings", detail: "More nights filled at stronger rates." },
] as const;

export const CHAIN_OUTCOME = {
  id: "money",
  label: "More money",
  detail: "Same property. Same platform. Higher payouts.",
} as const;


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

export const TESTIMONIALS = [
  {
    quote:
      "I was skeptical about virtual management, but MRG increased my monthly revenue by 40% in the first quarter. The systems they use are incredible — I barely lift a finger now.",
    name: "Sarah M.",
    location: "Toronto, ON",
    badge: "+40% Revenue",
  },
  {
    quote:
      "They respond to guests faster than I ever could. My reviews went from 4.6 to 4.9 in two months. I finally feel like I have a real business, not a stressful side hustle.",
    name: "David R.",
    location: "Vancouver, BC",
    badge: "4.9★ Rating",
  },
  {
    quote:
      "I have three properties across two cities and MRG manages them all seamlessly. The monthly reports are detailed and my income has never been more consistent.",
    name: "Jennifer L.",
    location: "Austin, TX",
    badge: "3 Properties",
  },
] as const;

export const FEATURE_CARDS = [
  {
    step: "01",
    title: "Dynamic pricing",
    detail:
      "We reprice daily around demand, events and seasonality — so you capture the high-value nights other hosts leave on the table.",
  },
  {
    step: "02",
    title: "Listing that ranks",
    detail:
      "Professional photos, a rewritten title and description, and a fully optimized listing that climbs Airbnb search and earns more clicks.",
  },
  {
    step: "03",
    title: "5-star guest experience",
    detail:
      "24/7 guest communication, vetted cleaning and turnovers handled for you — protecting the reviews that keep revenue climbing.",
  },
] as const;

export const PRICING_TIERS = [
  {
    id: "essentials",
    name: "Essentials",
    description: "For hosts who want the listing dialed in and pricing handled.",
    features: [
      "Listing & photo optimization",
      "Dynamic daily pricing",
      "Monthly performance report",
    ],
    popular: false,
  },
  {
    id: "full-service",
    name: "Full Service",
    description: "Completely hands-off. We run everything, you collect the payouts.",
    features: [
      "Everything in Essentials",
      "24/7 guest communication",
      "Cleaning & turnover coordination",
      "Review & reputation management",
    ],
    popular: true,
  },
  {
    id: "premium",
    name: "Premium",
    description: "For portfolios and hosts who want white-glove, top-line growth.",
    features: [
      "Everything in Full Service",
      "Multi-listing portfolio strategy",
      "Dedicated account manager",
      "Priority support",
    ],
    popular: false,
  },
] as const;

export const FAQ_ITEMS = [
  {
    q: "What does it cost?",
    a: "We charge a share of the revenue we generate — no big upfront fees. Our incentives stay aligned with growing your bottom line.",
  },
  {
    q: "Do you manage hands-on or virtually?",
    a: "Both. We run hands-on where it matters and virtual systems everywhere else — so you get local execution with always-on operations.",
  },
  {
    q: "Virtual management — doesn't that mean distant?",
    a: "No. Virtual means efficient: 24/7 guest communication, dynamic pricing, and listing ops that don't wait on a 9-to-5 manager.",
  },
  {
    q: "My listing is new (or underperforming). Can you still help?",
    a: "Yes. New and underperforming listings are exactly where a full relist, pricing, and guest ops make the biggest difference.",
  },
  {
    q: "How quickly can we get started?",
    a: "Most partners can be live within days of onboarding — photos, listing overhaul, and systems first, then bookings.",
  },
  {
    q: "Where do you operate?",
    a: "We manage listings across Canada and the United States — hands-on or fully virtual, depending on what the property needs.",
  },
] as const;

/** Legacy exports kept for thank-you / email paths */
export const ESSENTIAL_FEATURES = PRICING_TIERS[0].features;
export const FULL_SERVICE_FEATURES = PRICING_TIERS[1].features;
export const HOW_CARDS = FEATURE_CARDS;
export const BAR_COMPARISONS = [
  {
    month: "May 2026",
    before: 1886,
    withMrg: 3748,
    beforeLabel: "$1,886",
    withMrgLabel: "$3,748",
    lift: "+99%",
  },
  {
    month: "June 2026",
    before: 0,
    withMrg: 8755,
    beforeLabel: "$0",
    withMrgLabel: "$8,755",
    lift: "Filled",
  },
  {
    month: "July 2026",
    before: 5370,
    withMrg: 10235,
    beforeLabel: "$5,370",
    withMrgLabel: "$10,235",
    lift: "+90%",
  },
  {
    month: "August 2026",
    before: 5729,
    withMrg: 10975,
    beforeLabel: "$5,729",
    withMrgLabel: "$10,975",
    lift: "+91%",
  },
] as const;
