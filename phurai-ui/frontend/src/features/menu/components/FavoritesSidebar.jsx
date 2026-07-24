import { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bookmark, Trash2, Search } from 'lucide-react';
import { useMenuFavorites } from '../context/MenuFavoritesContext.jsx';
import { formatVND } from '@/core/utils/formatCurrency';
import { menuImages, resolveDishImage } from '../data/menuAssets.js';

const FALLBACK_IMAGE = menuImages.hero;


export function FavoritesSidebar({ onPreviewImage }) {
  const { favorites, removeFavorite, isSidebarOpen, closeSidebar } = useMenuFavorites();
  const [searchTerm, setSearchTerm] = useState('');
  const panelRef = useRef(null);


  /* Reset search on close */
  useEffect(() => {
    if (!isSidebarOpen) setSearchTerm('');
  }, [isSidebarOpen]);

  /* Close on Escape */
  useEffect(() => {
    if (!isSidebarOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') closeSidebar();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isSidebarOpen, closeSidebar]);

  /* Trap scroll on body */
  useEffect(() => {
    if (isSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isSidebarOpen]);

  const filteredFavorites = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();
    if (!query) return favorites;
    return favorites.filter((dish) =>
      (dish.name || '').toLowerCase().includes(query) ||
      (dish.description || '').toLowerCase().includes(query)
    );
  }, [favorites, searchTerm]);

  return (
    <AnimatePresence>
      {isSidebarOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/40 z-[998]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={closeSidebar}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            className="fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-2xl z-[999] flex flex-col"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            role="dialog"
            aria-label="My Favorites"
            aria-modal="true"
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 20px 16px',
                borderBottom: '1px solid #f0ece6',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Bookmark size={18} style={{ color: '#9b845e' }} />
                <span
                  style={{
                    fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
                    fontSize: '16px',
                    fontWeight: 700,
                    color: '#342716',
                    letterSpacing: '-0.02em',
                  }}
                >
                  My Favorites
                </span>
                {favorites.length > 0 && (
                  <span
                    style={{
                      background: '#9b845e',
                      color: '#fff',
                      borderRadius: '999px',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
                    }}
                  >
                    {favorites.length}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={closeSidebar}
                aria-label="Close favorites"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  border: 'none',
                  background: '#f5f5f5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#342716',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Filter Search Bar */}
            {favorites.length > 3 && (
              <div style={{ padding: '12px 16px 4px 16px', position: 'relative' }}>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter saved dishes..."
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 34px',
                    borderRadius: '9999px',
                    border: '1px solid #e2dad0',
                    fontSize: '0.82rem',
                    color: '#342716',
                    outline: 'none',
                    fontFamily: "'Hanken Grotesk', system-ui, sans-serif"
                  }}
                />
                <Search size={14} style={{ position: 'absolute', left: '28px', top: '20px', color: '#9b845e' }} />
              </div>
            )}

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {favorites.length === 0 ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    gap: '12px',
                    color: '#9b8a7a',
                    textAlign: 'center',
                    padding: '40px 20px',
                    fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
                  }}
                >
                  <Bookmark size={40} style={{ opacity: 0.3 }} />
                  <p style={{ fontSize: '15px', fontWeight: 600, color: '#4d463d' }}>
                    No favorites yet
                  </p>
                  <p style={{ fontSize: '13px', lineHeight: 1.5 }}>
                    Tap the bookmark icon on any dish to save it here for later.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <AnimatePresence>
                    {filteredFavorites.map((dish) => (
                      <motion.div
                        key={dish.id ?? dish.dish_id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: 40 }}
                        transition={{ duration: 0.2 }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '10px 12px',
                          background: '#faf9f6',
                          borderRadius: '12px',
                          border: '1px solid #f0ece6',
                        }}
                      >
                        <img
                          src={resolveDishImage(dish.image) || FALLBACK_IMAGE}
                          alt={dish.name}
                          onClick={() => onPreviewImage?.({ ...dish, image: resolveDishImage(dish.image) })}
                          onError={(e) => { e.currentTarget.src = FALLBACK_IMAGE; }}
                          style={{
                            width: '56px',
                            height: '56px',
                            objectFit: 'cover',
                            borderRadius: '8px',
                            flexShrink: 0,
                            cursor: 'zoom-in',
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => onPreviewImage?.({ ...dish, image: resolveDishImage(dish.image) })}>

                          <p
                            style={{
                              fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
                              fontSize: '14px',
                              fontWeight: 600,
                              color: '#342716',
                              margin: 0,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {dish.name}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeFavorite(dish.id ?? dish.dish_id)}
                          aria-label={`Remove ${dish.name} from favorites`}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            border: 'none',
                            background: '#fee2e2',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#dc2626',
                            flexShrink: 0,
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Footer */}
            {favorites.length > 0 && (
              <div
                style={{
                  padding: '16px 20px',
                  borderTop: '1px solid #f0ece6',
                  fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
                  fontSize: '12px',
                  color: '#9b8a7a',
                  textAlign: 'center',
                }}
              >
                {favorites.length} saved {favorites.length === 1 ? 'dish' : 'dishes'} · Saved to account
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default FavoritesSidebar;
