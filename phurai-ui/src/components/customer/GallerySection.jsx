import OutlineButton from '@/components/common/OutlineButton';
import { homeImages } from '@/data/homeAssets';

function GallerySection() {
  return (
    <section className="phurai-gallery" aria-labelledby="gallery-heading">
      <h2 id="gallery-heading" className="phurai-gallery__title">
        A UNIQUE EXPERIENCE
      </h2>
      <p className="phurai-gallery__intro">
        Discover a symphony of flavors where ancient traditions meet modern artistry.
        <br />
        Each dish is a curated masterpiece, designed not just to be eaten, but to be felt.
      </p>

      <div className="phurai-gallery__grid">
        {homeImages.gallery.map((src, index) => (
          <figure key={src} className="phurai-gallery__item">
            <img src={src} alt={`Gallery dish ${index + 1}`} loading="lazy" />
          </figure>
        ))}
      </div>

      <OutlineButton className="phurai-gallery__cta">EXPLORE MENU</OutlineButton>
    </section>
  );
}

export default GallerySection;
