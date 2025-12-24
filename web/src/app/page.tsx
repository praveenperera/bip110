import { HeroSection } from "@/components/hero-section";
import { KeyPointsSection } from "@/components/key-points";
import { ProblemSection } from "@/components/problem-section";
import { HowItWorksSection } from "@/components/how-it-works";
import { FAQSection } from "@/components/faq-section";
import { TradeoffsSection } from "@/components/tradeoffs-section";
import { TimelineSection } from "@/components/timeline-section";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <main className="min-h-screen">
      <HeroSection />
      <KeyPointsSection />
      <ProblemSection />
      <HowItWorksSection />
      <FAQSection />
      <TradeoffsSection />
      <TimelineSection />
      <Footer />
    </main>
  );
}
