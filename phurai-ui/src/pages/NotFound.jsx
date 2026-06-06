import notFoundImage from "../assets/images/fork-near-plate-with-twig.jpg";
import "./NotFound.css";

function HomeIcon() {
  return (
    <svg
      className="not-found-page__button-icon"
      viewBox="0 0 12 14"
      width="12"
      height="14"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M6 0.75 0.75 6v7.25H4V9.25h4V13.25h3.25V6L6 0.75Z"
      />
    </svg>
  );
}

function NotFound({ onNavigate }) {
  const navigate = (page) => {
    if (typeof onNavigate === "function") {
      onNavigate(page);
      return;
    }

    const paths = {
      home: "/",
      menus: "/menus",
      reservation: "/",
    };
    window.location.href = paths[page] || "/";
  };

  return (
    <main className="not-found-page" aria-labelledby="not-found-heading">
      <div className="not-found-page__hero">
        <div className="not-found-page__visual">
          <img
            src={notFoundImage}
            alt=""
            className="not-found-page__image"
            loading="eager"
            decoding="async"
          />
          <div className="not-found-page__overlay" aria-hidden="true" />
        </div>

        <div className="not-found-page__content">
          <div className="not-found-page__inner">
            <div className="not-found-page__code-wrap" aria-hidden="true">
              <span className="not-found-page__code">404</span>
            </div>

            <h1 id="not-found-heading" className="not-found-page__title">
              THIS PAGE IS NOT AVAILABLE
            </h1>

            <div className="not-found-page__divider" role="presentation" />

            <p className="not-found-page__description">
              The page you are looking for may have been moved, removed, or is no
              longer being served. Allow us to guide you back to our main floor.
            </p>

            <div className="not-found-page__actions">
              <button
                type="button"
                className="not-found-page__button not-found-page__button--primary"
                onClick={() => navigate("home")}
              >
                <HomeIcon />
                <span>BACK TO HOME</span>
              </button>

             
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default NotFound;
