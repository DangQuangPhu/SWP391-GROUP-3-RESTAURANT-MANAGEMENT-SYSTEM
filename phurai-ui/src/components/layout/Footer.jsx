import { homeIcons } from '@/features/home';

const exploreLinks = ['Home', 'About Us', 'Our Menu', 'Gallery', 'Reservations'];
const serviceLinks = [
  'Private Dining',
  'Catering',
  'Event Hosting',
  'Gift Cards',
  'Loyalty Program',
];

const socialLinks = [
  { label: 'Instagram', icon: homeIcons.socialInstagram },
  { label: 'Facebook', icon: homeIcons.socialFacebook },
  { label: 'Twitter', icon: homeIcons.socialTwitter },
  { label: 'YouTube', icon: homeIcons.socialYoutube },
];

function Footer() {
  return (
    <footer className="phurai-footer">
      <p className="phurai-footer__watermark" aria-hidden="true">
        Phūrai
      </p>

      <div className="phurai-footer__grid">
        <div className="phurai-footer__brand">
          <p className="phurai-footer__logo">Phūrai</p>
          <p>
            Delivering exceptional culinary experiences since 2010. Our commitment to quality,
            service, and ambiance has made us a beloved destination for food lovers.
          </p>
          <div className="phurai-footer__social">
            <a href="#" aria-label="Instagram" className="social-link">
              <img src={homeIcons.socialInstagram} alt="" className="social-icon" />
            </a>

            <a href="#" aria-label="Facebook" className="social-link">
              <img src={homeIcons.socialFacebook} alt="" className="social-icon" />
            </a>

            <a href="#" aria-label="Twitter" className="social-link">
              <img src={homeIcons.socialTwitter} alt="" className="social-icon" />
            </a>

            <a href="#" aria-label="YouTube" className="social-link">
              <img src={homeIcons.socialYoutube} alt="" className="social-icon" />
            </a>
          </div>
        </div>

        <div>
          <h3>EXPLORE</h3>
          <ul>
            {exploreLinks.map((link) => (
              <li key={link}>
                <a href="#">{link}</a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3>SERVICES</h3>
          <ul>
            {serviceLinks.map((link) => (
              <li key={link}>
                <a href="#">{link}</a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3>OPENING HOURS</h3>
          <dl className="phurai-footer__hours">
            <div>
              <dt>Mon — Thu</dt>
              <dd>7:00 AM — 12:00 PM</dd>
            </div>
            <div>
              <dt>Fri — Sat</dt>
              <dd>7:00 AM — 12:00 PM</dd>
            </div>
            <div>
              <dt>Sunday</dt>
              <dd>7 PM — 10:00 PM</dd>
            </div>
            <div className="phurai-footer__happy-hour">
              <dt>Happy Hour</dt>
              <dd>4:00 PM — 7:00 PM Daily</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="phurai-footer__contact-bar">
        <p>
          <img src={homeIcons.location} alt="" className="contact-icon" />
          45 Admiralty Way, Lekki Phase 1, Lagos
        </p>
        <p>
          <img src={homeIcons.phone} alt="" className="contact-icon" />
          +84 964 813 966
        </p>
        <p>
          <img src={homeIcons.email} alt="" className="contact-icon" />
          quagphu159@gmail.com
        </p>
      </div>

      <nav className="phurai-footer__legal" aria-label="Legal">
        <a href="#">MENU</a>
        <a href="#">ABOUT</a>
        <a href="#">CONTRACT</a>
        <a href="#">PRIVACY POLICY</a>
        <a href="#">TERMS OF SERVICE</a>
      </nav>

      <p className="phurai-footer__copyright">© 2026 PHŪRAI. ALL RIGHTS RESERVED.</p>
    </footer>
  );
}

export default Footer;
