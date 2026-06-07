import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../../styles/menu.css';
import MenuGrid from '../../components/menu/MenuGrid';
import MenuImagePreview from '../../components/menu/MenuImagePreview';
import MenuSidebar from '../../components/menu/MenuSidebar';
import MenuToolbar from '../../components/menu/MenuToolbar';
import { flattenMenuDishes, menuCategories } from '../../data/menuData';
import { menuImages } from '../../data/menuAssets';
import { normalizePrice } from '../../utils/formatCurrency';

function filterDishes(dishes, searchTerm) {
  const query = searchTerm.trim().toLowerCase();
  if (!query) return dishes;
  return dishes.filter((dish) => dish.name.toLowerCase().includes(query));
}

function sortDishes(dishes, sortOrder, selectedCategory) {
  const next = [...dishes];

  if (sortOrder === 'price-asc') {
    next.sort((a, b) => normalizePrice(a.price) - normalizePrice(b.price));
    return next;
  }

  if (sortOrder === 'price-desc') {
    next.sort((a, b) => normalizePrice(b.price) - normalizePrice(a.price));
    return next;
  }

  if (selectedCategory === 'all') {
    next.sort((a, b) => a.name.localeCompare(b.name));
  }

  return next;
}

function Menu() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('default');
  const [contentPhase, setContentPhase] = useState('visible');
  const [previewDish, setPreviewDish] = useState(null);
  const [heroVisible, setHeroVisible] = useState(false);
  const heroRef = useRef(null);
  const pendingCategoryRef = useRef(null);
  const isTransitioningRef = useRef(false);

  const allDishes = useMemo(() => flattenMenuDishes(menuCategories), []);

  const activeCategory = useMemo(
    () => menuCategories.find((category) => category.id === selectedCategory) ?? null,
    [selectedCategory]
  );

  const selectedCategoryLabel = useMemo(() => {
    if (selectedCategory === 'all') return 'ALL MENU';
    return activeCategory?.name.toUpperCase() ?? '';
  }, [selectedCategory, activeCategory]);

  const baseDishes = useMemo(() => {
    if (selectedCategory === 'all') return allDishes;
    return activeCategory?.items.map((item) => ({
      ...item,
      categoryId: activeCategory.id,
      categoryName: activeCategory.name,
    })) ?? [];
  }, [selectedCategory, allDishes, activeCategory]);

  const visibleDishes = useMemo(() => {
    const filtered = filterDishes(baseDishes, searchTerm);
    return sortDishes(filtered, sortOrder, selectedCategory);
  }, [baseDishes, searchTerm, sortOrder, selectedCategory]);

  const contentKey = `${selectedCategory}-${searchTerm}-${sortOrder}`;

  const handleCategorySelect = useCallback((categoryId) => {
    if (isTransitioningRef.current || categoryId === selectedCategory) return;

    isTransitioningRef.current = true;
    pendingCategoryRef.current = categoryId;
    setContentPhase('leaving');

    window.setTimeout(() => {
      setSelectedCategory(pendingCategoryRef.current);
      setContentPhase('entering');

      window.requestAnimationFrame(() => {
        setContentPhase('visible');
        isTransitioningRef.current = false;
      });
    }, 280);
  }, [selectedCategory]);

  const handleReserve = () => {
    window.location.href = '/#reserve';
  };

  useEffect(() => {
    const heroEl = heroRef.current;
    if (!heroEl) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setHeroVisible(true);
      },
      { threshold: 0.2 }
    );

    observer.observe(heroEl);
    return () => observer.disconnect();
  }, []);

  const showEmptyState = visibleDishes.length === 0;

  return (
    <div className="menu-page">
      <div className="menu-body">
        <MenuSidebar
          categories={menuCategories}
          selectedCategory={selectedCategory}
          onSelectCategory={handleCategorySelect}
          onReserve={handleReserve}
        />

        <main className="menu-main">
          <section
            ref={heroRef}
            className={`menu-hero${heroVisible ? ' menu-hero--visible' : ''}`}
            aria-labelledby="menu-hero-title"
          >
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

          <div className="menu-catalog">
            <MenuToolbar
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              sortOrder={sortOrder}
              onSortChange={setSortOrder}
              resultCount={visibleDishes.length}
            />

            <div
              className={`menu-catalog__content menu-catalog__content--${contentPhase}`}
              aria-live="polite"
            >
              {showEmptyState ? (
                <div className="menu-empty menu-content-panel" key={contentKey}>
                  <header className="menu-results-header">
                    <span className="menu-results-header__count">0 DISHES</span>
                    <h2 className="menu-results-header__title">{selectedCategoryLabel}</h2>
                  </header>
                  <p className="menu-empty__title">No dishes found.</p>
                  <p className="menu-empty__hint">
                    Try another search term or browse a different category.
                  </p>
                </div>
              ) : (
                <div className="menu-results menu-content-panel" key={contentKey}>
                  <header className="menu-results-header">
                    <span className="menu-results-header__count">
                      {visibleDishes.length} DISHES
                    </span>
                    <h2 className="menu-results-header__title">{selectedCategoryLabel}</h2>
                  </header>
                  <MenuGrid dishes={visibleDishes} onPreviewImage={setPreviewDish} />
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <MenuImagePreview dish={previewDish} onClose={() => setPreviewDish(null)} />
    </div>
  );
}

export default Menu;
