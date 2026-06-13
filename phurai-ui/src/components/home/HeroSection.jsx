import { homeImages } from "@/data/homeAssets";
import { useScrollReveal } from "@/hooks/useScrollReveal";

function HeroSection() {
  const revealRef = useScrollReveal();

  return (
    <section className="phurai-hero" aria-label="Welcome">
      <video
        className="phurai-hero__bg"
        src={homeImages.heroVideo}
        autoPlay
        muted
        loop
        playsInline
        aria-hidden="true"
      />

      <div className="phurai-hero__overlay" aria-hidden="true" />

      <div className="phurai-hero__content home-reveal-parent" ref={revealRef}>
        <div className="phurai-hero__badge home-reveal-child">
          <span className="phurai-hero__badge-line" />
          <p>AWARD-WINNING CUISINE SINCE 2015</p>
          <span className="phurai-hero__badge-line" />
        </div>

        <h1 className="phurai-hero__title home-reveal-child home-reveal-child--delay-1">
          Taste the
          <br />
          <em>Extraordinary</em>
        </h1>

        <p className="phurai-hero__subtitle home-reveal-child home-reveal-child--delay-2">
          Experience the perfect blend of local flavors and international culinary artistry.
          <br />
          Every dish tells a story of passion, precision, and premium ingredients.
        </p>

        <div className="phurai-hero__actions home-reveal-child home-reveal-child--delay-3">
          <button type="button" className="phurai-btn-primary">
            EXPLORE MENU
          </button>
          <button type="button" className="phurai-btn-ghost">
            RESERVE TABLE
          </button>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;