import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import '../styles/menu.css';
import MenuGrid from '../components/MenuGrid.jsx';
import MenuImagePreview from '../components/MenuImagePreview.jsx';
import MenuSidebar from '../components/MenuSidebar.jsx';
import MenuToolbar from '../components/MenuToolbar.jsx';
import MenuCartDrawer from '../components/MenuCartDrawer.jsx';
import MenuCartFab from '../components/MenuCartFab.jsx';
import { FavoritesSidebar } from '../components/FavoritesSidebar.jsx';
import { MenuCartProvider, useMenuCart } from '../context/MenuCartContext.jsx';
import { MenuFavoritesProvider, useMenuFavorites } from '../context/MenuFavoritesContext.jsx';
import { useTableSession } from '@/features/table-session';
import '@/features/table-session/styles/table-session.css';
import { useSocket } from '@/core/socket/SocketContext.jsx';

import { flattenMenuDishes, menuCategories } from '../data/menuData.js';
import { menuImages } from '../data/menuAssets.js';
import { normalizePrice, formatVND } from '@/core/utils/formatCurrency';
import { isMenuCustomer } from '../utils/menuCustomer.js';

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
  const [searchParams] = useSearchParams();
  const {
    session: tableSession,
    bindFromQuery,
    loading: tableSessionLoading,
    error: tableSessionError,
    hasActiveSession,
  } = useTableSession();
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
  const [apiDishes, setApiDishes] = useState([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSendingOrder, setIsSendingOrder] = useState(false);
  const { socket } = useSocket();

  const fetchMenu = useCallback(() => {
    fetch('/api/menu')
      .then(r => r.json())
      .then(res => {
        if (res.success && Array.isArray(res.data)) {
          setApiDishes(res.data);
        }
      })
      .catch(err => console.error('Failed to fetch menu:', err));
  }, []);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  useEffect(() => {
    if (!socket) return;
    socket.on('menu:updated', fetchMenu);
    return () => {
      socket.off('menu:updated', fetchMenu);
    };
  }, [socket, fetchMenu]);

  const { items, addItem, isDrawerOpen, clearCart, totalQuantity, subtotal, openDrawer } = useMenuCart();
  const { toggleFavorite, isFavorite } = useMenuFavorites();
  // + button only shows when customer scanned a table QR (has active session)
  const canAddToCart = hasActiveSession;
  // Bookmark button shows for any logged-in customer (no QR required)
  const isCustomer = isMenuCustomer(isAuthenticated, currentUser);

  const handleBookmark = useCallback((dish) => {
    toggleFavorite(dish);
  }, [toggleFavorite]);

  const handleSendToKitchen = async () => {
    if (!tableSession?.session_id || items.length === 0) return;
    setIsSendingOrder(true);
    try {
      const res = await fetch('/api/public/qr-order/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: tableSession.session_id,
          cartItems: items
        })
      });
      const data = await res.json();
      if (data.success) {
        clearCart();
        setIsHistoryOpen(true);
      } else {
        alert(data.message || 'Failed to send order');
      }
    } catch (err) {
      alert('Network error while sending order');
    } finally {
      setIsSendingOrder(false);
    }
  };

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
    let items = [];
    if (selectedCategory === 'all') {
      items = allDishes;
    } else {
      items = activeCategory?.items.map((item) => ({
        ...item,
        categoryId: activeCategory.id,
        categoryName: activeCategory.name,
      })) ?? [];
    }

    // Merge API data
    if (apiDishes.length > 0) {
      return items.map(item => {
        const liveDish = apiDishes.find(d => d.name === item.name);
        if (liveDish) {
          return {
            ...item,
            dish_id: liveDish.dish_id,
            price: liveDish.price,
            description: liveDish.description || item.description,
            is_available: liveDish.is_available
          };
        }
        return item;
      });
    }
    return items;
  }, [selectedCategory, allDishes, activeCategory, apiDishes]);

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
        dish_id: dish.dish_id,
        name: dish.name,
        price: dish.price,
        image: dish.image,
      });
    },
    [addItem]
  );

  useEffect(() => {
    const tableId = searchParams.get('table_id');
    const sessionId = searchParams.get('session_id');
    if (!tableId || !sessionId) return;

    bindFromQuery({ tableId, sessionId });
  }, [searchParams, bindFromQuery]);

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

      <div className="menu-body flex flex-col lg:flex-row">
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
              {tableSessionError && !tableSessionLoading ? (
                <div
                  className="menu-session-banner menu-session-banner--error"
                  role="status"
                >
                  {tableSessionError}
                </div>
              ) : null}
              {hasActiveSession && tableSession ? (
                <div className="menu-session-banner" role="status">
                  <span className="menu-session-banner__table">
                    Table {tableSession.table_number || tableSession.table_id}
                  </span>
                  <span className="menu-session-banner__session">
                    Session #{tableSession.session_id}
                  </span>
                </div>
              ) : null}
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
                    isCustomer={isCustomer}
                    onBookmark={handleBookmark}
                    isFavorite={isFavorite}
                  />
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {canAddToCart ? (
        <div className="fixed bottom-0 w-full z-50 lg:static lg:w-auto flex justify-center lg:block bg-white lg:bg-transparent shadow-t-lg lg:shadow-none p-4 lg:p-0">
          <MenuCartFab ref={cartFabRef} />
        </div>
      ) : null}

      <FavoritesSidebar />
      <MenuImagePreview dish={previewDish} onClose={() => setPreviewDish(null)} />
    </div>
  );
}

function Menu({ isAuthenticated = false, currentUser = null }) {
  return (
    <MenuFavoritesProvider currentUser={currentUser}>
      <MenuCartProvider>
        <MenuPageContent isAuthenticated={isAuthenticated} currentUser={currentUser} />
      </MenuCartProvider>
    </MenuFavoritesProvider>
  );
}

export default Menu;