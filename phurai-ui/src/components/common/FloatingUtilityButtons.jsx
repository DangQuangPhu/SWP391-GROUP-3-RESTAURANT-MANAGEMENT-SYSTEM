import { homeIcons } from '../../data/homeAssets';

function FloatingUtilityButtons() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="phurai-floating-utils" aria-label="Utility controls">
      <button type="button" className="phurai-floating-utils__btn" aria-label="Accessibility">
        <img src={homeIcons.accessibility} alt="" width={20} height={20} />
      </button>
      <button
        type="button"
        className="phurai-floating-utils__btn"
        aria-label="Back to top"
        onClick={scrollToTop}
      >
        <img src={homeIcons.scrollTopAlt} alt="" width={20} height={20} />
      </button>
    </div>
  );
}

export default FloatingUtilityButtons;
