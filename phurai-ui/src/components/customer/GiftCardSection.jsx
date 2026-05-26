import OutlineButton from '../common/OutlineButton';
import { homeImages } from '../../data/homeAssets';

function GiftCardSection() {
  return (
    <section className="phurai-gift" aria-labelledby="gift-heading">
      <div className="phurai-gift__content">
        <h2 id="gift-heading">GIVE THE GIFT OF Phūrai</h2>
        <p>
          Our Phūrai Giftcards are perfect for any <strong>occasion</strong>.
        </p>
        <OutlineButton>EXPLORE</OutlineButton>
      </div>
      <div className="phurai-gift__media">
        <img src={homeImages.giftCard} alt="Phūrai gift card" />
      </div>
    </section>
  );
}

export default GiftCardSection;
