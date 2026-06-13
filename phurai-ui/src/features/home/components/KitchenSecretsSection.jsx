import { useState } from 'react';
import OutlineButton from '@/components/common/OutlineButton';
import KitchenRecommendations from './KitchenRecommendations';
import { homeImages } from '../data/homeAssets.js';
import { useScrollReveal } from '@/hooks/useScrollReveal';

function KitchenSecretsSection() {
  const [expanded, setExpanded] = useState(false);
  const revealRef = useScrollReveal();

  return (
    <section className="phurai-kitchen home-reveal-parent" aria-labelledby="kitchen-heading" ref={revealRef}>
      <div className="phurai-kitchen__banner home-reveal-child">
        <img src={homeImages.kitchenSecrets} alt="" />
        <h2 id="kitchen-heading">SECRETS FROM THE KITCHEN</h2>
      </div>

      <div className="phurai-kitchen__body">
        <p className="home-reveal-child home-reveal-child--delay-1">
          If you are dining at Phūrai For the first time, the chef recommends trying 3 or more of
          the menu&apos;s &quot;Eight Highlights.&quot; The best way to enjoy this experience is to
          start with 2 or 3 cold dishes; then move on to 2 or 3 hot ones. Finally, end with some
          sushi and dessert. All of these dishes are shared family style.
        </p>
        <p className="phurai-kitchen__subheading home-reveal-child home-reveal-child--delay-2">Here are some of the recommendations</p>

        {!expanded ? (
          <OutlineButton type="button" onClick={() => setExpanded(true)}>
            SHOW MORE
          </OutlineButton>
        ) : null}
      </div>

      <div className={`phurai-kitchen__expand ${expanded ? 'is-open' : ''}`}>
        <div className="phurai-kitchen__expand-inner">
          <KitchenRecommendations onShowLess={() => setExpanded(false)} />
        </div>
      </div>
    </section>
  );
}

export default KitchenSecretsSection;
