import { ThankYouPage } from "./pages/ThankYouPage";
import { PrivacyPolicyPage } from "./pages/PrivacyPolicyPage";
import { AdsLandingPage } from "./pages/AdsLandingPage";
import { MuskokaLandingPage } from "./pages/MuskokaLandingPage";
import { ManagementHubPage } from "./pages/ManagementHubPage";
import { MakeoverPage } from "./pages/MakeoverPage";
import { FullServicePage } from "./pages/FullServicePage";
import { GrowthPage } from "./pages/GrowthPage";
import { EssentialsPage } from "./pages/EssentialsPage";
import { FurniturePage } from "./pages/FurniturePage";
import { PlanStubPage, planIdFromPath } from "./pages/PlanStubPage";
import { AdminPage } from "./pages/AdminPage";
import { OwnerApp } from "./pages/owner/OwnerApp";
import { TeamApp } from "./pages/team/TeamApp";
import { PublicSopHub } from "./pages/sop/PublicSopHub";

function isAdminHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "admin.mandelrealtygroup.com") return true;
  // Local only: add `127.0.0.1 admin.localhost` to /etc/hosts if needed
  if (import.meta.env.DEV && (host === "admin.localhost" || host.startsWith("admin."))) {
    return true;
  }
  return false;
}

export default function App() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const adminHost = isAdminHostname(window.location.hostname);

  // Single Shareable SOP Guide Viewer: /sop/{slug}
  if (path.startsWith("/sop/")) {
    const slug = path.replace(/^\/sop\//, "").split("/")[0];
    if (slug) {
      return <PublicSopHub initialSlug={slug} />;
    }
  }

  // Standalone /sop without a slug redirects to homepage
  if (path === "/sop") {
    window.location.replace("/");
    return null;
  }

  // Admin subdomain only — never expose inbox on the marketing site.
  // Preview tokens let operators open /owner/{slug} on admin to see the host UI.
  if (adminHost) {
    const preview = new URLSearchParams(window.location.search).get("preview");
    if ((path === "/owner" || path.startsWith("/owner/")) && preview) {
      return <OwnerApp />;
    }
    return <AdminPage />;
  }

  // Block /admin on www (and any non-admin host)
  if (path === "/admin") {
    window.location.replace("/");
    return null;
  }

  // Owner portal on marketing host: /owner/{slug}/…
  if (path === "/owner" || path.startsWith("/owner/")) {
    return <OwnerApp />;
  }

  // Employee / VA portal: /team/{slug}/…
  if (path === "/team" || path.startsWith("/team/")) {
    return <TeamApp />;
  }

  if (path === "/thank-you") {
    return <ThankYouPage />;
  }

  if (path === "/privacy" || path === "/privacy-policy") {
    return <PrivacyPolicyPage />;
  }

  if (path === "/book-a-call" || path === "/get-estimate") {
    return <AdsLandingPage />;
  }

  if (path === "/muskoka") {
    return <MuskokaLandingPage />;
  }

  if (path === "/makeover") {
    return <MakeoverPage />;
  }

  // Static tool lives at public/revenueaudit/index.html
  if (path === "/revenueaudit") {
    window.location.replace("/revenueaudit/");
    return null;
  }

  if (path === "/full-service") {
    return <FullServicePage />;
  }

  if (path === "/growth") {
    return <GrowthPage />;
  }

  if (path === "/essentials") {
    return <EssentialsPage />;
  }

  if (path === "/furniture") {
    return <FurniturePage />;
  }

  const planId = planIdFromPath(path);
  if (planId) {
    return <PlanStubPage planId={planId} />;
  }

  return <ManagementHubPage />;
}
