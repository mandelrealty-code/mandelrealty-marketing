import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { ProofSection } from "./components/ProofSection";
import { HowSection } from "./components/HowSection";
import { PricingSection } from "./components/PricingSection";
import { MathSection } from "./components/MathSection";
import { FaqSection } from "./components/FaqSection";
import { AuditSection } from "./components/AuditSection";
import { Footer } from "./components/Footer";

export default function App() {
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
      <Footer />
    </>
  );
}
