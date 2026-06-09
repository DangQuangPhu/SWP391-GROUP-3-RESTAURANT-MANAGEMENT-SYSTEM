import { homeImages } from "@/data/homeAssets";

function HeroSection() {
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

      <div className="phurai-hero__content">
        <div className="phurai-hero__badge">
          <span className="phurai-hero__badge-line" />
          <p>AWARD-WINNING CUISINE SINCE 2015</p>
          <span className="phurai-hero__badge-line" />
        </div>

        <h1 className="phurai-hero__title">
          Taste the
          <br />
          <em>Extraordinary</em>
        </h1>

        <p className="phurai-hero__subtitle">
          Experience the perfect blend of local flavors and international culinary artistry.
          <br />
          Every dish tells a story of passion, precision, and premium ingredients.
        </p>

        <div className="phurai-hero__actions">
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