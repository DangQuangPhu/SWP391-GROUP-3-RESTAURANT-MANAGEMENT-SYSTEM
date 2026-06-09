import takeoutHero from '@/assets/images/takeout/takeout-hero.png';
import takeoutArrow from '@/assets/images/takeout/takeout-arrow.png';
import takeoutPhone from '@/assets/images/takeout/takeout-phone.png';

function TakeOutHero() {
  return (
    <section className="takeout-hero" aria-labelledby="takeout-hero-heading">
      <div className="takeout-hero__image">
        <img src={takeoutHero} alt="Takeout presentation with coffee and plated dishes" />
      </div>

      <div className="takeout-hero__copy">
        <p className="takeout-hero__label" id="takeout-hero-heading">
          ORDER TAKEOUT
        </p>

        <div className="takeout-hero__grid">
          <div className="takeout-hero__group">
            <p className="takeout-hero__line">LUNCH</p>
            <p className="takeout-hero__line">MONDAY – FRIDAY</p>
            <p className="takeout-hero__line">11:30 AM – 2:30 PM</p>
          </div>
          <div className="takeout-hero__group">
            <p className="takeout-hero__line">DINNER</p>
            <p className="takeout-hero__line">SUNDAY – THURSDAY</p>
            <p className="takeout-hero__line">5:00 PM – 10:30 PM</p>
          </div>
          <div className="takeout-hero__group">
            <p className="takeout-hero__line">FRIDAY – SATURDAY</p>
            <p className="takeout-hero__line">5:00 PM – 11:30 PM</p>
          </div>
        </div>

        <div className="takeout-hero__delivery">
          <p className="takeout-hero__delivery-title">FOR DELIVERY:</p>
          <div className="takeout-hero__delivery-links">
            <a className="takeout-hero__delivery-link" href="#ubereats">
              <span>UBEREATS</span>
              <img src={takeoutArrow} alt="" />
            </a>
            <a className="takeout-hero__delivery-link" href="#doordash">
              <span>DOORDASH</span>
              <img src={takeoutArrow} alt="" />
            </a>
          </div>
        </div>

        <p className="takeout-hero__copy-note">
          Place your order from 5:00 PM via apps or call:
        </p>

        <div className="takeout-hero__phone">
          <img src={takeoutPhone} alt="" />
          <a href="tel:+84964813966">+84 964 813 966</a>
        </div>
      </div>
    </section>
  );
}

export default TakeOutHero;
