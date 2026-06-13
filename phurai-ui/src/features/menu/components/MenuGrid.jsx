import { useRef, useState } from 'react';
import { menuImages } from '../data/menuAssets.js';
import { formatVND } from '@/utils/formatCurrency';
import { flyToCart } from '../utils/flyToCart.js';

const FALLBACK_IMAGE = menuImages.hero;

function MenuGrid({
  dishes,
  onPreviewImage,
  layoutVariant = 'grid',
  canAddToCart = false,
  onAddToCart,
  cartFabRef,
}) {
  if (layoutVariant === 'set-cards') {
    return (
      <div className="menu-set-cards">
        {dishes.map((dish, index) => (
          <SetMenuCard
            key={dish.id}
            dish={dish}
            index={index}
            onPreviewImage={onPreviewImage}
            canAddToCart={canAddToCart}
            onAddToCart={onAddToCart}
            cartFabRef={cartFabRef}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="menu-grid">
      {dishes.map((dish, index) => (
        <MenuCard
          key={dish.id}
          dish={dish}
          index={index}
          onPreviewImage={onPreviewImage}
          canAddToCart={canAddToCart}
          onAddToCart={onAddToCart}
          cartFabRef={cartFabRef}
        />
      ))}
    </div>
  );
}

function useAddToCartHandler({ dish, imageSrc, canAddToCart, onAddToCart, cartFabRef }) {
  const imageWrapRef = useRef(null);

  const handleAdd = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!canAddToCart || !onAddToCart) return;

    const source = imageWrapRef.current;
    const target = cartFabRef?.current;

    flyToCart({
      sourceElement: source,
      targetElement: target,
      imageSrc,
      onComplete: () => onAddToCart(dish),
    });
  };

  return { imageWrapRef, handleAdd };
}

function MenuAddButton({ onClick, label }) {
  return (
    <button
      type="button"
      className="menu-card__add-btn"
      onClick={onClick}
      aria-label={label}
    >
      +
    </button>
  );
}

function MenuCard({
  dish,
  index,
  onPreviewImage,
  canAddToCart,
  onAddToCart,
  cartFabRef,
}) {
  const [imageSrc, setImageSrc] = useState(dish.image || FALLBACK_IMAGE);
  const { imageWrapRef, handleAdd } = useAddToCartHandler({
    dish,
    imageSrc,
    canAddToCart,
    onAddToCart,
    cartFabRef,
  });

  const openPreview = () => {
    onPreviewImage?.({ ...dish, image: imageSrc });
  };

  return (
    <article
      className="menu-card menu-grid__card menu-reveal menu-reveal-item"
      style={{ animationDelay: `${index * 45}ms`, '--reveal-index': index }}
    >
      <div className="menu-card__imageArea">
        <button
          type="button"
          className="menu-card__imageBtn"
          onClick={openPreview}
          aria-label={`View larger image of ${dish.name}`}
        >
          <div
            ref={imageWrapRef}
            className="menu-card__imageWrap menu-grid__media"
          >
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
        {canAddToCart ? (
          <MenuAddButton
            onClick={handleAdd}
            label={`Add ${dish.name} to cart`}
          />
        ) : null}
      </div>
      <div className="menu-card__body menu-grid__body">
        <div className="menu-card__titleRow">
          <h3 className="menu-card__title menu-card__name menu-grid__name">{dish.name}</h3>
          {dish.badge ? (
            <span className="menu-item__badge">{dish.badge}</span>
          ) : null}
        </div>
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

function SetMenuCard({
  dish,
  index,
  onPreviewImage,
  canAddToCart,
  onAddToCart,
  cartFabRef,
}) {
  const [imageSrc, setImageSrc] = useState(dish.image || FALLBACK_IMAGE);
  const { imageWrapRef, handleAdd } = useAddToCartHandler({
    dish,
    imageSrc,
    canAddToCart,
    onAddToCart,
    cartFabRef,
  });

  const setCard = dish.setCard ?? {};
  const titleLines = setCard.titleLines ?? [dish.name];

  const openPreview = () => {
    onPreviewImage?.({ ...dish, image: imageSrc });
  };

  return (
    <article
      className={`menu-set-card menu-reveal menu-reveal-item${setCard.alt ? ' menu-set-card--alt' : ''}`}
      style={{ animationDelay: `${index * 60}ms`, '--reveal-index': index }}
    >
      <div className="menu-set-card__imageArea">
        <button
          type="button"
          className="menu-set-card__imageBtn"
          onClick={openPreview}
          aria-label={`View larger image of ${dish.name}`}
        >
          <div ref={imageWrapRef} className="menu-set-card__imageWrap">
            <img
              src={imageSrc}
              alt={dish.name}
              className="menu-set-card__image"
              loading="lazy"
              onError={() => {
                if (imageSrc !== FALLBACK_IMAGE) setImageSrc(FALLBACK_IMAGE);
              }}
            />
          </div>
        </button>
        {canAddToCart ? (
          <MenuAddButton
            onClick={handleAdd}
            label={`Add ${dish.name} to cart`}
          />
        ) : null}
      </div>

      {setCard.label ? (
        <p
          className={`menu-set-card__label${
            setCard.labelMuted ? ' menu-set-card__label--muted' : ''
          }`}
        >
          {setCard.label}
        </p>
      ) : null}

      <h3 className="menu-set-card__title">
        {titleLines.map((line) => (
          <span key={line} className="menu-set-card__title-line">
            {line}
            <br />
          </span>
        ))}
      </h3>

      {dish.description ? (
        <p className="menu-set-card__desc">{dish.description}</p>
      ) : null}

      <p className="menu-set-card__price">{formatVND(dish.price)}</p>
    </article>
  );
}

export default MenuGrid;
