import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import HeroSection from '../components/HeroSection.jsx';
import SignatureDishCarousel from '../components/SignatureDishCarousel.jsx';
import OfferingBlock from '../components/OfferingBlock.jsx';
import KitchenSecretsSection from '../components/KitchenSecretsSection.jsx';
import GiftCardSection from '../components/GiftCardSection.jsx';
import { UniqueExperienceAccordion } from '@/components/ui/interactive-image-accordion';
import RolledPerfectionSection from '../components/RolledPerfectionSection.jsx';
import TestimonialsSection from '../components/TestimonialsSection.jsx';
import AboutUsSection from '../components/AboutUsSection.jsx';
import { homeImages } from '../data/homeAssets.js';
import '../styles/home.css';

function Home() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash !== "#about") return undefined;

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    const timer = window.setTimeout(() => {
      document.getElementById("about-section")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);

    return () => window.clearTimeout(timer);
  }, [location.pathname, location.hash]);

  return (
    <div className="phurai-home">
      <div className="phurai-home__header-wrap">
        <HeroSection />
      </div>

      <main>
        <SignatureDishCarousel />

        <OfferingBlock
          label="OFFERINGS"
          title="SPRING TASTING MENU"
          description="Celebrate the season with our new Spring Tasting Menu - a curated culinary journey featuring Phūrai signatures alongside refined seasonal creations crafted by our chefs. Priced at $150 per guest, this thoughtfully composed experience is perfect for both first-time and returning guests."
          imageSrc={homeImages.offeringSushi}
          imageAlt="Spring tasting menu sushi platter"
        />

        <OfferingBlock
          label="HAPPENINGS"
          title="SPRING TASTING MENU"
          description="Set the tone for your weekend at Phūrai Downtown. Join us in the Bar & Lounge every Saturday from 7pm - 10pm as DJ Mattee delivers house and techno beats for a vibrant late-night atmosphere."
          imageSrc={homeImages.happenings}
          imageAlt="Restaurant bar and lounge"
          reverse
        />

        <OfferingBlock
          label="OFFERINGS"
          title="OUR 3 COURSE LUNCH PRIX FIXE MENU"
          description="For $45 enjoy a curated three-course menu featuring one cold dish, one hot main, and a decadent dessert. Savor signature favorites like our Yellowtail Jalapeno, Sashimi Salad, Shrimp and Vegetable Spicy Garlic, and Fish & Chips, then finish with seasonal mochi."
          imageSrc={homeImages.salmon}
          imageAlt="Guest enjoying baked salmon"
        />

        <KitchenSecretsSection />
        <GiftCardSection />
        <UniqueExperienceAccordion />
        <RolledPerfectionSection />
        <TestimonialsSection />

        <AboutUsSection />
      </main>
    </div>
  );
}

export default Home;
