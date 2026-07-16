import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { ProofSection } from "./components/ProofSection";
import { HowSection } from "./components/HowSection";
import { PricingSection } from "./components/PricingSection";
import { MathSection } from "./components/MathSection";
import { FaqSection } from "./components/FaqSection";
import { AuditSection } from "./components/AuditSection";
import { Footer } from "./components/Footer";
import { MobileStickyCta } from "./components/MobileStickyCta";
import { ThankYouPage } from "./pages/ThankYouPage";

function HomePage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <ProofSection />
        <HowSection />
        <PricingSection />
        <MathSection />
        <FaqSection />
        <AuditSection />
      </main>
      <MobileStickyCta />
      <Footer />
    </>
  );
}

export default function App() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";

  if (path === "/thank-you") {
    return <ThankYouPage />;
  }

  return <HomePage />;
}
