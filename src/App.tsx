import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { PainSection } from "./components/PainSection";
import { HowSection } from "./components/HowSection";
import { ProofSection } from "./components/ProofSection";
import { TestimonialsSection } from "./components/TestimonialsSection";
import { FeaturesSection } from "./components/FeaturesSection";
import { PricingSection } from "./components/PricingSection";
import { FaqSection } from "./components/FaqSection";
import { BoutiqueSection } from "./components/BoutiqueSection";
import { FitCheckSection } from "./components/FitCheckSection";
import { Footer } from "./components/Footer";
import { FloatingCtas } from "./components/FloatingCtas";
import { ThankYouPage } from "./pages/ThankYouPage";
import { AdsLandingPage } from "./pages/AdsLandingPage";
import { AdminPage } from "./pages/AdminPage";
import { useScrollToHash } from "./hooks/useScrollToHash";

function isAdminHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "admin.mandelrealtygroup.com") return true;
  // Local only: add `127.0.0.1 admin.localhost` to /etc/hosts if needed
  if (import.meta.env.DEV && (host === "admin.localhost" || host.startsWith("admin."))) {
    return true;
  }
  return false;
}

function HomePage() {
  useScrollToHash();

  return (
    <>
      <Header />
      <main>
        <Hero />
        <PainSection />
        <HowSection />
        <ProofSection />
        <TestimonialsSection />
        <FeaturesSection />
        <PricingSection />
        <FaqSection />
        <BoutiqueSection />
        <FitCheckSection />
      </main>
      <FloatingCtas />
      <Footer />
    </>
  );
}

export default function App() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const adminHost = isAdminHostname(window.location.hostname);

  // Admin subdomain only — never expose inbox on the marketing site
  if (adminHost) {
    return <AdminPage />;
  }

  // Block /admin on www (and any non-admin host)
  if (path === "/admin") {
    window.location.replace("/");
    return null;
  }

  if (path === "/thank-you") {
    return <ThankYouPage />;
  }

  if (path === "/book-a-call" || path === "/get-estimate") {
    return <AdsLandingPage />;
  }

  return <HomePage />;
}
