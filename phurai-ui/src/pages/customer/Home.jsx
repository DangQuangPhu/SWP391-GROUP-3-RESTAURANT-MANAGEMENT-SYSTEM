import HeroSection from '@/components/Home/HeroSection';
import SignatureDishCarousel from '@/components/Home/SignatureDishCarousel';
import OfferingBlock from '@/components/Home/OfferingBlock';
import KitchenSecretsSection from '@/components/Home/KitchenSecretsSection';
import GiftCardSection from '@/components/Home/GiftCardSection';
import { UniqueExperienceAccordion } from '@/components/ui/interactive-image-accordion';
import RolledPerfectionSection from '@/components/Home/RolledPerfectionSection';
import TestimonialsSection from '@/components/Home/TestimonialsSection';
import AboutUsSection from '@/components/Home/AboutUsSection';
import { homeImages } from '@/data/homeAssets';
import '@/styles/home.css';

function Home() {
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
          buttonLabel="RESERVE"
        />

        <OfferingBlock
          label="OFFERINGS"
          title="OUR 3 COURSE LUNCH PRIX FIXE MENU"
          description="For $45 enjoy a curated three-course menu featuring one cold dish, one hot main, and a decadent dessert. Savor signature favorites like our Yellowtail Jalapeno, Sashimi Salad, Shrimp and Vegetable Spicy Garlic, and Fish & Chips, then finish with seasonal mochi."
          imageSrc={homeImages.salmon}
          imageAlt="Guest enjoying baked salmon"
          buttonLabel="RESERVE"
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
