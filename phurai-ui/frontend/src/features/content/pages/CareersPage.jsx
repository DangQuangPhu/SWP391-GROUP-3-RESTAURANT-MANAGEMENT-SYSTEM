import { useRef } from "react";
import heroImage from "@/assets/images/careers/careers-hero.jpg";
import principlesImage from "@/assets/images/careers/careers-principles.jpg";
import chefsImage from "@/assets/images/careers/careers-chefs.jpg";
import teamImage from "@/assets/images/careers/careers-team.jpg";
import barbackImage from "@/assets/images/careers/careers-position-barback.jpg";
import hostessImage from "@/assets/images/careers/careers-position-hostess.jpg";
import busserImage from "@/assets/images/careers/careers-position-busser.jpg";
import "../styles/careers.css";

const positions = [
  {
    title: "DISPENSE BARBACK",
    description:
      "Three day training. Pay Rate $17.50 per hour. After pass training, $21–24 per hour. These are non-tipped positions with growth opportunities.",
    image: barbackImage,
    imageAlt: "Cocktails at the Phūrai bar",
  },
  {
    title: "HOST/HOSTESS",
    description:
      "$17.50/hr to train. After pass training, $21–23.00/hr. Requires 1+ years' experience. Upscale, fast-paced hospitality required.",
    image: hostessImage,
    imageAlt: "Phūrai restaurant interior",
  },
  {
    title: "BUSSER",
    description:
      "$17.50/hr to train. After pass training, $11.35/hr plus tips. Requires 1+ years' experience. Upscale dining experience preferred.",
    image: busserImage,
    imageAlt: "Table setting at Phūrai",
  },
];

function scrollToPositions(positionsRef) {
  positionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function Careers() {
  const positionsRef = useRef(null);

  const handlePositionsClick = () => {
    scrollToPositions(positionsRef);
  };

  return (
    <main className="careers-page">
      <section className="careers-hero" aria-label="Careers hero">
        <img
          className="careers-hero__image"
          src={heroImage}
          alt="Chefs working in the Phūrai kitchen"
        />
        <div className="careers-hero__overlay">
          <div className="careers-hero__card">
            <span className="careers-hero__dash" aria-hidden="true" />
            <h1 className="careers-hero__title">
              JOIN PHŪRAI&apos;S
              <br />
              EXCEPTIONAL
              <br />
              TEAM
            </h1>
            <button
              type="button"
              className="careers-hero__cta"
              onClick={handlePositionsClick}
            >
              AVAILABLE POSITIONS
            </button>
          </div>
        </div>
      </section>

      <section className="careers-quote" aria-label="Careers introduction">
        <p className="careers-quote__label">Careers</p>
        <p className="careers-quote__brand">PHŪRAI</p>
      </section>

      <section className="careers-principles">
        <div className="careers-principles__grid">
          <div className="careers-principles__media">
            <img src={principlesImage} alt="Phūrai interior detail" />
          </div>
          <div className="careers-principles__copy">
            <h2>PRINCIPLES</h2>
            <p>
              At Phūrai, our success hinges on upholding essential principles,
              notably a dedication to maintaining quality and consistency in our
              dishes. Embracing guiding values like simplicity and efficiency is
              equally pivotal in our pursuit of success.
            </p>
            <p>
              Moreover, the Phūrai team prioritizes hospitality, striving to craft
              unforgettable dining experiences for our valued guests.
            </p>
          </div>
        </div>
      </section>

      <section className="careers-path">
        <div className="careers-path__grid">
          <div className="careers-path__copy">
            <h2>CAREER PATH</h2>
            <p>
              Our team members are key to our success. At Phūrai, we celebrate your
              hard work and positive attitude with growth potential. Watch our journey
              to learn how some members from our corporate team advanced to their
              positions. Take the next step in your career with us!
            </p>
          </div>
          <div className="careers-path__media">
            <img src={chefsImage} alt="Phūrai chef team" />
          </div>
        </div>
      </section>

      <section className="careers-culture">
        <div className="careers-culture__grid">
          <div className="careers-culture__media">
            <img src={teamImage} alt="Phūrai staff team" />
          </div>
          <div className="careers-culture__copy">
            <h2>
              CULTURE &amp;
              <br />
              SUPPORT
            </h2>
            <p>
              The culture at Phūrai is characterized by a dedication to excellence
              in culinary craftsmanship and providing exceptional dining experiences.
              Teamwork is paramount.
            </p>
            <p>
              Phūrai provides various forms of support including Training and
              Development, Medical, Dental, Vision Insurance, 401K, commuter
              benefits, and more.
            </p>
          </div>
        </div>
      </section>

      <section
        id="careers-positions"
        ref={positionsRef}
        className="careers-positions"
        aria-label="Available positions"
      >
        <h2>AVAILABLE POSITIONS</h2>
        <div className="careers-positions__grid">
          {positions.map((position) => (
            <article className="careers-position-card" key={position.title}>
              <div className="careers-position-card__media">
                <img src={position.image} alt={position.imageAlt} />
              </div>
              <div className="careers-position-card__body">
                <h3>{position.title}</h3>
                <p>{position.description}</p>
                <button type="button" className="careers-position-card__cta">
                  MORE INFORMATION
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default Careers;
