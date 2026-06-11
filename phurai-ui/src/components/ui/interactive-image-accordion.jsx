import { useEffect, useRef, useState } from 'react';
import { homeImages } from '@/data/homeAssets';
import '@/styles/unique-experience.css';

const FALLBACK_IMAGE = homeImages.hero;

const accordionItems = [
  { id: 1, title: 'Signature Omakase', imageUrl: homeImages.gallery[0] },
  { id: 2, title: 'Sashimi Artistry', imageUrl: homeImages.gallery[1] },
  { id: 3, title: 'Robata Fire', imageUrl: homeImages.gallery[2] },
  { id: 4, title: 'Wagyu Charcoal', imageUrl: homeImages.gallery[3] },
  { id: 5, title: 'Lobster Tempura', imageUrl: homeImages.gallery[4] },
  { id: 6, title: 'Uni & Caviar', imageUrl: homeImages.gallery[5] },
  { id: 7, title: 'Miso Black Cod', imageUrl: homeImages.gallery[6] },
  { id: 8, title: 'Sake Pairing', imageUrl: homeImages.gallery[7] },
  { id: 9, title: 'Dessert Ritual', imageUrl: homeImages.gallery[8] },
  { id: 10, title: "Chef's Counter", imageUrl: homeImages.gallery[9] },
];

function navigateToMenu() {
  if (window.location.pathname !== '/menus') {
    window.history.pushState(null, '', '/menus');
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}

function AccordionPanel({ item, isActive, onActivate }) {
  const [src, setSrc] = useState(item.imageUrl || FALLBACK_IMAGE);

  return (
    <button
      type="button"
      className={`uxp-panel${isActive ? ' uxp-panel--active' : ''}`}
      onMouseEnter={onActivate}
      onFocus={onActivate}
      onClick={onActivate}
      aria-label={item.title}
      aria-pressed={isActive}
    >
      <img
        className="uxp-panel__img"
        src={src}
        alt=""
        loading="lazy"
        onError={() => {
          if (src !== FALLBACK_IMAGE) setSrc(FALLBACK_IMAGE);
        }}
      />
      <span className="uxp-panel__overlay" aria-hidden="true" />
      <span className="uxp-panel__caption">{item.title}</span>
    </button>
  );
}

export function UniqueExperienceAccordion() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.18 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className={`uxp-section${visible ? ' uxp-section--visible' : ''}`}
      aria-labelledby="uxp-heading"
    >
      <div className="uxp-inner">
        <div className="uxp-text">
         
          <h2 id="uxp-heading" className="uxp-title">
            A UNIQUE EXPERIENCE
          </h2>
          <p className="uxp-desc">
            Discover a symphony of flavors where ancient traditions meet modern artistry.
            Each dish is a curated masterpiece, designed not just to be eaten, but to be felt.
          </p>
          <button type="button" className="uxp-cta" onClick={navigateToMenu}>
            Explore Our Menu
          </button>
        </div>

        <div className="uxp-accordion-wrap">
          <div className="uxp-accordion" role="list">
            {accordionItems.map((item, index) => (
              <AccordionPanel
                key={item.id}
                item={item}
                isActive={index === activeIndex}
                onActivate={() => setActiveIndex(index)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default UniqueExperienceAccordion;
