import { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import HeroSection from '../components/HeroSection.jsx';
import SignatureDishCarousel from '../components/SignatureDishCarousel.jsx';
import OfferingBlock from '../components/OfferingBlock.jsx';
import KitchenSecretsSection from '../components/KitchenSecretsSection.jsx';
import GiftCardSection from '../components/GiftCardSection.jsx';
import { UniqueExperienceAccordion } from '@/components/ui/interactive-image-accordion';
import RolledPerfectionSection from '../components/RolledPerfectionSection.jsx';
import TestimonialsSection from '../components/TestimonialsSection.jsx';
import AboutUsSection from '../components/AboutUsSection.jsx';
import CinematicIntro from '@/components/ui/CinematicIntro.jsx';
import { homeImages } from '../data/homeAssets.js';
import '../styles/home.css';

/**
 * Intro timing (all in ms, aligned with CinematicIntro.jsx constants):
 *
 *  0    — Overlay appears. "Hello" shows.
 *  800  — Word cycle starts: Warm · Crafted · Refined
 *  2260 — "Phūrai" appears
 *  2940 — Arc curtain begins rising
 *  4040 — Arc done → overlay starts fade out
 *  4420 — Overlay gone. navbar slides in. video starts.
 *
 *  TOTAL visible intro: ~4.4s
 *
 *  T_DONE (below): when onDone fires from CinematicIntro
 *  We give HOME 380ms of overlap so content starts appearing
 *  just as the last pixels of arc clear the screen.
 */

// sessionStorage key — only plays once per browser session
const STORAGE_KEY = 'phurai_intro_seen';

function Home() {
  const location  = useLocation();
  const seenIntro = () => !!sessionStorage.getItem(STORAGE_KEY);

  const [showIntro, setShowIntro] = useState(() => !seenIntro());
  const [revealUI, setRevealUI]   = useState(() => seenIntro());

  // Called by CinematicIntro when arc animation completes
  const handleIntroDone = useCallback(() => {
    sessionStorage.setItem(STORAGE_KEY, 'true');
    setShowIntro(false);
    // Slight stagger — let overlay fully fade before enabling scroll / nav
    setTimeout(() => {
      setRevealUI(true);
      document.body.classList.remove('intro-running');
    }, 420);
  }, []);

  useEffect(() => {
    if (!seenIntro()) {
      document.body.classList.add('intro-running');
      // Safety fallback: if intro never calls onDone (e.g. framer-motion blocked)
      // New intro total ≈ 4.7s: Hello(0.78) + Welcome(0.93) + To(0.56) + Phūrai(1.13) + arc(0.85) + exit(0.5)
      const fallback = setTimeout(() => {
        handleIntroDone();
      }, 7000);
      return () => {
        clearTimeout(fallback);
        document.body.classList.remove('intro-running');
      };
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to #about section when hash changes
  useEffect(() => {
    if (location.hash !== '#about') return undefined;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    const timer = window.setTimeout(() => {
      document.getElementById('about-section')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 100);
    return () => window.clearTimeout(timer);
  }, [location.pathname, location.hash]);

  return (
    <>
      <AnimatePresence>
        {showIntro && (
          <CinematicIntro key="intro" onDone={handleIntroDone} />
        )}
      </AnimatePresence>

      <div className="phurai-home">
        <div className="phurai-home__header-wrap">
          <HeroSection
            isRevealReady={revealUI}
            isVideoPlaying={!showIntro}
          />
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
    </>
  );
}

export default Home;
