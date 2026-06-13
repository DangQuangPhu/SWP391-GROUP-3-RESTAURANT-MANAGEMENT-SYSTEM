const EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
const DURATION = 560;

/**
 * Animate a thumbnail from a menu card toward the cart FAB.
 */
export function flyToCart({ sourceElement, targetElement, imageSrc, onComplete }) {
  if (!sourceElement || !targetElement || !imageSrc) {
    onComplete?.();
    return;
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    onComplete?.();
    return;
  }

  const sourceRect = sourceElement.getBoundingClientRect();
  const targetRect = targetElement
    ? targetElement.getBoundingClientRect()
    : {
        left: window.innerWidth - 88,
        top: window.innerHeight - 112,
        width: 48,
        height: 48,
      };

  const startX = sourceRect.left + sourceRect.width / 2;
  const startY = sourceRect.top + sourceRect.height / 2;
  const endX = targetRect.left + targetRect.width / 2;
  const endY = targetRect.top + targetRect.height / 2;

  const flyer = document.createElement('img');
  flyer.src = imageSrc;
  flyer.alt = '';
  flyer.setAttribute('aria-hidden', 'true');
  flyer.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    'width:72px',
    'height:72px',
    'object-fit:cover',
    'border-radius:10px',
    'pointer-events:none',
    'z-index:9999',
    'box-shadow:0 8px 24px rgba(52,39,22,0.18)',
    `transform:translate(${startX - 36}px, ${startY - 36}px) scale(1)`,
  ].join(';');

  document.body.appendChild(flyer);

  const animation = flyer.animate(
    [
      {
        transform: `translate(${startX - 36}px, ${startY - 36}px) scale(1)`,
        opacity: 1,
      },
      {
        transform: `translate(${endX - 36}px, ${endY - 36}px) scale(0.25)`,
        opacity: 0.35,
      },
    ],
    { duration: DURATION, easing: EASING, fill: 'forwards' }
  );

  animation.onfinish = () => {
    flyer.remove();
    onComplete?.();
  };

  animation.oncancel = () => {
    flyer.remove();
    onComplete?.();
  };
}
