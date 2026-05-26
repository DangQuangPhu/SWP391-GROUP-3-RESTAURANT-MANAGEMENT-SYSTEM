import '../../styles/menu.css';
import { menuIcons, menuImages } from '../../data/menuAssets';

const sidebarLinks = [
  { label: 'Sushi & Sashimi', icon: 0, iconClass: 'icon-18', sectionId: 'sushi-sashimi' },
  { label: 'Noodle & Rice', icon: 1, iconClass: 'icon-20', sectionId: 'noodle-rice' },
  {
    label: 'Signature Dish',
    icon: 2,
    iconClass: 'icon-20',
    sectionId: 'signature-dish',
    active: true,
  },
  { label: 'Seafood', icon: 3, iconClass: 'icon-seafood', sectionId: 'seafood' },
  {
    label: 'Barbecue &\nGrill',
    icon: 4,
    iconClass: 'icon-grill',
    sectionId: 'barbecue-grill',
    multiline: true,
  },
  { label: 'Desserts', icon: 5, iconClass: 'icon-desserts', sectionId: 'desserts' },
  { label: 'Beverages', icon: 6, iconClass: 'icon-18', sectionId: 'beverages' },
  { label: "Chef's Set Menu", icon: 7, iconClass: 'icon-chef', sectionId: 'chefs-set-menu' },
];

function MenuItem({ image, imageCrop, name, price, description, badge }) {
  return (
    <article className="menu-item">
      <div className={`menu-item__thumb${imageCrop ? ' menu-item__thumb--crop' : ''}`}>
        <img src={image} alt="" loading="lazy" />
      </div>
      <div className="menu-item__details">
        <div className={`menu-item__row${badge ? ' menu-item__row--badge' : ''}`}>
          <div className="menu-item__name-wrap">
            <h4 className="menu-item__name">{name}</h4>
            {badge ? <span className="menu-item__badge">{badge}</span> : null}
          </div>
          <p className="menu-item__price">{price}</p>
        </div>
        <p className="menu-item__desc">{description}</p>
      </div>
    </article>
  );
}

function MenuSection({ id, title, subtitle, titleDark, variant, children }) {
  return (
    <section className="menu-section" id={id}>
      <header className="menu-section__header">
        <h2 className={`menu-section__title${titleDark ? ' menu-section__title--dark' : ''}`}>
          {title}
        </h2>
        <p className="menu-section__subtitle">{subtitle}</p>
      </header>
      {variant === 'cards' ? children : <div className="menu-items">{children}</div>}
    </section>
  );
}

function Menu() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSidebarClick = (event, sectionId) => {
    event.preventDefault();
    const el = document.getElementById(sectionId);
    if (el) {
      const offset = 92 + 24;
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  return (
    <div className="menu-page">
      <div className="menu-body">
        <aside className="menu-sidebar" aria-label="Menu categories">
          <nav className="menu-sidebar__nav">
            {sidebarLinks.map((link) => (
              <a
                key={link.sectionId}
                href={`#${link.sectionId}`}
                className={`menu-sidebar__link${link.active ? ' is-active' : ''}${link.multiline ? ' menu-sidebar__link--multiline' : ''}`}
                onClick={(e) => handleSidebarClick(e, link.sectionId)}
              >
                <img
                  src={menuIcons.nav[link.icon]}
                  alt=""
                  className={link.iconClass}
                />
                <span>
                  {link.multiline
                    ? link.label.split('\n').map((line, i) => (
                        <span key={line}>
                          {i > 0 ? <br /> : null}
                          {line}
                        </span>
                      ))
                    : link.label}
                </span>
              </a>
            ))}
          </nav>
          <button type="button" className="menu-sidebar__cta">
            RESERVE A TABLE
          </button>
        </aside>

        <main className="menu-main">
          <section className="menu-hero" aria-labelledby="menu-hero-title">
            <div className="menu-hero__image-wrap">
              <img src={menuImages.hero} alt="" />
            </div>
            <div className="menu-hero__content">
              <p className="menu-hero__eyebrow">EXECUTIVE CHEF SELECTION</p>
              <h1 className="menu-hero__title" id="menu-hero-title">
                The Art of
                <br />
                Minimalist
                <br />
                Flavor, Crafted
                <br />
                with Precision.
              </h1>
              <p className="menu-hero__desc">
                Experience a journey through the seasons with ingredients sourced directly from
                Japan&apos;s finest markets, prepared with ancient techniques and modern innovation.
              </p>
            </div>
          </section>

          <div className="menu-sections">
            <MenuSection id="sushi-sashimi" title="SUSHI & SASHIMI" subtitle="FRESH DAILY SELECTION">
              <MenuItem
                image={menuImages.yellowtailJalapeno}
                imageCrop
                name="YELLOWTAIL JALAPEÑO"
                price="$38"
                description="thinly sliced yellowtail, yuzu soy sauce, garlic puree, jalapeño"
              />
              <MenuItem
                image={menuImages.toroTartare}
                name="TORO TARTARE WITH CAVIAR"
                price="$48"
                description="finely chopped fatty tuna with wasabi soy and oscietra caviar"
              />
              <MenuItem
                image={menuImages.flukeSashimi}
                name="FLUKE SASHIMI DRY MISO"
                price="$38"
                description="yuzu juice, extra virgin olive oil, dry miso, chives"
              />
              <MenuItem
                image={menuImages.newStyleSashimi}
                name="NEW STYLE SASHIMI"
                price="$42"
                description="seared sashimi with sesame seeds, chives, ginger, and garlic soy"
              />
              <MenuItem
                image={menuImages.salmonNewStyle}
                name="SALMON NEW STYLE"
                price="$36"
                description="atlantic salmon, thinly sliced, seared with hot olive oil"
              />
            </MenuSection>

            <MenuSection id="noodle-rice" title="NOODLE & RICE" subtitle="TRADITIONAL COMFORT">
              <MenuItem
                image={menuImages.seafoodUdon}
                name="SEAFOOD UDON"
                price="$32"
                description="thick wheat noodles with assorted seafood in a rich dashi broth"
              />
              <MenuItem
                image={menuImages.wagyuFriedRice}
                name="WAGYU FRIED RICE"
                price="$28"
                description="wok-charred rice with premium wagyu beef and seasonal vegetables"
              />
              <MenuItem
                image={menuImages.lobsterFriedRice}
                name="LOBSTER FRIED RICE"
                price="$34"
                description="delicate jasmine rice with butter-poached lobster and garlic"
              />
            </MenuSection>

            <MenuSection id="signature-dish" title="SIGNATURE DISH" subtitle="THE KAISEKI ESSENCE">
              <MenuItem
                image={menuImages.blackCodMiso}
                name="BLACK COD WITH MISO"
                price="$52"
                description="tender black cod marinated for three days in a sweet miso glaze"
              />
              <MenuItem
                image={menuImages.rockShrimpTempura}
                name="ROCK SHRIMP TEMPURA"
                price="$37"
                description="served with either creamy spicy sauce or butter ponzu"
              />
            </MenuSection>

            <MenuSection id="seafood" title="SEAFOOD" subtitle="COASTAL TREASURES">
              <MenuItem
                image={menuImages.lobsterWasabiPepper}
                name="LOBSTER WASABI PEPPER"
                price="$72"
                description="whole lobster sautéed with black pepper, wasabi, and seasonal greens"
              />
              <MenuItem
                image={menuImages.grilledSalmon}
                name="GRILLED SALMON"
                price="$41"
                description="anticucho or teriyaki glaze, served with crispy baby bok choy"
              />
            </MenuSection>

            <MenuSection id="barbecue-grill" title="BARBECUE & GRILL" subtitle="THE ART OF FIRE">
              <MenuItem
                image={menuImages.japaneseA5Wagyu}
                name="JAPANESE A5 WAGYU"
                price="$200"
                description="the pinnacle of beef quality, flame-grilled over binchotan charcoal"
                badge="LIMITED"
              />
              <MenuItem
                image={menuImages.grilledLambChops}
                name="GRILLED LAMB CHOPS"
                price="$28"
                description="marinated in rosemary and garlic, served with rosemary-miso sauce"
              />
            </MenuSection>

            <MenuSection id="desserts" title="DESSERTS" subtitle="SWEET REFINEMENT">
              <MenuItem
                image={menuImages.bentoChocolateCake}
                name="BENTO BOX CHOCOLATE CAKE"
                price="$16"
                description="warm chocolate fondant with green tea matcha ice cream"
              />
              <MenuItem
                image={menuImages.misoCappuccino}
                name="MISO CAPPUCCINO"
                price="$14"
                description="coffee soil, miso foam, salted caramel ice cream"
              />
            </MenuSection>

            <MenuSection id="beverages" title="BEVERAGES" subtitle="LIQUID ARTISTRY">
              <MenuItem
                image={menuImages.hokusetsuJunmai}
                name="HOKUSETSU JUNMAI"
                price="$25"
                description="premium house sake, clean and dry profile"
              />
              <MenuItem
                image={menuImages.lycheeMartini}
                name="LYCHEE MARTINI"
                price="$18"
                description="vodka, lychee liqueur, fresh lychee juice"
              />
            </MenuSection>

            <MenuSection
              id="chefs-set-menu"
              title="CHEF'S SET MENU"
              subtitle="THE ULTIMATE EXPERIENCE"
              titleDark
              variant="cards"
            >
              <div className="menu-set-cards">
                <article className="menu-set-card">
                  <p className="menu-set-card__label">RECOMMENDED</p>
                  <h3 className="menu-set-card__title">
                    OMAKASE
                    <br />
                    EXPERIENCE
                  </h3>
                  <p className="menu-set-card__desc">
                    a personalized multi-course journey designed by our head chef to showcase the
                    season&apos;s best.
                  </p>
                  <p className="menu-set-card__price">$175</p>
                  <button type="button" className="menu-set-card__btn">
                    INQUIRE
                  </button>
                </article>
                <article className="menu-set-card menu-set-card--alt">
                  <p className="menu-set-card__label menu-set-card__label--muted">TRADITION</p>
                  <h3 className="menu-set-card__title">
                    SIGNATURE
                    <br />
                    TASTING
                  </h3>
                  <p className="menu-set-card__desc">
                    a curated seven-course menu featuring our world-renowned signature dishes.
                  </p>
                  <p className="menu-set-card__price">$150</p>
                  <button type="button" className="menu-set-card__btn">
                    INQUIRE
                  </button>
                </article>
              </div>
            </MenuSection>
          </div>
        </main>
      </div>

      <div className="menu-floating" aria-label="Utility controls">
        <button type="button" className="menu-floating__btn" aria-label="Accessibility">
          <img src={menuIcons.accessibility} alt="" width={20} height={20} />
        </button>
        <button
          type="button"
          className="menu-floating__btn"
          aria-label="Back to top"
          onClick={scrollToTop}
        >
          <img src={menuIcons.scrollTop} alt="" width={20} height={20} />
        </button>
      </div>
    </div>
  );
}

export default Menu;
