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
    
  },
  {
    id: 'placeholder-2',
    eyebrow: 'SIGNATURE',
    title: 'Chef’s selection nigiri flight',
    description:
      'Placeholder copy for a second signature dish card. Replace with final content.',
    
  },
  {
    id: 'placeholder-3',
    eyebrow: 'SIGNATURE',
    title: 'Seasonal omakase experience',
    description:
      'Placeholder copy for a third signature dish card. Replace with final content.',
   
  },
];

const SCROLL_DURATION_MS = 1000;
const AUTO_PLAY_INTERVAL_MS = 5000;
const USER_IDLE_RESUME_MS = 10000;

function easeOutExpo(t) {
  return t >= 1 ? 1 : 1 - 2 ** (-10 * t);
}

function getCardStateClass(index, activeIndex) {
  if (index === activeIndex) return 'signature-dish-carousel__card--active';
  if (index < activeIndex) return 'signature-dish-carousel__card--previous';
  return 'signature-dish-carousel__card--next';
}

function SignatureDishCarousel() {
  const sectionRef = useRef(null);
  const trackRef = useRef(null);

  const animationFrameRef = useRef(null);
  const autoPlayTimerRef = useRef(null);
  const resumeTimerRef = useRef(null);

  const isAnimatingRef = useRef(false);
  const isUserPausedRef = useRef(false);
  const activeIndexRef = useRef(0);
  const showControlsRef = useRef(false);

  const [showControls, setShowControls] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [headingOffset, setHeadingOffset] = useState(0);
  const [mediaParallax, setMediaParallax] = useState(0);

  const clearAutoPlayTimer = () => {
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
  };

  const clearResumeTimer = () => {
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  };

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
    setIsAnimating(true);
    track.classList.add('signature-dish-carousel__track--animating');

    const startLeft = track.scrollLeft;
    const distance = targetLeft - startLeft;
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutExpo(progress);

      track.scrollLeft = startLeft + distance * easedProgress;

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      track.scrollLeft = targetLeft;
      isAnimatingRef.current = false;
      animationFrameRef.current = null;
      track.classList.remove('signature-dish-carousel__track--animating');
      setIsAnimating(false);

      if (typeof onComplete === 'function') {
        onComplete();
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  };

  const scrollToCard = (index, options = {}) => {
    if (isAnimatingRef.current) return;

    const { loop = false, userAction = false } = options;

    let safeIndex = index;

    if (loop) {
      if (index > CARDS.length - 1) safeIndex = 0;
      if (index < 0) safeIndex = CARDS.length - 1;
    } else {
      safeIndex = Math.max(0, Math.min(index, CARDS.length - 1));
    }

    if (safeIndex === activeIndexRef.current) return;

    if (userAction) {
      pauseAutoPlayAfterUserAction();
    }

    const targetLeft = getTargetScrollLeft(safeIndex);

    animateScrollTo(targetLeft, SCROLL_DURATION_MS, () => {
      activeIndexRef.current = safeIndex;
      setActiveIndex(safeIndex);
    });
  };

  const startAutoPlay = () => {
    clearAutoPlayTimer();

    if (!showControlsRef.current || isUserPausedRef.current) return;

    autoPlayTimerRef.current = setInterval(() => {
      if (isAnimatingRef.current) return;
      if (!showControlsRef.current) return;

      const nextIndex =
        activeIndexRef.current >= CARDS.length - 1
          ? 0
          : activeIndexRef.current + 1;

      scrollToCard(nextIndex, {
        loop: true,
        userAction: false,
      });
    }, AUTO_PLAY_INTERVAL_MS);
  };

  const pauseAutoPlayAfterUserAction = () => {
    isUserPausedRef.current = true;

    clearAutoPlayTimer();
    clearResumeTimer();

    resumeTimerRef.current = setTimeout(() => {
      isUserPausedRef.current = false;

      if (showControlsRef.current) {
        startAutoPlay();
      }
    }, USER_IDLE_RESUME_MS);
  };

  const goNext = () => {
    scrollToCard(activeIndexRef.current + 1, {
      loop: true,
      userAction: true,
    });
  };

  const goPrev = () => {
    scrollToCard(activeIndexRef.current - 1, {
      loop: true,
      userAction: true,
    });
  };

  useEffect(() => {
    requestAnimationFrame(() => {
      centerCardInstantly(0);
      requestAnimationFrame(() => setIsReady(true));
    });

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      clearAutoPlayTimer();
      clearResumeTimer();
    };
  }, []);

  useEffect(() => {
    const updateSectionPresence = () => {
      const section = sectionRef.current;

      if (!section) {
        showControlsRef.current = false;
        setShowControls(false);
        setHeadingOffset(0);
        setMediaParallax(0);
        clearAutoPlayTimer();
        return;
      }

      const rect = section.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      const shouldShow =
        rect.top < viewportHeight * 0.65 && rect.bottom > viewportHeight * 0.35;

      showControlsRef.current = shouldShow;
      setShowControls(shouldShow);

      if (!shouldShow) {
        clearAutoPlayTimer();
      }

      const visibleProgress = Math.min(
        1,
        Math.max(0, (viewportHeight - rect.top) / (rect.height + viewportHeight * 0.35))
      );

      const centeredProgress =
        1 -
        Math.abs(rect.top + rect.height * 0.42 - viewportHeight * 0.5) /
          viewportHeight;

      setHeadingOffset((0.5 - visibleProgress) * 14);
      setMediaParallax(Math.max(0, centeredProgress) * 0.018);
    };

    updateSectionPresence();

    window.addEventListener('scroll', updateSectionPresence, { passive: true });
    window.addEventListener('resize', updateSectionPresence);

    return () => {
      window.removeEventListener('scroll', updateSectionPresence);
      window.removeEventListener('resize', updateSectionPresence);
    };
  }, []);

  useEffect(() => {
    if (!showControls) {
      clearAutoPlayTimer();
      return undefined;
    }

    if (!isUserPausedRef.current) {
      startAutoPlay();
    }

    return () => {
      clearAutoPlayTimer();
    };
  }, [showControls]);

  useEffect(() => {
    const handleResize = () => {
      if (isAnimatingRef.current) return;
      centerCardInstantly(activeIndexRef.current);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleReserve = () => {
    document.getElementById('reserve')?.scrollIntoView({ behavior: 'smooth' });
  };

  const controlsLocked = isAnimating;

  return (
    <section
      ref={sectionRef}
      className={`signature-dish-carousel${
        isReady ? ' signature-dish-carousel--ready' : ''
      }`}
      aria-labelledby="signature-dish-heading"
    >
      <div
        className="signature-dish-carousel__header"
        style={{ '--heading-parallax': `${headingOffset}px` }}
      >
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
          {CARDS.map((card, index) => {
            const cardState = getCardStateClass(index, activeIndex);
            const cardClassName = [
              'signature-dish-carousel__card',
              cardState,
              isAnimating ? 'signature-dish-carousel__card--animating' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <article
                key={card.id}
                className={cardClassName}
                aria-hidden={index !== activeIndex}
                style={{ '--media-parallax': `${mediaParallax}` }}
              >
                <div className="signature-dish-carousel__content">
                  <div className="signature-dish-carousel__text-group">
                    <p className="signature-dish-carousel__eyebrow">
                      {card.eyebrow}
                    </p>
                    <h3 className="signature-dish-carousel__title">
                      {card.title}
                    </h3>
                    <p className="signature-dish-carousel__description">
                      {card.description}
                    </p>
                   
                  </div>
                </div>

                <div className="signature-dish-carousel__media">
                  <div
                    className="signature-dish-carousel__placeholder"
                    aria-hidden="true"
                  >
                    Add dish image here
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div
        className={`signature-dish-carousel__controls${
          showControls ? ' signature-dish-carousel__controls--visible' : ''
        }`}
      >
        <div className="signature-dish-carousel__controls-inner">
          <button
            type="button"
            className="signature-dish-carousel__arrow"
            onClick={goPrev}
            disabled={controlsLocked}
            aria-label="Previous signature dish"
          >
            <span aria-hidden="true">&lsaquo;</span>
          </button>

          <div
            className="signature-dish-carousel__dots"
            role="tablist"
            aria-label="Carousel pagination"
          >
            {CARDS.map((card, index) => (
              <button
                key={card.id}
                type="button"
                role="tab"
                className={`signature-dish-carousel__dot${
                  index === activeIndex
                    ? ' signature-dish-carousel__dot--active'
                    : ''
                }`}
                aria-label={`Go to slide ${index + 1}`}
                aria-selected={index === activeIndex}
                disabled={controlsLocked}
                onClick={() =>
                  scrollToCard(index, {
                    userAction: true,
                  })
                }
              />
            ))}
          </div>

          <button
            type="button"
            className="signature-dish-carousel__arrow"
            onClick={goNext}
            disabled={controlsLocked}
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