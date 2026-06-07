import { useState } from 'react';
import { menuImages } from '../../data/menuAssets';
import { formatVND } from '../../utils/formatCurrency';

const FALLBACK_IMAGE = menuImages.hero;

function MenuGrid({ dishes, onPreviewImage }) {
  return (
    <div className="menu-grid">
      {dishes.map((dish, index) => (
        <MenuCard
          key={dish.id}
          dish={dish}
          index={index}
          onPreviewImage={onPreviewImage}
        />
      ))}
    </div>
  );
}

function MenuCard({ dish, index, onPreviewImage }) {
  const [imageSrc, setImageSrc] = useState(dish.image || FALLBACK_IMAGE);

  const openPreview = () => {
    onPreviewImage?.({ ...dish, image: imageSrc });
  };

  return (
    <article
      className="menu-card menu-grid__card menu-reveal menu-reveal-item"
      style={{ animationDelay: `${index * 45}ms`, '--reveal-index': index }}
    >
      <button
        type="button"
        className="menu-card__imageBtn"
        onClick={openPreview}
        aria-label={`View larger image of ${dish.name}`}
      >
        <div className="menu-card__imageWrap menu-grid__media">
          <img
            src={imageSrc}
            alt={dish.name}
            className="menu-card__image menu-grid__media-img"
            loading="lazy"
            onError={() => {
              if (imageSrc !== FALLBACK_IMAGE) setImageSrc(FALLBACK_IMAGE);
            }}
          />
        </div>
      </button>
      <div className="menu-card__body menu-grid__body">
        <h3 className="menu-card__title menu-card__name menu-grid__name">{dish.name}</h3>
        {dish.description ? (
          <p className="menu-card__description menu-card__desc menu-grid__desc">
            {dish.description}
          </p>
        ) : (
          <p className="menu-card__description menu-card__desc menu-grid__desc" aria-hidden="true">
            &nbsp;
          </p>
        )}
        <p className="menu-card__price menu-grid__price">{formatVND(dish.price)}</p>
      </div>
    </article>
  );
}

export default MenuGrid;
