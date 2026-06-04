import OutlineButton from '../common/OutlineButton';

function OfferingBlock({
  label,
  title,
  description,
  imageSrc,
  imageAlt = '',
  reverse = false,
  buttonLabel = 'RESERVE',
}) {
  return (
    <section className={`phurai-offering ${reverse ? 'phurai-offering--reverse' : ''}`}>
      <div className="phurai-offering__media">
        <img src={imageSrc} alt={imageAlt} />
      </div>
      <div className="phurai-offering__content">
        <p className="phurai-offering__label">{label}</p>
        <h2>{title}</h2>
        <p className="phurai-offering__text">{description}</p>
        <OutlineButton>{buttonLabel}</OutlineButton>
      </div>
    </section>
  );
}

export default OfferingBlock;
