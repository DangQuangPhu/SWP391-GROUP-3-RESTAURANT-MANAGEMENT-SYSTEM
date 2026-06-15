import { Link } from "react-router-dom";
import { homeIcons } from "@/features/home";

const exploreLinks = [
  { label: "Home", to: "/" },
  { label: "About Us", to: "/#about" },
  { label: "Our Menu", to: "/menus" },
  { label: "Gallery", to: "#" },
  { label: "Reservations", to: "/reservations" },
];

const serviceLinks = [
  { label: "Private Dining", to: "#" },
  { label: "Catering", to: "#" },
  { label: "Event Hosting", to: "#" },
  { label: "Gift Cards", to: "/gift-cards" },
  { label: "Loyalty Program", to: "#" },
];

const legalLinks = [
  { label: "MENU", to: "/menus" },
  { label: "ABOUT", to: "/#about" },
  { label: "CONTRACT", to: "/contact-hours" },
  { label: "PRIVACY POLICY", to: "#" },
  { label: "TERMS OF SERVICE", to: "#" },
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
              <li key={link.label}>
                <Link to={link.to}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3>SERVICES</h3>
          <ul>
            {serviceLinks.map((link) => (
              <li key={link.label}>
                <Link to={link.to}>{link.label}</Link>
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
          <a href="tel:+84964813966">+84 964 813 966</a>
        </p>
        <p>
          <img src={homeIcons.email} alt="" className="contact-icon" />
          <a href="mailto:quagphu159@gmail.com">quagphu159@gmail.com</a>
        </p>
      </div>

      <nav className="phurai-footer__legal" aria-label="Legal">
        {legalLinks.map((link) => (
          <Link key={link.label} to={link.to}>
            {link.label}
          </Link>
        ))}
      </nav>

      <p className="phurai-footer__copyright">© 2026 PHŪRAI. ALL RIGHTS RESERVED.</p>
    </footer>
  );
}

export default Footer;
