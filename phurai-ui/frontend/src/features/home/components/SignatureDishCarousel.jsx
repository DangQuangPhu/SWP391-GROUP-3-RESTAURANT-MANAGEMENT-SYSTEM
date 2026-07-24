import { useEffect, useRef, useState } from 'react';
import OutlineButton from '@/components/common/OutlineButton';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import { homeImages } from '../data/homeAssets.js';
import '@/features/home/styles/SignatureDishCarousel.css';

function SingleVideoPlayer({ src, active, onTextReveal, onEndedNext, onEndedStateChange, initialSpeed = 1.5 }) {
  const videoRef = useRef(null);
  const [isFading, setIsFading] = useState(false);
  const [isEndedBlur, setIsEndedBlur] = useState(false);
  const textRevealedRef = useRef(false);

  useEffect(() => {
    if (!active) {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
      setIsFading(false);
      setIsEndedBlur(false);
      if (onEndedStateChange) onEndedStateChange(false);
      textRevealedRef.current = false;
      if (onTextReveal) onTextReveal(false);
      return;
    }

    textRevealedRef.current = false;
    if (onTextReveal) onTextReveal(false);
    setIsEndedBlur(false);
    if (onEndedStateChange) onEndedStateChange(false);

    if (videoRef.current) {
      const v = videoRef.current;
      v.currentTime = 0;
      v.playbackRate = initialSpeed;
      setIsFading(false);
      v.play().catch(() => { });
    }
  }, [active, initialSpeed]);

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !v.duration) return;

    const ct = v.currentTime;
    const dur = v.duration;

    // After 2.0s (if boosted to 1.5x at start), return to normal 1.0x playback speed
    if (initialSpeed !== 1.0 && ct >= 2.0 && v.playbackRate !== 1.0) {
      v.playbackRate = 1.0;
    }

    // Wait until video has played for ~3.5s before revealing text
    if (ct >= 3.5 && ct < dur - 1.2 && !textRevealedRef.current) {
      textRevealedRef.current = true;
      if (onTextReveal) onTextReveal(true);
    }

    // 1.2s before end: float text out smoothly so text hides before video stops
    if (dur - ct <= 1.2 && textRevealedRef.current) {
      textRevealedRef.current = false;
      if (onTextReveal) onTextReveal(false);
    }

    // 0.7s before end: trigger smooth dark vignette fade for video
    if (onEndedNext && dur - ct <= 0.7 && !isFading) {
      setIsFading(true);
    }
  };

  const handleEnded = () => {
    textRevealedRef.current = false;
    if (onTextReveal) onTextReveal(false);
    if (onEndedNext) {
      onEndedNext();
    } else {
      // Video ended: trigger Apple-style blur animation and wait for user click
      setIsEndedBlur(true);
      if (onEndedStateChange) onEndedStateChange(true);
    }
  };

  const handleReplayClick = (e) => {
    if (isEndedBlur) {
      if (e) e.stopPropagation();
      setIsEndedBlur(false);
      if (onEndedStateChange) onEndedStateChange(false);
      textRevealedRef.current = false;
      if (onTextReveal) onTextReveal(false);

      if (videoRef.current) {
        const v = videoRef.current;
        v.currentTime = 0;
        v.playbackRate = initialSpeed;
        v.play().catch(() => { });
      }
    }
  };

  return (
    <div className="single-video-player" onClick={isEndedBlur ? handleReplayClick : undefined}>
      <video
        ref={videoRef}
        src={src}
        muted
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        className={`single-video-player__video ${isEndedBlur ? 'single-video-player__video--blurred' : ''}`}
      />
      <div
        className={`dual-video-player__overlay ${isFading ? 'dual-video-player__overlay--visible' : ''}`}
      />
    </div>
  );
}

function DualVideoPlayer({ active, onVideoChange, onTextReveal, onEndedNext, onEndedStateChange }) {
  const video1Ref = useRef(null);
  const video2Ref = useRef(null);
  const [currentVideo, setCurrentVideo] = useState(1); // 1 for 4.mp4, 2 for 3.mp4
  const [isFading, setIsFading] = useState(false);
  const [isEndedBlur, setIsEndedBlur] = useState(false);
  const textRevealedRef = useRef(false);

  useEffect(() => {
    if (!active) {
      if (video1Ref.current) {
        video1Ref.current.pause();
        video1Ref.current.currentTime = 0;
      }
      if (video2Ref.current) {
        video2Ref.current.pause();
        video2Ref.current.currentTime = 0;
      }
      setCurrentVideo(1);
      setIsFading(false);
      setIsEndedBlur(false);
      if (onEndedStateChange) onEndedStateChange(false);
      textRevealedRef.current = false;
      if (onTextReveal) onTextReveal(false);
      return;
    }

    textRevealedRef.current = false;
    if (onTextReveal) onTextReveal(false);
    setIsEndedBlur(false);
    if (onEndedStateChange) onEndedStateChange(false);

    if (currentVideo === 1 && video1Ref.current) {
      const v1 = video1Ref.current;
      v1.currentTime = 0;
      v1.playbackRate = 1.5; // Fast 1.5x start for first 2s
      setIsFading(false);
      if (onVideoChange) onVideoChange(1);
      v1.play().catch(() => { });
    } else if (currentVideo === 2 && video2Ref.current) {
      const v2 = video2Ref.current;
      v2.currentTime = 0;
      v2.playbackRate = 1.5; // Fast 1.5x start for first 2s
      setIsFading(false);
      if (onVideoChange) onVideoChange(2);
      v2.play().catch(() => { });
    }
  }, [currentVideo, active]);

  const handleTimeUpdate1 = () => {
    const v1 = video1Ref.current;
    if (!v1 || !v1.duration) return;

    const ct = v1.currentTime;
    const dur = v1.duration;

    // After 2.0s, return to normal 1.0x playback speed
    if (ct >= 2.0 && v1.playbackRate !== 1.0) {
      v1.playbackRate = 1.0;
    }

    // Wait until video has played for ~3.5s before revealing text
    if (ct >= 3.5 && ct < dur - 1.2 && !textRevealedRef.current) {
      textRevealedRef.current = true;
      if (onTextReveal) onTextReveal(true);
    }

    // 1.2s before end: float text out smoothly
    if (dur - ct <= 1.2 && textRevealedRef.current) {
      textRevealedRef.current = false;
      if (onTextReveal) onTextReveal(false);
    }

    // 0.7s before end: trigger smooth dark vignette fade for video
    if (dur - ct <= 0.7 && !isFading) {
      setIsFading(true);
    }
  };

  const handleTimeUpdate2 = () => {
    const v2 = video2Ref.current;
    if (!v2 || !v2.duration) return;

    const ct = v2.currentTime;
    const dur = v2.duration;

    // After 2.0s, return to normal 1.0x playback speed
    if (ct >= 2.0 && v2.playbackRate !== 1.0) {
      v2.playbackRate = 1.0;
    }

    // Wait until video has played for ~3.5s before revealing text
    if (ct >= 3.5 && ct < dur - 1.2 && !textRevealedRef.current) {
      textRevealedRef.current = true;
      if (onTextReveal) onTextReveal(true);
    }

    // 1.2s before end: float text out smoothly so text hides before video stops
    if (dur - ct <= 1.2 && textRevealedRef.current) {
      textRevealedRef.current = false;
      if (onTextReveal) onTextReveal(false);
    }

    // 0.7s before end: trigger smooth dark vignette fade for video
    if (onEndedNext && dur - ct <= 0.7 && !isFading) {
      setIsFading(true);
    }
  };

  const handleEnded1 = () => {
    textRevealedRef.current = false;
    if (onTextReveal) onTextReveal(false);
    setCurrentVideo(2);
    if (onVideoChange) onVideoChange(2);
  };

  const handleEnded2 = () => {
    textRevealedRef.current = false;
    if (onTextReveal) onTextReveal(false);
    if (onEndedNext) {
      setCurrentVideo(1);
      if (onVideoChange) onVideoChange(1);
      onEndedNext();
    } else {
      setIsEndedBlur(true);
      if (onEndedStateChange) onEndedStateChange(true);
    }
  };

  const handleReplayClick = (e) => {
    if (isEndedBlur) {
      if (e) e.stopPropagation();
      setIsEndedBlur(false);
      if (onEndedStateChange) onEndedStateChange(false);
      setCurrentVideo(1);
      if (onVideoChange) onVideoChange(1);
      textRevealedRef.current = false;
      if (onTextReveal) onTextReveal(false);

      if (video1Ref.current) {
        const v1 = video1Ref.current;
        v1.currentTime = 0;
        v1.playbackRate = 1.5;
        v1.play().catch(() => { });
      }
    }
  };

  return (
    <div className="dual-video-player" onClick={isEndedBlur ? handleReplayClick : undefined}>
      <div
        className={`dual-video-player__item ${currentVideo === 1 ? 'dual-video-player__item--active' : ''
          }`}
      >
        <video
          ref={video1Ref}
          src={homeImages.video5}
          muted
          playsInline
          onTimeUpdate={handleTimeUpdate1}
          onEnded={handleEnded1}
          className={`dual-video-player__video ${isEndedBlur ? 'dual-video-player__video--blurred' : ''}`}
        />
      </div>

      <div
        className={`dual-video-player__item ${currentVideo === 2 ? 'dual-video-player__item--active' : ''
          }`}
      >
        <video
          ref={video2Ref}
          src={homeImages.video3}
          muted
          playsInline
          onTimeUpdate={handleTimeUpdate2}
          onEnded={handleEnded2}
          className={`dual-video-player__video ${isEndedBlur ? 'dual-video-player__video--blurred' : ''}`}
        />
      </div>

      {/* Dark overlay transition for seamless video crossfade */}
      <div
        className={`dual-video-player__overlay ${isFading ? 'dual-video-player__overlay--visible' : ''
          }`}
      />
    </div>
  );
}

const CARDS = [
  {
    id: 'cooking-showcase',
    eyebrow: 'THE CINEMATIC EXPERIENCE',
    title: 'Artistry in Every Slice',
    description:
      'Witness the rhythm of Japanese culinary mastery, where speed meets absolute precision.',
    isSingleVideoShowcase: true,
    videoSrc: homeImages.cookingVideo,
    stopCarouselOnEnd: true,
  },
  {
    id: 'video-showcase',
    eyebrow: 'SPRING COLLECTION',
    title: 'Harmonizing Tradition & Modernity',
    description:
      'Masterfully hand-crafted sushi and seasonal catches, elevated with subtle Peruvian notes.',
    isDualVideoShowcase: true,
    stopCarouselOnEnd: true,
  },
  {
    id: 'omakase-experience',
    eyebrow: 'THE OMAKASE JOURNEY',
    title: 'Culinary Craftsmanship in Motion',
    description:
      'An intimate front-row view of master chefs handcrafting exquisite Japanese delicacies with passion and precision.',
    isSingleVideoShowcase: true,
    videoSrc: homeImages.omakaseVideo,
    stopCarouselOnEnd: true,
    initialSpeed: 1.0,
  },
];

const SCROLL_DURATION_MS = 1000;

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
  useScrollReveal({}, sectionRef);

  const animationFrameRef = useRef(null);
  const isAnimatingRef = useRef(false);
  const activeIndexRef = useRef(0);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [headingOffset, setHeadingOffset] = useState(0);
  const [mediaParallax, setMediaParallax] = useState(0);
  const [videoIndex, setVideoIndex] = useState(1);
  const [videoTextVisible, setVideoTextVisible] = useState(false);
  const [activeVideoEnded, setActiveVideoEnded] = useState(false);

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
    setActiveVideoEnded(false);
    setVideoTextVisible(false);
  };

  const animateScrollTo = (targetLeft, duration = SCROLL_DURATION_MS, onComplete) => {
    const track = trackRef.current;
    if (!track) return;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const startLeft = track.scrollLeft;
    const distance = targetLeft - startLeft;
    const startTime = performance.now();

    setIsAnimating(true);
    isAnimatingRef.current = true;
    track.classList.add('signature-dish-carousel__track--animating');

    const step = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutExpo(progress);

      track.scrollLeft = startLeft + distance * easedProgress;

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(step);
      } else {
        track.classList.remove('signature-dish-carousel__track--animating');
        setIsAnimating(false);
        isAnimatingRef.current = false;
        animationFrameRef.current = null;
        if (onComplete) onComplete();
      }
    };

    animationFrameRef.current = requestAnimationFrame(step);
  };

  const scrollToCard = (index, options = {}) => {
    const { loop = false } = options;

    let targetIndex = index;
    if (targetIndex < 0) {
      targetIndex = loop ? CARDS.length - 1 : 0;
    } else if (targetIndex >= CARDS.length) {
      targetIndex = loop ? 0 : CARDS.length - 1;
    }

    if (targetIndex === activeIndexRef.current && !isAnimatingRef.current) {
      return;
    }

    activeIndexRef.current = targetIndex;
    setActiveIndex(targetIndex);
    setActiveVideoEnded(false);
    setVideoTextVisible(false);

    const targetLeft = getTargetScrollLeft(targetIndex);
    animateScrollTo(targetLeft, SCROLL_DURATION_MS);
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
    setIsReady(true);
    const timer = setTimeout(() => {
      centerCardInstantly(0);
    }, 50);

    return () => {
      clearTimeout(timer);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const updateSectionPresence = () => {
      const section = sectionRef.current;

      if (!section) {
        setHeadingOffset(0);
        setMediaParallax(0);
        return;
      }

      const rect = section.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

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
    const handleResize = () => {
      if (isAnimatingRef.current) return;
      centerCardInstantly(activeIndexRef.current);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const controlsLocked = isAnimating;

  return (
    <section
      ref={sectionRef}
      className={`signature-dish-carousel ${isReady ? 'signature-dish-carousel--ready' : ''}`}
      aria-labelledby="signature-dish-heading"
    >
      <div
        className="signature-dish-carousel__header"
        style={{ '--heading-parallax': `${headingOffset}px` }}
      >
        <h2 id="signature-dish-heading" className="signature-dish-carousel__heading">
          OUR SIGNATURE FOOD
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
            const isPlaying = index === activeIndex && !activeVideoEnded;
            const isEnded = index === activeIndex && activeVideoEnded;

            const cardClassName = [
              'signature-dish-carousel__card',
              `signature-dish-carousel__card--${card.id}`,
              cardState,
              isPlaying ? 'signature-dish-carousel__card--playing' : '',
              isEnded ? 'signature-dish-carousel__card--ended' : '',
              isAnimating ? 'signature-dish-carousel__card--animating' : '',
            ]
              .filter(Boolean)
              .join(' ');

            const handleCardClick = () => {
              if (controlsLocked) return;
              if (index !== activeIndex) {
                scrollToCard(index, { userAction: true });
              } else {
                goNext();
              }
            };

            const eyebrowText = card.isDualVideoShowcase
              ? videoIndex === 2
                ? 'SEARING ACCENTS'
                : card.eyebrow
              : card.eyebrow;

            const titleText = card.isDualVideoShowcase
              ? videoIndex === 2
                ? 'Refined Flames & Flawless Cuts'
                : card.title
              : card.title;

            const descText = card.isDualVideoShowcase
              ? videoIndex === 2
                ? 'Intense flames meet pristine cuts of Wagyu & Toro, unlocking deep caramelized umami notes.'
                : card.description
              : card.description;

            const isTextVisible = index === activeIndex && !activeVideoEnded && videoTextVisible;

            return (
              <article
                key={card.id}
                className={cardClassName}
                aria-hidden={index !== activeIndex}
                style={{ '--media-parallax': `${mediaParallax}` }}
                onClick={handleCardClick}
              >
                {/* Full-bleed Media */}
                <div className="signature-dish-carousel__media">
                  {card.isSingleVideoShowcase ? (
                    <SingleVideoPlayer
                      src={card.videoSrc}
                      active={index === activeIndex}
                      initialSpeed={card.initialSpeed ?? 1.5}
                      onTextReveal={(vis) => {
                        if (index === activeIndex) setVideoTextVisible(vis);
                      }}
                      onEndedNext={card.stopCarouselOnEnd ? null : () => goNext()}
                      onEndedStateChange={(ended) => {
                        if (index === activeIndex) setActiveVideoEnded(ended);
                      }}
                    />
                  ) : card.isDualVideoShowcase ? (
                    <DualVideoPlayer
                      active={index === activeIndex}
                      onVideoChange={setVideoIndex}
                      onTextReveal={(vis) => {
                        if (index === activeIndex) setVideoTextVisible(vis);
                      }}
                      onEndedNext={card.stopCarouselOnEnd ? null : () => goNext()}
                      onEndedStateChange={(ended) => {
                        if (index === activeIndex) setActiveVideoEnded(ended);
                      }}
                    />
                  ) : card.image ? (
                    <img
                      src={card.image}
                      alt={card.title}
                      className="signature-dish-carousel__media-img"
                    />
                  ) : (
                    <div
                      className="signature-dish-carousel__placeholder"
                      aria-hidden="true"
                    >
                      Add dish image here
                    </div>
                  )}
                </div>

                {/* Overlaid Content with Delayed Apple-style Typography */}
                <div className="signature-dish-carousel__content">
                  <div
                    className={`signature-dish-carousel__text-group signature-dish-carousel__text-group--card-${index} ${isTextVisible ? 'signature-dish-carousel__text-group--visible' : ''
                      }`}
                  >
                    <p className="signature-dish-carousel__eyebrow">
                      {eyebrowText}
                    </p>
                    <h3 className="signature-dish-carousel__title">
                      {titleText}
                    </h3>
                    <p className="signature-dish-carousel__description">
                      {descText}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="signature-dish-carousel__controls signature-dish-carousel__controls--visible">
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
              className={`signature-dish-carousel__dot${index === activeIndex
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
      </div>
    </section>
  );
}

export default SignatureDishCarousel;