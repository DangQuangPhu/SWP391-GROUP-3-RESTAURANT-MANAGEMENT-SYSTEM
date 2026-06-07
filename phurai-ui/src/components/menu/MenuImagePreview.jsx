import { useCallback, useEffect, useState } from 'react';
import { formatVND } from '../../utils/formatCurrency';

function MenuImagePreview({ dish, onClose }) {
  const [closing, setClosing] = useState(false);

  const handleClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(() => {
      setClosing(false);
      onClose();
    }, 220);
  }, [closing, onClose]);

  useEffect(() => {
    if (!dish) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event.key === 'Escape') handleClose();
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [dish, handleClose]);

  if (!dish) return null;

  return (
    <div
      className={`menu-image-preview${closing ? ' menu-image-preview--closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="menu-image-preview-title"
    >
      <div
        className="menu-image-preview__overlay"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div className="menu-image-preview__content">
        <button
          type="button"
          className="menu-image-preview__close"
          onClick={handleClose}
          aria-label="Close image preview"
        >
          ×
        </button>
        <img src={dish.image} alt={dish.name} className="menu-image-preview__image" />
        <div className="menu-image-preview__meta">
          <h3 id="menu-image-preview-title" className="menu-image-preview__title">
            {dish.name}
          </h3>
          <p className="menu-image-preview__price">{formatVND(dish.price)}</p>
        </div>
      </div>
    </div>
  );
}

export default MenuImagePreview;
