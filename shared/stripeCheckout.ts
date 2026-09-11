import Stripe from "stripe";
import { publicSiteOrigin } from "./ownerEmails.js";

export type RevenueAuditCheckoutTier = "full" | "half";

const TIER_CENTS: Record<RevenueAuditCheckoutTier, number> = {
  full: 3999, // $39.99
  half: 1999, // $19.99 — 50% off when they decline the full price
};

const TIER_LABEL: Record<RevenueAuditCheckoutTier, string> = {
  full: "Full Revenue Audit unlock",
  half: "Full Revenue Audit unlock (50% off)",
};

function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2025-02-24.acacia" });
}

function currency(): string {
  return (process.env.STRIPE_CURRENCY?.trim() || "cad").toLowerCase();
}

export function checkoutTierConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export async function createRevenueAuditCheckoutSession(input: {
  tier: RevenueAuditCheckoutTier;
  email?: string;
  reportId?: string;
  listingUrl?: string;
  address?: string;
}): Promise<{ url: string; sessionId: string }> {
  const stripe = stripeClient();
  if (!stripe) {
    throw Object.assign(new Error("Card payments are not configured yet."), { status: 503 });
  }
  const tier = input.tier === "half" ? "half" : "full";
  const origin = publicSiteOrigin().replace(/\/$/, "");
  const reportQ = input.reportId ? `r=${encodeURIComponent(input.reportId)}&` : "";
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: input.email || undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: currency(),
          unit_amount: TIER_CENTS[tier],
          product_data: {
            name: TIER_LABEL[tier],
            description: "One-time unlock for this Mandel Realty Group revenue audit.",
          },
        },
      },
    ],
    success_url: `${origin}/revenueaudit/?${reportQ}checkout_session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/revenueaudit/?${reportQ}checkout=cancel`,
    metadata: {
      product: "revenue_audit",
      tier,
      reportId: input.reportId || "",
      listingUrl: (input.listingUrl || "").slice(0, 400),
      address: (input.address || "").slice(0, 200),
    },
    payment_intent_data: {
      metadata: {
        product: "revenue_audit",
        tier,
        reportId: input.reportId || "",
      },
    },
  });
  if (!session.url) {
    throw Object.assign(new Error("Could not start checkout."), { status: 502 });
  }
  return { url: session.url, sessionId: session.id };
}

export async function confirmRevenueAuditCheckoutSession(sessionId: string): Promise<{
  paid: boolean;
  tier: RevenueAuditCheckoutTier;
  reportId: string;
  email: string;
  amountCents: number;
}> {
  const stripe = stripeClient();
  if (!stripe) {
    throw Object.assign(new Error("Card payments are not configured yet."), { status: 503 });
  }
  const id = String(sessionId || "").trim();
  if (!id.startsWith("cs_")) {
    throw Object.assign(new Error("Missing checkout session."), { status: 400 });
  }
  const session = await stripe.checkout.sessions.retrieve(id);
  const paid =
    session.payment_status === "paid" ||
    session.status === "complete";
  if (!paid) {
    throw Object.assign(new Error("Payment is not complete yet."), { status: 402 });
  }
  const tierRaw = String(session.metadata?.tier || "").toLowerCase();
  const tier: RevenueAuditCheckoutTier = tierRaw === "half" ? "half" : "full";
  return {
    paid: true,
    tier,
    reportId: String(session.metadata?.reportId || "").trim(),
    email: String(session.customer_details?.email || session.customer_email || "").trim(),
    amountCents: Number(session.amount_total) || TIER_CENTS[tier],
  };
}
