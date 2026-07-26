import { useRef, useState } from 'react';
import { menuImages, resolveDishImage } from '../data/menuAssets.js';
import { formatVND } from '@/core/utils/formatCurrency';
import { flyToCart } from '../utils/flyToCart.js';
import { BookmarkButton } from './BookmarkButton.jsx';

const FALLBACK_IMAGE = menuImages.hero;


function MenuGrid({
  dishes,
  onPreviewImage,
  layoutVariant = 'grid',
  canAddToCart = false,
  onAddToCart,
  cartFabRef,
  isCustomer = false,
  onBookmark,
  isFavorite,
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
            isCustomer={isCustomer}
            onBookmark={onBookmark}
            isFavorite={isFavorite}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="menu-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {dishes.map((dish, index) => (
        <MenuCard
          key={dish.id}
          dish={dish}
          index={index}
          onPreviewImage={onPreviewImage}
          canAddToCart={canAddToCart}
          onAddToCart={onAddToCart}
          cartFabRef={cartFabRef}
          isCustomer={isCustomer}
          onBookmark={onBookmark}
          isFavorite={isFavorite}
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
      className="menu-card__add-btn absolute bottom-3 right-3 bg-amber-500 hover:bg-amber-600 text-white w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center shadow-[0_4px_12px_rgba(245,158,11,0.3)] active:scale-95 transition-all z-10 border-2 border-white"
      onClick={onClick}
      aria-label={label}
    >
      <span className="text-xl md:text-2xl leading-none font-light mb-0.5">+</span>
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
  isCustomer,
  onBookmark,
  isFavorite,
}) {
  const resolved = resolveDishImage(dish.image) || FALLBACK_IMAGE;
  const [imageSrc, setImageSrc] = useState(resolved);
  const { imageWrapRef, handleAdd } = useAddToCartHandler({
    dish,
    imageSrc,
    canAddToCart,
    onAddToCart,
    cartFabRef,
  });
  const saved = isFavorite ? isFavorite(dish.id ?? dish.dish_id) : false;

  const openPreview = () => {
    onPreviewImage?.({ ...dish, image: imageSrc });
  };


  return (
    <article
      className={`menu-card menu-grid__card menu-reveal menu-reveal-item flex flex-row md:flex-col gap-4 p-3 md:p-0 bg-white md:bg-transparent rounded-xl md:rounded-none shadow-sm md:shadow-none relative ${(dish.is_available === false || dish.is_available === 0) ? 'menu-card--unavailable' : ''}`}
      style={{
        animationDelay: `${index * 45}ms`,
        '--reveal-index': index,
        ...((dish.is_available === false || dish.is_available === 0) ? { opacity: 0.85 } : {})
      }}
    >
      <div className="menu-card__imageArea relative w-24 h-24 md:w-full md:h-auto shrink-0 rounded-lg md:rounded-none overflow-hidden">
        <button
          type="button"
          className="menu-card__imageBtn"
          onClick={openPreview}
          aria-label={`View larger image of ${dish.name}`}
        >
          <div
            ref={imageWrapRef}
            className="menu-card__imageWrap menu-grid__media"
            style={(dish.is_available === false || dish.is_available === 0) ? { filter: 'grayscale(100%) opacity(75%)' } : {}}
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
        {isCustomer ? (
          <BookmarkButton
            isSaved={saved}
            onToggle={() => onBookmark?.(dish)}
          />
        ) : null}
        {canAddToCart && dish.is_available !== false && dish.is_available !== 0 ? (
          <MenuAddButton
            onClick={handleAdd}
            label={`Add ${dish.name} to cart`}
          />
        ) : null}
      </div>
      <div className="menu-card__body menu-grid__body flex-1 flex flex-col justify-center">
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
        <p className="menu-card__price menu-grid__price">
          {formatVND(dish.price)}
          {(dish.is_available === false || dish.is_available === 0) && (
            <span style={{
              display: 'inline-block',
              marginLeft: '12px',
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              padding: '4px 12px',
              borderRadius: '9999px',
              fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
              fontSize: '12px',
              fontWeight: '700',
              verticalAlign: 'middle'
            }}>
              Out of Dish
            </span>
          )}
        </p>
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
  isCustomer,
  onBookmark,
  isFavorite,
}) {
  const resolved = resolveDishImage(dish.image) || FALLBACK_IMAGE;
  const [imageSrc, setImageSrc] = useState(resolved);
  const { imageWrapRef, handleAdd } = useAddToCartHandler({
    dish,
    imageSrc,
    canAddToCart,
    onAddToCart,
    cartFabRef,
  });

  const saved = isFavorite ? isFavorite(dish.id ?? dish.dish_id) : false;

  const setCard = dish.setCard ?? {};
  const titleLines = setCard.titleLines ?? [dish.name];

  const openPreview = () => {
    onPreviewImage?.({ ...dish, image: imageSrc });
  };

  return (
    <article
      className={`menu-set-card menu-reveal menu-reveal-item flex flex-row md:flex-col gap-4 p-3 md:p-0 bg-white md:bg-transparent rounded-xl md:rounded-none shadow-sm md:shadow-none relative ${setCard.alt ? ' menu-set-card--alt' : ''} ${(dish.is_available === false || dish.is_available === 0) ? 'menu-card--unavailable' : ''}`}
      style={{
        animationDelay: `${index * 60}ms`,
        '--reveal-index': index,
        ...((dish.is_available === false || dish.is_available === 0) ? { opacity: 0.85 } : {})
      }}
    >
      <div className="menu-set-card__imageArea relative w-24 h-24 md:w-full md:h-auto shrink-0 rounded-lg md:rounded-none overflow-hidden">
        <button
          type="button"
          className="menu-set-card__imageBtn"
          onClick={openPreview}
          aria-label={`View larger image of ${dish.name}`}
        >
          <div
            ref={imageWrapRef}
            className="menu-set-card__imageWrap"
            style={(dish.is_available === false || dish.is_available === 0) ? { filter: 'grayscale(100%) opacity(70%)' } : {}}
          >
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
        {canAddToCart && dish.is_available !== false && dish.is_available !== 0 ? (
          <MenuAddButton
            onClick={handleAdd}
            label={`Add ${dish.name} to cart`}
          />
        ) : null}
        {isCustomer ? (
          <BookmarkButton
            isSaved={saved}
            onToggle={() => onBookmark?.(dish)}
          />
        ) : null}
      </div>

      {setCard.label ? (
        <p
          className={`menu-set-card__label${setCard.labelMuted ? ' menu-set-card__label--muted' : ''
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

      <p className="menu-card__price menu-grid__price">
        {formatVND(dish.price)}
        {(dish.is_available === false || dish.is_available === 0) && (
          <span style={{
            display: 'inline-block',
            marginLeft: '12px',
            backgroundColor: '#fee2e2',
            color: '#dc2626',
            padding: '4px 12px',
            borderRadius: '9999px',
            fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
            fontSize: '12px',
            fontWeight: '700',
            verticalAlign: 'middle'
          }}>
            Out of Dish
          </span>
        )}
      </p>
    </article>
  );
}

export default MenuGrid;
