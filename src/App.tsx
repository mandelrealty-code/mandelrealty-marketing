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
import { useScrollToHash } from "./hooks/useScrollToHash";

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

  if (path === "/thank-you") {
    return <ThankYouPage />;
  }

  return <HomePage />;
}
