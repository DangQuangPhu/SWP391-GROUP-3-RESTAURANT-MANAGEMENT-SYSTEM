import { useState, useEffect } from "react";
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
  { label: "Private Dining", to: "/private-events" },
  { label: "Catering", to: "/catering" },
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
  const [settings, setSettings] = useState({
    restaurant_name: "Phūrai",
    restaurant_address: "",
    restaurant_phone: "",
    restaurant_email: "",
    hours_mon_thu: "7:00 AM — 12:00 AM",
    hours_fri_sat: "7:00 AM — 12:00 AM",
    hours_sunday: "7:00 PM — 10:00 PM",
    hours_happy: "4:00 PM — 7:00 PM Daily",
    closed_days: ""
  });

  const format12hTimeRange = (openTime, closeTime) => {
    if (!openTime || !closeTime || !openTime.includes(":") || !closeTime.includes(":")) return null;
    const to12h = (tStr) => {
      let [h, m] = tStr.split(":").map(Number);
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
    };
    return `${to12h(openTime)} — ${to12h(closeTime)}`;
  };

  const loadFooterSettings = async () => {
    try {
      const res = await fetch('/api/reservations/settings');
      const data = await res.json();
      if (data?.success && data?.settings) {
        const s = data.settings;
        const autoRange = format12hTimeRange(s.open_time, s.close_time);

        setSettings({
          restaurant_name: s.restaurant_name || "Phūrai",
          restaurant_address: s.restaurant_address || "",
          restaurant_phone: s.restaurant_phone || "",
          restaurant_email: s.restaurant_email || "",
          open_time: s.open_time,
          close_time: s.close_time,
          hours_mon_thu: s.hours_mon_thu || autoRange || "10:00 AM — 10:00 PM",
          hours_fri_sat: s.hours_fri_sat || autoRange || "7:00 AM — 12:00 AM",
          hours_sunday: s.hours_sunday || "7:00 PM — 10:00 PM",
          hours_happy: s.hours_happy || "4:00 PM — 7:00 PM Daily",
          closed_days: s.closed_days || ""
        });
      }
    } catch {
      // Fallback to default state
    }
  };

  useEffect(() => {
    loadFooterSettings();
    const handleUpdate = () => loadFooterSettings();
    window.addEventListener("phurai_settings_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("phurai_settings_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const isClosed = (dayName) => {
    if (!settings.closed_days) return false;
    return settings.closed_days.toLowerCase().includes(dayName.toLowerCase());
  };

  return (
    <footer className="phurai-footer">
      <p className="phurai-footer__watermark" aria-hidden="true">
        {settings.restaurant_name}
      </p>

      <div className="phurai-footer__grid">
        <div className="phurai-footer__brand">
          <p className="phurai-footer__logo">{settings.restaurant_name}</p>
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
              <dd>{isClosed("Mon") || isClosed("Thu") ? "CLOSED (Ngày nghỉ)" : settings.hours_mon_thu}</dd>
            </div>
            <div>
              <dt>Fri — Sat</dt>
              <dd>{isClosed("Fri") || isClosed("Sat") ? "CLOSED (Ngày nghỉ)" : settings.hours_fri_sat}</dd>
            </div>
            <div>
              <dt>Sunday</dt>
              <dd>{isClosed("Sunday") ? "CLOSED (Ngày nghỉ)" : settings.hours_sunday}</dd>
            </div>
            <div className="phurai-footer__happy-hour">
              <dt>Happy Hour</dt>
              <dd>{settings.hours_happy}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="phurai-footer__contact-bar">
        {settings.restaurant_address && (
          <p>
            <img src={homeIcons.location} alt="" className="contact-icon" />
            {settings.restaurant_address}
          </p>
        )}
        {settings.restaurant_phone && (
          <p>
            <img src={homeIcons.phone} alt="" className="contact-icon" />
            <a href={`tel:${settings.restaurant_phone.replace(/\s/g, "")}`}>{settings.restaurant_phone}</a>
          </p>
        )}
        {settings.restaurant_email && (
          <p>
            <img src={homeIcons.email} alt="" className="contact-icon" />
            <a href={`mailto:${settings.restaurant_email}`}>{settings.restaurant_email}</a>
          </p>
        )}
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
