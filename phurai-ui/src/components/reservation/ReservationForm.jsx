import SectionHeader from '../common/SectionHeader';
import OutlineButton from '../common/OutlineButton';
import { homeIcons } from '../../data/homeAssets';

function ReservationForm() {
  return (
    <section className="phurai-reservation" aria-labelledby="reservation-heading">
      <SectionHeader title="RESERVE YOUR TABLE" />

      <form className="phurai-reservation__form" onSubmit={(e) => e.preventDefault()}>
        <div className="phurai-reservation__row">
          <label className="phurai-field">
            <span className="phurai-field__label">Name</span>
            <input type="text" name="name" placeholder="Name" />
          </label>
          <label className="phurai-field">
            <span className="phurai-field__label">Phone</span>
            <input type="tel" name="phone" placeholder="Phone" />
          </label>
        </div>

        <div className="phurai-reservation__row">
          <label className="phurai-field">
            <span className="phurai-field__label">Email</span>
            <input type="email" name="email" placeholder="Email" />
          </label>
          <label className="phurai-field">
            <span className="phurai-field__label">Date</span>
            <input type="text" name="date" placeholder="Date (dd/mm/yy)" />
          </label>
        </div>

        <div className="phurai-reservation__row">
          <label className="phurai-field phurai-field--select">
            <span className="phurai-field__label">Time</span>
            <select name="time" defaultValue="">
              <option value="" disabled>
                Time
              </option>
              <option value="18:00">6:00 PM</option>
              <option value="19:00">7:00 PM</option>
              <option value="20:00">8:00 PM</option>
            </select>
            <img src={homeIcons.chevron} alt="" className="phurai-field__chevron" aria-hidden="true" />
          </label>
          <label className="phurai-field phurai-field--select">
            <span className="phurai-field__label">Seats</span>
            <select name="seats" defaultValue="">
              <option value="" disabled>
                Seats
              </option>
              <option value="2">2</option>
              <option value="4">4</option>
              <option value="6">6</option>
            </select>
            <img src={homeIcons.chevron} alt="" className="phurai-field__chevron" aria-hidden="true" />
          </label>
        </div>

        <label className="phurai-field phurai-field--full">
          <span className="phurai-field__label">Message</span>
          <textarea
            name="message"
            rows={5}
            placeholder="Message (Special requests, allergies...)"
          />
        </label>

        <OutlineButton className="phurai-reservation__submit">BOOK TABLE</OutlineButton>
      </form>

      <div className="phurai-reservation__footer-note">
        <p>
          For parties larger than 6 or special event inquiries, please contact our concierge
          directly.
        </p>
        <span className="phurai-reservation__footer-divider" aria-hidden="true" />
        <p className="phurai-reservation__email">RESERVATIONS@PHURAI.COM</p>
      </div>
    </section>
  );
}

export default ReservationForm;
