import { homeImages } from '@/data/homeAssets';
import { useScrollReveal } from '@/hooks/useScrollReveal';

function RolledPerfectionSection() {
  const revealRef = useScrollReveal();

  return (
    <section className="phurai-rolled home-reveal-parent" ref={revealRef}>
      <div className="phurai-rolled__header home-reveal-child">
        <h2>ROLLED TO PERFECTION</h2>
        <p className="phurai-rolled__desc home-reveal-child home-reveal-child--delay-1">
          A delicate balance of texture and taste. Our sushi crafted with precision, honoring
          centuries of tradition while embracing the bold spirit of modern innovation.
        </p>
      </div>

      <div className="phurai-rolled__image-wrap home-reveal-child home-reveal-child--delay-2">
        <img
          src={homeImages.sushiHero}
          alt="Sushi roll with chopsticks"
          className="phurai-rolled__image"
        />
      </div>
    </section>
  );
}

export default RolledPerfectionSection;
