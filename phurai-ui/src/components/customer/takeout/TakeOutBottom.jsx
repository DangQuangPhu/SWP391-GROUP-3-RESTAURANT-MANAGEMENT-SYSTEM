import takeoutArrow from '../../../assets/images/takeout/takeout-arrow.png';
import takeoutPhone from '../../../assets/images/takeout/takeout-phone.png';

function TakeOutBottom() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <section className="takeout-note" aria-labelledby="takeout-note-heading">
        <div className="takeout-note__container">
          <p className="takeout-note__label" id="takeout-note-heading">
            NOTE:
          </p>
          <p className="takeout-note__text">
            ALL RAW FISH ITEMS MUST BE CONSUMED WITHIN AN HOUR OF PICK-UP. CONSUMING RAW OR
            UNDERCOOKED MEATS, POULTRY, SEAFOOD OR EGGS MAY INCREASE YOUR RISK OF FOOD-BORNE
            ILLNESS.
          </p>
          <button type="button" className="takeout-note__top-link" onClick={scrollToTop}>
            GO TO TOP
          </button>
        </div>
      </section>

      <section className="takeout-order" aria-labelledby="takeout-order-heading">
        <h2 className="takeout-order__heading" id="takeout-order-heading">
          ORDER TAKEOUT
        </h2>
        <div className="takeout-order__group">
          <p className="takeout-order__title">LUNCH</p>
          <p className="takeout-order__time">MONDAY - FRIDAY 11:30 AM - 2:30 PM</p>
        </div>
        <div className="takeout-order__group">
          <p className="takeout-order__title">DINNER</p>
          <p className="takeout-order__time">SUNDAY - THURSDAY 5:00 PM - 10:30 PM</p>
          <p className="takeout-order__time">FRIDAY - SATURDAY 5:00 PM - 11:30 PM</p>
        </div>
      </section>

      <section className="takeout-contact" aria-label="Takeout contact and delivery">
        <div className="takeout-contact__delivery">
          <span className="takeout-contact__label">FOR DELIVERY</span>
          <a className="takeout-contact__link" href="#ubereats">
            <span>UBEREATS</span>
            <img src={takeoutArrow} alt="" />
          </a>
          <a className="takeout-contact__link" href="#doordash">
            <span>DOORDASH</span>
            <img src={takeoutArrow} alt="" />
          </a>
        </div>
        <div className="takeout-contact__call">
          <span>PLACE YOUR ORDER FROM 5:00 PM VIA APPS OR CALL:</span>
          <div>
            <img src={takeoutPhone} alt="" />
            <a href="tel:+84964813966">+84 964 813 966</a>
          </div>
        </div>
      </section>
    </>
  );
}

export default TakeOutBottom;
