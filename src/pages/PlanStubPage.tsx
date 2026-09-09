import { useEffect } from "react";
import { EMAIL_HREF, PHONE, PHONE_HREF, WHATSAPP_HREF } from "../lib/constants";
import "./plan-stub.css";

export type PlanStubId = "full-service" | "growth" | "essentials" | "furniture";

type PlanStub = {
  id: PlanStubId;
  path: string;
  badge: string;
  name: string;
  color: string;
  who: string;
  fee: string;
  bullets: string[];
  note?: string;
};

const PLANS: Record<PlanStubId, PlanStub> = {
  "full-service": {
    id: "full-service",
    path: "/full-service",
    badge: "Full Service",
    name: "Full Service Management",
    color: "#2F6BFF",
    who: "For owners who want the property fully off their plate.",
    fee: "20% standard or 25% full service of gross booking revenue. HST extra. Cleaning and pass-throughs excluded.",
    bullets: [
      "Guest messaging, dynamic pricing, and listing optimization",
      "Cleaning and turnover coordination with photo verification",
      "Multi-platform listing on Airbnb, Expedia, and Booking.com",
      "Full Service (25%) adds deeper inventory, guidebook tools, review filter, and dedicated support",
      "Furniture Investment can pair with Standard 20% or Full Service 25%",
    ],
  },
  growth: {
    id: "growth",
    path: "/growth",
    badge: "Growth",
    name: "Growth Partnership",
    color: "#12B76A",
    who: "For hosts already live with booking history.",
    fee: "Aligned Growth: 10% up to your monthly benchmark, 35% above. Confidence Partner: 5% up to benchmark, 45% above.",
    bullets: [
      "Lower fee on your current benchmark, larger share only on growth past it",
      "Full management scope (messaging, pricing, turnovers, optimization)",
      "Monthly benchmarks built from your own booking history",
      "Requires a live listing with demonstrated performance",
      "Furniture Investment is not available on this plan",
    ],
  },
  essentials: {
    id: "essentials",
    path: "/essentials",
    badge: "Essentials",
    name: "Managed Essentials",
    color: "#FF4716",
    who: "For owners who want the inbox and booking ops handled, and keep cleaning themselves.",
    fee: "Message & Book $199 / mo or Message & Optimize $349 / mo. HST extra.",
    bullets: [
      "AI + VA guest messaging, booking confirmations, and guest screening",
      "Message & Optimize adds dynamic pricing and scheduled listing optimization",
      "You keep cleaning, maintenance, and inventory",
      "Optional Klarna 12-month path at about 5% off (no refunds on that path)",
      "Upgrade to Full Service or Growth anytime by written request",
    ],
  },
  furniture: {
    id: "furniture",
    path: "/furniture",
    badge: "Furniture",
    name: "Furniture Investment",
    color: "#F5C518",
    who: "For an empty or dated unit that needs to be guest ready.",
    fee: "$0 upfront furnish if approved. Pairs only with Standard 20% or Full Service 25%.",
    bullets: [
      "In-house design team furnishes furniture, décor, and styling",
      "You get a full itemized invoice of everything purchased",
      "24-month term: furniture transfers to you free at the end",
      "Earlier exit uses a pro-rated buyout from the invoice (we do not remove the furniture)",
      "Requires a livable space and an STR permit where the city requires one",
    ],
    note: "Approval is not automatic. We review each property before confirming.",
  },
};

export function PlanStubPage({ planId }: { planId: PlanStubId }) {
  const plan = PLANS[planId];

  useEffect(() => {
    document.title = `${plan.name} | Mandel Realty Group`;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) {
      desc.setAttribute("content", `${plan.name}. ${plan.who} ${plan.fee}`);
    }
  }, [plan]);

  return (
    <div className="plan-stub">
      <header className="plan-stub__header">
        <div className="plan-stub__header-inner">
          <a href="/" className="plan-stub__brand" aria-label="Mandel Realty Group home">
            <img src="/hub/mrg-logo.png" alt="Mandel Realty Group" className="plan-stub__logo" />
          </a>
          <nav className="plan-stub__nav">
            <a href="/#plans">All plans</a>
            <a href="/book-a-call" className="plan-stub__book">
              Book a call
            </a>
          </nav>
        </div>
      </header>

      <main className="plan-stub__main">
        <p className="plan-stub__eyebrow" style={{ color: plan.color }}>
          Interim plan page
        </p>
        <span
          className="plan-stub__badge"
          style={{ background: plan.color, color: planId === "furniture" ? "#1f1a10" : "#ffffff" }}
        >
          {plan.badge}
        </span>
        <h1 className="plan-stub__title">{plan.name}</h1>
        <p className="plan-stub__who">{plan.who}</p>
        <p className="plan-stub__fee" style={{ color: plan.color }}>
          {plan.fee}
        </p>

        <ul className="plan-stub__bullets">
          {plan.bullets.map((b) => (
            <li key={b}>
              <span className="plan-stub__dot" style={{ background: plan.color }} />
              {b}
            </li>
          ))}
        </ul>

        {plan.note ? <p className="plan-stub__note">{plan.note}</p> : null}

        <p className="plan-stub__soon">
          Full landing page coming soon. For now, book a quick call and we will walk through fit,
          fees, and next steps.
        </p>

        <div className="plan-stub__ctas">
          <a href="/book-a-call" className="plan-stub__cta-gold">
            Book a free 15-minute call
          </a>
          <a href={WHATSAPP_HREF} className="plan-stub__cta-outline">
            WhatsApp chat
          </a>
          <a href={PHONE_HREF} className="plan-stub__cta-outline">
            Call {PHONE}
          </a>
          <a href="/revenueaudit/" className="plan-stub__cta-coral">
            Free revenue audit
          </a>
        </div>

        <p className="plan-stub__back">
          <a href="/#plans">See all four plans</a>
          {" · "}
          <a href={EMAIL_HREF}>info@mandelrealtygroup.com</a>
        </p>
      </main>
    </div>
  );
}

export function planIdFromPath(path: string): PlanStubId | null {
  if (path === "/full-service") return "full-service";
  if (path === "/growth") return "growth";
  if (path === "/essentials") return "essentials";
  if (path === "/furniture") return "furniture";
  return null;
}
