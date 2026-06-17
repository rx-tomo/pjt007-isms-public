import { generateMetadata as generatePageMetadata } from './metadata';
import Header from '@/components/Header';
import HeroSection from '@/components/HeroSection';
import ValuePropsSection from '@/components/ValuePropsSection';
import FeaturesSection from '@/components/FeaturesSection';
import ProcessSection from '@/components/ProcessSection';
import HowItWorksSection from '@/components/HowItWorksSection';
import FAQSection from '@/components/FAQSection';
import CTASection from '@/components/CTASection';
import Footer from '@/components/Footer';

export const generateMetadata = generatePageMetadata;

export default function HomePage() {
  return (
    <div className="min-h-screen bg-app">
      <Header />
      <main>
        <HeroSection />
        <ValuePropsSection />
        <FeaturesSection />
        <ProcessSection />
        <HowItWorksSection />
        <FAQSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}