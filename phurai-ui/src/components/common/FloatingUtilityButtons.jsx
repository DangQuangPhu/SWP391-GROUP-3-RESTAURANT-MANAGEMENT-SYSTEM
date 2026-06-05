import { homeIcons } from '../../data/homeAssets';

function FloatingUtilityButtons() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="phurai-floating-utils" aria-label="Utility controls">
      <button type="button" className="phurai-floating-utils__btn" aria-label="Accessibility">
        <img src={homeIcons.accessibility} alt="" className="icon nav-icon" />
      </button>
      <button
        type="button"
        className="phurai-floating-utils__btn"
        aria-label="Back to top"
        onClick={scrollToTop}
      >
        <img src={homeIcons.scrollTopAlt} alt="" className="icon nav-icon" />
      </button>
    </div>
  );
}

export default FloatingUtilityButtons;
