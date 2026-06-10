import { forwardRef } from 'react';
import { useMenuCart } from '@/context/MenuCartContext';

const MenuCartFab = forwardRef(function MenuCartFab(_props, ref) {
  const { totalQuantity, badgePop, openDrawer, isDrawerOpen } = useMenuCart();
  const isVisible = totalQuantity > 0 && !isDrawerOpen;

  return (
    <button
      ref={ref}
      type="button"
      className={`menu-cart-fab${isVisible ? '' : ' menu-cart-fab--hidden'}`}
      onClick={openDrawer}
      aria-label={isVisible ? `View cart, ${totalQuantity} items` : 'View cart'}
      aria-hidden={!isVisible}
      tabIndex={isVisible ? 0 : -1}
    >
      <span className="menu-cart-fab__icon" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M6 6h15l-1.5 9h-12L6 6Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M6 6 5 3H2"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="9.5" cy="19" r="1.4" fill="currentColor" />
          <circle cx="17.5" cy="19" r="1.4" fill="currentColor" />
        </svg>
      </span>
      <span className="menu-cart-fab__label">View Cart</span>
      {isVisible ? (
        <span
          className={`menu-cart-fab__badge${badgePop ? ' menu-cart-fab__badge--pop' : ''}`}
          aria-hidden="true"
        >
          {totalQuantity > 99 ? '99+' : totalQuantity}
        </span>
      ) : null}
    </button>
  );
});

export default MenuCartFab;
