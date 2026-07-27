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

import AIDishRecommendations from '../components/AIDishRecommendations.jsx';
import AIVisualSearchModal from '../components/AIVisualSearchModal.jsx';
import MenuPagination from '../components/MenuPagination.jsx';
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
  const [isVisualSearchOpen, setIsVisualSearchOpen] = useState(false);
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

  const ITEMS_PER_PAGE = 9;
  const [currentPage, setCurrentPage] = useState(1);
  const catalogRef = useRef(null);
  const filterRef = useRef(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchTerm, sortOrder]);

  const totalPages = useMemo(() => {
    return Math.ceil(visibleDishes.length / ITEMS_PER_PAGE) || 1;
  }, [visibleDishes]);

  const paginatedDishes = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return visibleDishes.slice(start, start + ITEMS_PER_PAGE);
  }, [visibleDishes, currentPage]);

  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
    filterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);


  const gridLayoutVariant =
    selectedCategory === 'chefs-set-menu' ? 'set-cards' : 'grid';

  const contentKey = `${selectedCategory}-${searchTerm}-${sortOrder}-p${currentPage}`;


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

  const isModalActive = isVisualSearchOpen || Boolean(previewDish);

  useEffect(() => {
    const navbar = document.querySelector('.phurai-navbar');
    const footer = document.querySelector('.phurai-footer');

    if (isModalActive) {
      document.body.classList.add('modal-open');
      if (navbar) {
        navbar.style.filter = 'blur(8px)';
        navbar.style.webkitFilter = 'blur(8px)';
        navbar.style.pointerEvents = 'none';
      }
      if (footer) {
        footer.style.filter = 'blur(8px)';
        footer.style.webkitFilter = 'blur(8px)';
        footer.style.pointerEvents = 'none';
      }
    } else {
      document.body.classList.remove('modal-open');
      if (navbar) {
        navbar.style.filter = '';
        navbar.style.webkitFilter = '';
        navbar.style.pointerEvents = '';
      }
      if (footer) {
        footer.style.filter = '';
        footer.style.webkitFilter = '';
        footer.style.pointerEvents = '';
      }
    }

    return () => {
      document.body.classList.remove('modal-open');
      if (navbar) {
        navbar.style.filter = '';
        navbar.style.webkitFilter = '';
        navbar.style.pointerEvents = '';
      }
      if (footer) {
        footer.style.filter = '';
        footer.style.webkitFilter = '';
        footer.style.pointerEvents = '';
      }
    };
  }, [isModalActive]);

  const showEmptyState = visibleDishes.length === 0;

  return (
    <div className={`menu-page${isDrawerOpen ? ' menu-page--cart-open' : ''}${isModalActive ? ' menu-page--modal-open' : ''}`}>
      <MenuCartDrawer />

      {isModalActive && (
        <div
          className="menu-modal-backdrop-blur"
          style={{
            position: 'fixed',
            inset: 0,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            backgroundColor: 'rgba(0, 0, 0, 0.35)',
            zIndex: 99990,
            pointerEvents: 'none'
          }}
        />
      )}

      <div
        className="menu-body flex flex-col lg:flex-row"
        style={{
          filter: isModalActive ? 'blur(8px)' : 'none',
          WebkitFilter: isModalActive ? 'blur(8px)' : 'none',
          transition: 'filter 0.35s ease, -webkit-filter 0.35s ease',
          pointerEvents: isModalActive ? 'none' : 'auto'
        }}
      >
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
                <div className="menu-session-banner" role="status" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span className="menu-session-banner__table" style={{ display: 'flex', alignItems: 'center' }}>
                    Table {tableSession.table_number || tableSession.table_id}
                    {tableSession.table_status && (
                      <motion.span
                        layoutId="customer-table-status"
                        transition={{ type: "spring", stiffness: 300, damping: 22 }}
                        className={`menu-session-banner__status menu-session-banner__status--${tableSession.table_status.toLowerCase()}`}
                        style={{
                          marginLeft: '8px',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                          backgroundColor: tableSession.table_status.toLowerCase() === 'cleaning' ? '#faf5ff' : '#fffbeb',
                          color: tableSession.table_status.toLowerCase() === 'cleaning' ? '#7c3aed' : '#d97706',
                          border: tableSession.table_status.toLowerCase() === 'cleaning' ? '1px solid #d8b4fe' : '1px solid #fde68a',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <span className="relative flex h-1.5 w-1.5">
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${tableSession.table_status.toLowerCase() === 'cleaning' ? 'bg-purple-400' : 'bg-amber-400'}`}></span>
                          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${tableSession.table_status.toLowerCase() === 'cleaning' ? 'bg-purple-500' : 'bg-amber-500'}`}></span>
                        </span>
                        {tableSession.table_status}
                      </motion.span>
                    )}
                  </span>
                  <span className="menu-session-banner__session">
                    Session #{tableSession.session_id}
                  </span>
                </div>
              ) : null}
            </div>
          </section>

          <div className="menu-catalog" ref={catalogRef}>
            <AIDishRecommendations
              recommendedDishes={baseDishes}
              onOpenVisualSearch={() => setIsVisualSearchOpen(true)}
              onPreviewImage={setPreviewDish}
            />

            <AIVisualSearchModal
              isOpen={isVisualSearchOpen}
              onClose={() => setIsVisualSearchOpen(false)}
              menuDishes={baseDishes}
              onPreviewImage={setPreviewDish}
            />

            <div ref={filterRef} style={{ scrollMarginTop: '100px' }}>
              <MenuToolbar
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                sortOrder={sortOrder}
                onSortChange={setSortOrder}
                resultCount={visibleDishes.length}
              />
            </div>


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
                      {visibleDishes.length} DISHES (PAGE {currentPage} OF {totalPages})
                    </span>
                    <h2 className="menu-results-header__title">{selectedCategoryLabel}</h2>
                  </header>

                  <MenuGrid
                    dishes={paginatedDishes}
                    layoutVariant={gridLayoutVariant}
                    onPreviewImage={setPreviewDish}
                    canAddToCart={canAddToCart}
                    onAddToCart={handleAddToCart}
                    cartFabRef={cartFabRef}
                    isCustomer={isCustomer}
                    onBookmark={handleBookmark}
                    isFavorite={isFavorite}
                  />

                  {/* Apple Style Fluid Spring Pagination */}
                  <MenuPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
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

      <FavoritesSidebar onPreviewImage={setPreviewDish} />
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