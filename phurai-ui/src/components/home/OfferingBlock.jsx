import OutlineButton from '@/components/common/OutlineButton';
import { useScrollReveal } from '@/hooks/useScrollReveal';

function OfferingBlock({
  label,
  title,
  description,
  imageSrc,
  imageAlt = '',
  reverse = false,
}) {
  const revealRef = useScrollReveal();

  return (
    <section className={`phurai-offering home-reveal-parent ${reverse ? 'phurai-offering--reverse' : ''}`} ref={revealRef}>
      <div className="phurai-offering__media home-reveal-child">
        <img src={imageSrc} alt={imageAlt} />
      </div>
      <div className="phurai-offering__content">
        <p className="phurai-offering__label home-reveal-child home-reveal-child--delay-1">{label}</p>
        <h2 className="home-reveal-child home-reveal-child--delay-2">{title}</h2>
        <p className="phurai-offering__text home-reveal-child home-reveal-child--delay-3">{description}</p>
      </div>
    </section>
  );
}

export default OfferingBlock;
