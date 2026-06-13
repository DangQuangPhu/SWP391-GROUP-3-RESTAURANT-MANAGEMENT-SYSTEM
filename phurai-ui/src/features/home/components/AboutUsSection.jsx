import { useEffect, useRef } from 'react';
import { homeImages } from '../data/homeAssets.js';

const HIGHLIGHTS = [
  'Seasonal Japanese-inspired fine dining',
  'Chef-led tasting menus and signature dishes',
  'Premium seafood, grill, sake, and wine pairings',
  'Private rooms, VIP areas, and rooftop dining',
  'Thoughtful hospitality for every occasion',
];

const STATS = [
  { value: '12+', label: 'Signature Experiences' },
  { value: '2', label: 'Floors of Dining' },
  { value: 'VIP', label: '& Rooftop Spaces' },
  { value: 'Chef', label: 'led Tasting' },
];

function navigateTo(path) {
  if (window.location.pathname !== path) {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
}

function AboutUsSection() {
  const sectionRef = useRef(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('phurai-about--visible');
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="about"
      className="phurai-about"
      aria-labelledby="about-heading"
    >
      {/* Legacy anchor — keeps existing /#reserve links landing on this section */}
      <span id="reserve" className="phurai-about__anchor" aria-hidden="true" />

      <div className="phurai-about__inner">
        <div className="phurai-about__media">
          <div className="phurai-about__image-main">
            <img
              src={homeImages.Abus1}
              alt="Phūrai dining room with warm ambient lighting"
              loading="lazy"
            />
            <span className="phurai-about__image-label">Fine Dining, Reimagined</span>
          </div>
          <div className="phurai-about__image-accent">
            <img
              src={homeImages.Abus2}
              alt="Premium sushi and sashimi presentation"
              loading="lazy"
            />
          </div>
        </div>

        <div className="phurai-about__content">
          <p className="phurai-about__eyebrow">OUR STORY</p>
          <span className="phurai-about__divider" aria-hidden="true" />

          <p className="phurai-about__kicker">ABOUT PHŪRAI</p>
          <h2 id="about-heading" className="phurai-about__headline">
            Where Japanese Tradition Meets Modern Culinary Art
          </h2>

          <p className="phurai-about__lead">
            Phūrai is crafted for guests who seek more than a meal. Inspired by the quiet precision
            of Japanese dining and the warmth of modern hospitality, every detail is designed to feel
            intentional — from the first welcome to the final course.
          </p>
          <p className="phurai-about__body">
            Our kitchen celebrates seasonal ingredients, refined technique, and thoughtful
            presentation. Whether you join us for an intimate dinner, a chef&apos;s tasting journey,
            or a private celebration, Phūrai offers a dining experience shaped by balance,
            atmosphere, and care.
          </p>

          <ul className="phurai-about__highlights">
            {HIGHLIGHTS.map((item, index) => (
              <li
                key={item}
                className="phurai-about__highlight"
                style={{ '--delay': `${index * 0.08}s` }}
              >
                <span className="phurai-about__highlight-mark" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>

          <div className="phurai-about__stats">
            {STATS.map((stat, index) => (
              <div
                key={stat.label}
                className="phurai-about__stat"
                style={{ '--delay': `${0.35 + index * 0.08}s` }}
              >
                <span className="phurai-about__stat-value">{stat.value}</span>
                <span className="phurai-about__stat-label">{stat.label}</span>
              </div>
            ))}
          </div>

          <div className="phurai-about__actions">
            <button
              type="button"
              className="phurai-about__btn phurai-about__btn--primary"
              onClick={() => navigateTo('/menus')}
            >
              Explore Menu
            </button>
            <button
              type="button"
              className="phurai-about__btn phurai-about__btn--outline"
              onClick={() => navigateTo('/reservations')}
            >
              Reserve Your Experience
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default AboutUsSection;
