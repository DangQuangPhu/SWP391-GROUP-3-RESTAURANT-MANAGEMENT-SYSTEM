import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '@/styles/menu.css';
import MenuGrid from '@/components/menu/MenuGrid';
import MenuImagePreview from '@/components/menu/MenuImagePreview';
import MenuSidebar from '@/components/menu/MenuSidebar';
import MenuToolbar from '@/components/menu/MenuToolbar';
import MenuCartDrawer from '@/components/menu/MenuCartDrawer';
import MenuCartFab from '@/components/menu/MenuCartFab';
import { MenuCartProvider, useMenuCart } from '@/context/MenuCartContext';
import { flattenMenuDishes, menuCategories } from '@/data/menuData';
import { menuImages } from '@/data/menuAssets';
import { normalizePrice } from '@/utils/formatCurrency';
import { isMenuCustomer } from '@/utils/menuCustomer';

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

function MenuPageContent({ isAuthenticated, currentUser }) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('default');
  const [contentPhase, setContentPhase] = useState('visible');
  const [previewDish, setPreviewDish] = useState(null);
  const [heroVisible, setHeroVisible] = useState(false);
  const heroRef = useRef(null);
  const cartFabRef = useRef(null);
  const pendingCategoryRef = useRef(null);
  const isTransitioningRef = useRef(false);

  const { addItem, isDrawerOpen } = useMenuCart();
  const canAddToCart = isMenuCustomer(isAuthenticated, currentUser);

  const allDishes = useMemo(
    () =>
      flattenMenuDishes(menuCategories).filter(
        (dish) => dish.type !== 'chef-set' && dish.categoryId !== 'chefs-set-menu'
      ),
    []
  );

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

  const gridLayoutVariant =
    selectedCategory === 'chefs-set-menu' ? 'set-cards' : 'grid';

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

  const handleAddToCart = useCallback(
    (dish) => {
      addItem({
        id: dish.id,
        name: dish.name,
        price: dish.price,
        image: dish.image,
      });
    },
    [addItem]
  );

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
    <div className={`menu-page${isDrawerOpen ? ' menu-page--cart-open' : ''}`}>
      <MenuCartDrawer />

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
              <img src={menuImages.scanImage} alt="" />
            </div>
            <div className="menu-hero__content">
              <p className="menu-hero__eyebrow">QR ORDERING EXPERIENCE</p>
              <h1 className="menu-hero__title" id="menu-hero-title">
                Experience the Future of
                <br />
                Dining with QR Code
              </h1>
              <p className="menu-hero__desc">
                Skip the line and enjoy your favorite dishes with just a scan.
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
                  <MenuGrid
                    dishes={visibleDishes}
                    layoutVariant={gridLayoutVariant}
                    onPreviewImage={setPreviewDish}
                    canAddToCart={canAddToCart}
                    onAddToCart={handleAddToCart}
                    cartFabRef={cartFabRef}
                  />
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {canAddToCart ? <MenuCartFab ref={cartFabRef} /> : null}

      <MenuImagePreview dish={previewDish} onClose={() => setPreviewDish(null)} />
    </div>
  );
}

function Menu({ isAuthenticated = false, currentUser = null }) {
  return (
    <MenuCartProvider>
      <MenuPageContent isAuthenticated={isAuthenticated} currentUser={currentUser} />
    </MenuCartProvider>
  );
}

export default Menu;
