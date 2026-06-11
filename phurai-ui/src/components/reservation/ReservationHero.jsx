import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function ReservationHero({ onReserveClick }) {
  const rootRef = useRef(null);
  const bgRef = useRef(null);
  const maskRef = useRef(null);
  const titleRef = useRef(null);

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;

    const ctx = gsap.context(() => {
      // Subtle background scale as the hero scrolls away.
      gsap.to(bgRef.current, {
        scale: 1.18,
        ease: "none",
        scrollTrigger: {
          trigger: rootRef.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });

      // Mask image parallax/scale reveal.
      gsap.fromTo(
        maskRef.current,
        { scale: 1.18 },
        {
          scale: 1.02,
          ease: "none",
          scrollTrigger: {
            trigger: rootRef.current,
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        }
      );

      // Animated gold gradient sweep on the title.
      gsap.fromTo(
        titleRef.current,
        { "--rzv-grad": "0%" },
        {
          "--rzv-grad": "120%",
          ease: "none",
          scrollTrigger: {
            trigger: rootRef.current,
            start: "top top",
            end: "bottom center",
            scrub: true,
          },
        }
      );
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <header className="rzv-hero" ref={rootRef}>
      <div className="rzv-hero__bg" ref={bgRef} />
      <div className="rzv-hero__mask">
        <img
          ref={maskRef}
          className="rzv-hero__mask-img"
          src="/src/assets/images/hero.jpg"
          alt="Phūrai dining atmosphere"
          loading="eager"
        />
      </div>

      <div className="rzv-hero__inner">
        <p className="rzv-hero__eyebrow">Phūrai · Premium Dining</p>
        <h1 className="rzv-hero__title rzv-serif" ref={titleRef}>
          Reserve Your Phūrai Experience
        </h1>
        <p className="rzv-hero__sub">
          Select your preferred date, table, and dining atmosphere — crafted for an
          unforgettable evening.
        </p>
        <button type="button" className="rzv-hero__cta" onClick={onReserveClick}>
          Begin Reservation
        </button>
      </div>
    </header>
  );
}

export default ReservationHero;
