import { useRef } from "react";
import heroImage from "../../assets/images/contact-hours/contact-hero.jpg";
import mapImage from "../../assets/images/contact-hours/contact-map.jpg";
import atmosphereImage from "../../assets/images/contact-hours/contact-atmosphere.jpg";
import "../../styles/contactHours.css";

function HoursColumn({ title, blocks }) {
  return (
    <div className="contact-hours-hours__column">
      <h3>{title}</h3>
      {blocks.map((block) => (
        <div className="contact-hours-hours__block" key={block.label}>
          <p className="contact-hours-hours__label">{block.label}</p>
          {block.lines.map((line) => (
            <p className="contact-hours-hours__line" key={line}>
              {line}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

function ContactHours() {
  const hoursRef = useRef(null);

  const scrollToHours = () => {
    hoursRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  };

  return (
    <main className="contact-hours-page">
      <section className="contact-hours-hero" aria-label="Contact and hours hero">
        <img
          className="contact-hours-hero__image"
          src={heroImage}
          alt="Phūrai sashimi platter"
        />
        <div className="contact-hours-hero__overlay">
          <div className="contact-hours-hero__card">
            <span className="contact-hours-hero__dash" aria-hidden="true" />
            <h1 className="contact-hours-hero__title">
              CONTACT &amp;
              <br />
              HOURS
            </h1>
            <button
              type="button"
              className="contact-hours-hero__cta"
              onClick={scrollToHours}
            >
              REGULAR HOURS
            </button>
          </div>
        </div>
      </section>

      <section
        id="contact-hours-regular"
        ref={hoursRef}
        className="contact-hours-regular"
        aria-labelledby="contact-hours-regular-title"
      >
        <div className="contact-hours-regular__inner">
          <h2 id="contact-hours-regular-title">REGULAR HOURS</h2>
          <div className="contact-hours-hours__grid">
            <HoursColumn
              title="DINING ROOM"
              blocks={[
                {
                  label: "Lunch",
                  lines: ["Monday – Friday", "11:45am – 2:15pm"],
                },
                {
                  label: "Dinner",
                  lines: [
                    "Sunday – Thursday",
                    "5:30pm – 9:45pm",
                    "Friday and Saturday",
                    "5:30pm – 10:45pm",
                  ],
                },
              ]}
            />
            <HoursColumn
              title="BAR LOUNGE"
              blocks={[
                {
                  label: "Dinner",
                  lines: [
                    "Sunday – Thursday",
                    "5:00pm – 10:30pm",
                    "Friday and Saturday",
                    "5:00pm – 11:30pm",
                  ],
                },
              ]}
            />
            <HoursColumn
              title="TAKEOUT HOURS"
              blocks={[
                {
                  label: "Lunch",
                  lines: ["Monday – Friday", "11:30am – 2:30pm"],
                },
                {
                  label: "Dinner",
                  lines: [
                    "Sunday – Thursday",
                    "5:00pm – 10:30pm",
                    "Friday and Saturday",
                    "5:00pm – 11:30pm",
                  ],
                },
              ]}
            />
          </div>
        </div>
      </section>

      <section className="contact-hours-info" aria-label="Contact information">
        <div className="contact-hours-info__inner">
          <div className="contact-hours-info__left">
            <div className="contact-hours-info__map">
              <img src={mapImage} alt="Map showing Phūrai location" />
            </div>
            <div className="contact-hours-info__details">
              <div className="contact-hours-info__detail">
                <h3>ADDRESS</h3>
                <p className="contact-hours-info__meta">Kyoto Downtown</p>
                <p className="contact-hours-info__text">
                  128 Zen Garden Ave
                  <br />
                  Kyoto, Japan 604-8001
                </p>
                <button type="button" className="contact-hours-info__btn">
                  DIRECTIONS
                </button>
              </div>
              <div className="contact-hours-info__detail">
                <h3>CONTACT</h3>
                <p className="contact-hours-info__text">+81 (75) 000-0000</p>
                <button type="button" className="contact-hours-info__btn">
                  EMAIL
                </button>
              </div>
            </div>
          </div>

          <div className="contact-hours-info__right">
            <div className="contact-hours-info__card">
              <h3>PRESS INQUIRIES</h3>
              <button type="button" className="contact-hours-info__btn">
                EMAIL
              </button>
            </div>
            <div className="contact-hours-info__card">
              <h3>
                REQUEST RECEIPT
                <br />
                COPY
              </h3>
              <button type="button" className="contact-hours-info__btn">
                CLICK HERE TO REQUEST
              </button>
            </div>
            <div className="contact-hours-info__atmosphere">
              <img src={atmosphereImage} alt="Phūrai dining atmosphere" />
            </div>
          </div>
        </div>
      </section>

      <section className="contact-hours-top">
        <button type="button" className="contact-hours-top__btn" onClick={scrollToTop}>
          Go to top
        </button>
      </section>
    </main>
  );
}

export default ContactHours;
