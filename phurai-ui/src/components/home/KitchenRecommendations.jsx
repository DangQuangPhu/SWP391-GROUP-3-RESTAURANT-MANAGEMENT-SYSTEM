import OutlineButton from '@/components/common/OutlineButton';
import { homeImages } from '@/data/homeAssets';
import { useScrollReveal } from '@/hooks/useScrollReveal';

const recommendations = [
  {
    label: 'As a palate opener:',
    title: 'Yellowtail Jalapeno',
    description:
      'Delicately sliced yellowtail sashimi with touches of garlic puree, adorned with jalapeno slices then crowned with cilantro and served with Japanese citrus soy sauce; 6 pieces in one order. The cilantro elevates every bite, enhancing the flavor.',
    imageSrc: homeImages.kitchenYellowtailJalapeno,
    imageAlt: 'Yellowtail jalapeno sashimi',
  },
  {
    label: 'For Salad:',
    title: 'Sashimi Salad Matsuhisa Dressing',
    description:
      '7 pieces of rare grilled tuna sashimi sprinkled with black pepper on a bed of field greens and served with Phūrai Matsuhisa signature onion soy dressing.',
    imageSrc: homeImages.kitchenSashimiSalad,
    imageAlt: 'Sashimi salad with Matsuhisa dressing',
    reverse: true,
  },
  {
    label: 'For Hot Dishes:',
    title: 'Rock Shrimp Tempura Creamy Spicy',
    description:
      'Handful of battered shrimp "Tempura-ed" tossed with creamy spicy sauce, flavored with yuzu juice and pieces of shiitake mushrooms, served over a bed of greens drizzled with yuzu dressing. Best enjoyed together with the greens.',
    imageSrc: homeImages.kitchenRockShrimp,
    imageAlt: 'Rock shrimp tempura with creamy spicy sauce',
  },
  {
    title: 'Black Cod Miso',
    description:
      'Filet of black cod marinated in Den miso sauce for a few days then baked in oven and finished with a salamander broil.',
    imageSrc: homeImages.kitchenBlackCodMiso,
    imageAlt: 'Black cod miso',
    reverse: true,
  },
];

function KitchenRecRow({ item }) {
  const revealRef = useScrollReveal();

  return (
    <article
      ref={revealRef}
      className={`phurai-kitchen-rec__row home-reveal-parent ${item.reverse ? 'phurai-kitchen-rec__row--reverse' : ''}`}
    >
      <div className="phurai-kitchen-rec__media home-reveal-child">
        <img src={item.imageSrc} alt={item.imageAlt} />
      </div>
      <div className="phurai-kitchen-rec__content">
        {item.label ? <p className="phurai-kitchen-rec__label home-reveal-child home-reveal-child--delay-1">{item.label}</p> : null}
        <h3 className="home-reveal-child home-reveal-child--delay-2">{item.title}</h3>
        <p className="home-reveal-child home-reveal-child--delay-3">{item.description}</p>
      </div>
    </article>
  );
}

function KitchenRecommendations({ onShowLess }) {
  return (
    <div className="phurai-kitchen-rec">
      {recommendations.map((item) => (
        <KitchenRecRow key={item.title} item={item} />
      ))}

      <div className="phurai-kitchen-rec__footer">
        <OutlineButton type="button" onClick={onShowLess}>
          SHOW LESS
        </OutlineButton>
      </div>
    </div>
  );
}

export default KitchenRecommendations;
