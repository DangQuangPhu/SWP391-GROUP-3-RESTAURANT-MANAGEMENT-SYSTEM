import OutlineButton from '@/components/common/OutlineButton';
import { homeImages } from '@/data/homeAssets';
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
          <OutlineButton>EXPLORE</OutlineButton>
        </div>
      </div>
      <div className="phurai-gift__media home-reveal-child home-reveal-child--delay-3">
        <img src={homeImages.giftCard} alt="Phūrai gift card" />
      </div>
    </section>
  );
}

export default GiftCardSection;
