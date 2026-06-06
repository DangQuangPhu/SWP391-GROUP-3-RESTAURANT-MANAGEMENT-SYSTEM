import { useState } from 'react';

const TIME_SLOTS = [
  '11:30 AM', '12:00 PM', '12:30 PM',
  '1:00 PM',  '6:00 PM',  '6:30 PM',
  '7:00 PM',  '7:30 PM',  '8:00 PM',
  '8:30 PM',  '9:00 PM',  '9:30 PM',
];

const SEAT_OPTIONS = [1, 2, 3, 4, 5, 6, '7+'];

function FloatField({ id, label, type = 'text', name, required }) {
  const [filled, setFilled] = useState(false);
  return (
    <div className={`res-field ${filled ? 'res-field--filled' : ''}`}>
      <input
        id={id}
        type={type}
        name={name}
        placeholder=" "
        required={required}
        onChange={e => setFilled(e.target.value.length > 0)}
      />
      <label htmlFor={id}>{label}</label>
      <span className="res-field__line" />
    </div>
  );
}

function ReservationForm() {
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedSeats, setSelectedSeats] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  return (
    <section className="phurai-res-section" aria-labelledby="reservation-heading">
      {/* ── Decorative top ornament ── */}
      <div className="phurai-res-section__ornament" aria-hidden="true">
        <span className="phurai-res-section__ornament-line" />
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M9 0L10.5 7.5L18 9L10.5 10.5L9 18L7.5 10.5L0 9L7.5 7.5Z" fill="#8c764b"/>
        </svg>
        <span className="phurai-res-section__ornament-line" />
      </div>

      <div className="phurai-res-section__kicker">FINE DINING</div>
      <h2 className="phurai-res-section__heading" id="reservation-heading">
        Reserve Your Table
      </h2>
      <p className="phurai-res-section__sub">
        Join us for an unforgettable evening of exquisite cuisine and impeccable service.
      </p>

      {/* ── Main card ── */}
      <div className="phurai-res-card">

        {/* LEFT — Info panel */}
        <div className="phurai-res-card__info">
          <div className="phurai-res-card__info-inner">
            <div className="phurai-res-card__badge">EXPERIENCE</div>
            <h3 className="phurai-res-card__info-title">An Evening<br/>to Remember</h3>
            <p className="phurai-res-card__info-desc">
              Every reservation includes a complimentary amuse-bouche and personal attention
              from our sommelier team.
            </p>

            <ul className="phurai-res-card__perks">
              <li>
                <span className="phurai-res-card__perk-icon">✦</span>
                <span>Private dining rooms available</span>
              </li>
              <li>
                <span className="phurai-res-card__perk-icon">✦</span>
                <span>Chef's tasting menu on request</span>
              </li>
              <li>
                <span className="phurai-res-card__perk-icon">✦</span>
                <span>Curated wine & sake pairings</span>
              </li>
              <li>
                <span className="phurai-res-card__perk-icon">✦</span>
                <span>Dietary needs accommodated</span>
              </li>
            </ul>

            <div className="phurai-res-card__hours">
              <div className="phurai-res-card__hours-row">
                <span>Mon – Thu</span><span>11:30 AM – 10:00 PM</span>
              </div>
              <div className="phurai-res-card__hours-row">
                <span>Fri – Sat</span><span>11:30 AM – 11:00 PM</span>
              </div>
              <div className="phurai-res-card__hours-row">
                <span>Sunday</span><span>12:00 PM – 9:00 PM</span>
              </div>
            </div>

            <a href="tel:+18001234567" className="phurai-res-card__phone">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.5a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.69h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.26A16 16 0 0 0 13.74 16l.94-.94a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              +1 (800) 123-4567
            </a>
          </div>

          {/* Gold corner accent */}
          <div className="phurai-res-card__corner" aria-hidden="true" />
        </div>

        {/* RIGHT — Form */}
        <div className="phurai-res-card__form-wrap">
          <form className="phurai-res-form" onSubmit={e => e.preventDefault()} noValidate>

            <div className="phurai-res-form__row">
              <FloatField id="res-name"  label="Full Name"     name="name"  required />
              <FloatField id="res-phone" label="Phone Number"  name="phone" type="tel" required />
            </div>

            <FloatField id="res-email" label="Email Address" name="email" type="email" required />

            {/* Date picker */}
            <div className="res-field res-field--date">
              <input
                id="res-date"
                type="date"
                name="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                placeholder=" "
              />
              <label htmlFor="res-date">Preferred Date</label>
              <span className="res-field__line" />
            </div>

            {/* Time slots */}
            <div className="phurai-res-form__section-label">Select Time</div>
            <div className="phurai-res-slots" role="group" aria-label="Time slots">
              {TIME_SLOTS.map(t => (
                <button
                  key={t}
                  type="button"
                  className={`phurai-res-slot ${selectedTime === t ? 'phurai-res-slot--active' : ''}`}
                  onClick={() => setSelectedTime(t)}
                  aria-pressed={selectedTime === t}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Guest count */}
            <div className="phurai-res-form__section-label">Number of Guests</div>
            <div className="phurai-res-seats" role="group" aria-label="Number of guests">
              {SEAT_OPTIONS.map(s => (
                <button
                  key={s}
                  type="button"
                  className={`phurai-res-seat ${selectedSeats === String(s) ? 'phurai-res-seat--active' : ''}`}
                  onClick={() => setSelectedSeats(String(s))}
                  aria-pressed={selectedSeats === String(s)}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Special requests */}
            <div className="res-field res-field--textarea">
              <textarea id="res-msg" name="message" rows={4} placeholder=" " />
              <label htmlFor="res-msg">Special Requests or Allergies</label>
              <span className="res-field__line" />
            </div>

            <button type="submit" className="phurai-res-form__submit">
              <span>Confirm Reservation</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>

            <p className="phurai-res-form__note">
              We'll confirm your reservation within 2 hours. For same-day bookings, please call us.
            </p>
          </form>
        </div>
      </div>

      {/* ── Footer contact line ── */}
      <div className="phurai-res-section__contact">
        <span className="phurai-res-section__contact-line" />
        <span>RESERVATIONS@PHURAI.COM</span>
        <span className="phurai-res-section__contact-dot" aria-hidden="true">✦</span>
        <span>+1 (800) 123-4567</span>
        <span className="phurai-res-section__contact-line" />
      </div>
    </section>
  );
}

export default ReservationForm;
