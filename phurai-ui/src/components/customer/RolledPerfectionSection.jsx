import { homeImages } from '@/data/homeAssets';

function RolledPerfectionSection() {
  return (
    <section className="phurai-rolled">
      <div className="phurai-rolled__header">
        <h2>ROLLED TO PERFECTION</h2>
        <p className="phurai-rolled__desc">
          A delicate balance of texture and taste. Our sushi crafted with precision, honoring
          centuries of tradition while embracing the bold spirit of modern innovation.
        </p>
      </div>

      <div className="phurai-rolled__image-wrap">
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
