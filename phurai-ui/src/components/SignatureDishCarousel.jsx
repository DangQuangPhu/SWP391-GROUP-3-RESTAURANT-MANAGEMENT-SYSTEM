import { useEffect, useRef, useState } from 'react';
import OutlineButton from './common/OutlineButton';
import './SignatureDishCarousel.css';

const CARDS = [
  {
    id: 'spring-tasting',
    eyebrow: 'SIGNATURE',
    title: 'Spring tasting menu sushi platter',
    description:
      'A curated selection of seasonal sushi, sashimi, and refined Phūrai signatures.',
    buttonLabel: 'RESERVE',
  },
  {
    id: 'placeholder-2',
    eyebrow: 'SIGNATURE',
    title: 'Chef’s selection nigiri flight',
    description: 'Placeholder copy for a second signature dish card. Replace with final content.',
    buttonLabel: 'RESERVE',
  },
  {
    id: 'placeholder-3',
    eyebrow: 'SIGNATURE',
    title: 'Seasonal omakase experience',
    description: 'Placeholder copy for a third signature dish card. Replace with final content.',
    buttonLabel: 'RESERVE',
  },
];

const SCROLL_DURATION_MS = 1000;

function SignatureDishCarousel() {
  const sectionRef = useRef(null);
  const trackRef = useRef(null);
  const animationFrameRef = useRef(null);
  const isAnimatingRef = useRef(false);
  const activeIndexRef = useRef(0);
  const [isInView, setIsInView] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const getTargetScrollLeft = (index) => {
    const track = trackRef.current;
    if (!track) return 0;

    const card = track.children[index];
    if (!card) return track.scrollLeft;

    return card.offsetLeft - (track.clientWidth - card.clientWidth) / 2;
  };

  const centerCardInstantly = (index) => {
    const track = trackRef.current;
    if (!track) return;

    const targetLeft = getTargetScrollLeft(index);
    track.scrollLeft = targetLeft;
    activeIndexRef.current = index;
    setActiveIndex(index);
  };

  const animateScrollTo = (targetLeft, duration = SCROLL_DURATION_MS, onComplete) => {
    const track = trackRef.current;
    if (!track) return;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    isAnimatingRef.current = true;
    track.classList.add('signature-dish-carousel__track--animating');

    const startLeft = track.scrollLeft;
    const distance = targetLeft - startLeft;
    const startTime = performance.now();

    const easeInOutCubic = (t) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeInOutCubic(progress);

      track.scrollLeft = startLeft + distance * easedProgress;

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        track.scrollLeft = targetLeft;
        isAnimatingRef.current = false;
        animationFrameRef.current = null;
        track.classList.remove('signature-dish-carousel__track--animating');

        if (typeof onComplete === 'function') {
          onComplete();
        }
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  };

  const scrollToCard = (index) => {
    if (isAnimatingRef.current) return;

    const safeIndex = Math.max(0, Math.min(index, CARDS.length - 1));
    if (safeIndex === activeIndexRef.current) return;

    const targetLeft = getTargetScrollLeft(safeIndex);

    animateScrollTo(targetLeft, SCROLL_DURATION_MS, () => {
      activeIndexRef.current = safeIndex;
      setActiveIndex(safeIndex);
    });
  };

  const goNext = () => {
    scrollToCard(activeIndexRef.current + 1);
  };

  const goPrev = () => {
    scrollToCard(activeIndexRef.current - 1);
  };

  useEffect(() => {
    requestAnimationFrame(() => {
      centerCardInstantly(0);
    });

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { threshold: 0.25 }
    );

    observer.observe(section);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (isAnimatingRef.current) return;
      centerCardInstantly(activeIndexRef.current);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleReserve = () => {
    document.getElementById('reserve')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section
      ref={sectionRef}
      className="signature-dish-carousel"
      aria-labelledby="signature-dish-heading"
    >
      <div className="signature-dish-carousel__header">
        <h2 id="signature-dish-heading" className="signature-dish-carousel__heading">
          OUR SIGNATURE DISH
        </h2>
      </div>

      <div className="signature-dish-carousel__viewport">
        <div
          ref={trackRef}
          className="signature-dish-carousel__track"
          role="region"
          aria-label="Signature dish carousel"
        >
          {CARDS.map((card) => (
            <article key={card.id} className="signature-dish-carousel__card">
              <div className="signature-dish-carousel__content">
                <div className="signature-dish-carousel__text-group">
                  <p className="signature-dish-carousel__eyebrow">{card.eyebrow}</p>
                  <h3 className="signature-dish-carousel__title">{card.title}</h3>
                  <p className="signature-dish-carousel__description">{card.description}</p>
                  <OutlineButton onClick={handleReserve}>{card.buttonLabel}</OutlineButton>
                </div>
              </div>
              <div className="signature-dish-carousel__media">
                <div className="signature-dish-carousel__placeholder" aria-hidden="true">
                  Add dish image here
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div
        className={`signature-dish-carousel__controls${
          isInView ? ' signature-dish-carousel__controls--visible' : ''
        }`}
      >
        <div className="signature-dish-carousel__controls-inner">
          <button
            type="button"
            className="signature-dish-carousel__arrow"
            onClick={goPrev}
            disabled={activeIndex === 0}
            aria-label="Previous signature dish"
          >
            <span aria-hidden="true">&lsaquo;</span>
          </button>

          <div className="signature-dish-carousel__dots" role="tablist" aria-label="Carousel pagination">
            {CARDS.map((card, index) => (
              <button
                key={card.id}
                type="button"
                role="tab"
                className={`signature-dish-carousel__dot${
                  index === activeIndex ? ' signature-dish-carousel__dot--active' : ''
                }`}
                aria-label={`Go to slide ${index + 1}`}
                aria-selected={index === activeIndex}
                onClick={() => scrollToCard(index)}
              />
            ))}
          </div>

          <button
            type="button"
            className="signature-dish-carousel__arrow"
            onClick={goNext}
            disabled={activeIndex === CARDS.length - 1}
            aria-label="Next signature dish"
          >
            <span aria-hidden="true">&rsaquo;</span>
          </button>
        </div>
      </div>
    </section>
  );
}

export default SignatureDishCarousel;
