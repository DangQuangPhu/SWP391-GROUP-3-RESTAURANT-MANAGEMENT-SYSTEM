import { useEffect, useState } from 'react';
import accessibilityIcon from '@/assets/icons/accessibility.svg';
import scrollTopAltIcon from '@/assets/icons/scroll-top-alt.svg';
import '@/styles/FloatingActionButtons.css';

function FloatingActionButtons() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 80);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <div
      className={`floating-actions${isScrolled ? ' is-scrolled' : ''}`}
      aria-label="Utility controls"
    >
      <button
        type="button"
        className="floating-actions__button floating-actions__accessibility"
        aria-label="Accessibility"
      >
        <img src={accessibilityIcon} alt="" className="floating-actions__icon" />
      </button>

      <button
        type="button"
        className="floating-actions__button floating-actions__scroll-top"
        onClick={scrollToTop}
        aria-label="Scroll to top"
        aria-hidden={!isScrolled}
        tabIndex={isScrolled ? 0 : -1}
      >
        <img src={scrollTopAltIcon} alt="" className="floating-actions__icon" />
      </button>
    </div>
  );
}

export default FloatingActionButtons;
