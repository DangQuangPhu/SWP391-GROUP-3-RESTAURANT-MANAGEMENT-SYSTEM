import { Link } from "react-router-dom";
import { homeImages } from '../data/homeAssets.js';
import { useScrollReveal } from '@/hooks/useScrollReveal';

function GiftCardSection() {
  const revealRef = useScrollReveal();

  return (
    <section className="phurai-gift home-reveal-parent" aria-labelledby="gift-heading" ref={revealRef}>
      <div className="phurai-gift__content">
        <h2 id="gift-heading" className="home-reveal-child">GIVE THE GIFT OF Phūrai</h2>
        <p className="home-reveal-child home-reveal-child--delay-1">
          Our Phūrai Giftcards are perfect for any <strong>occasion</strong>.
        </p>
        <div className="home-reveal-child home-reveal-child--delay-2">
          <Link to="/gift-cards" className="phurai-btn-outline phurai-gift__explore-link">
            EXPLORE
          </Link>
        </div>
      </div>
      <div className="phurai-gift__media home-reveal-child home-reveal-child--delay-3">
        <img src={homeImages.giftCard} alt="Phūrai gift card" />
      </div>
    </section>
  );
}

export default GiftCardSection;
