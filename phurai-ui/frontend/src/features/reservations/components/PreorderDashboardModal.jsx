import React, { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { formatVND } from "@/core/utils/formatCurrency.js";
import { imagePathMap } from "@/features/menu/data/menuAssets.js";
import { Search, Filter, ArrowUpDown } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton.jsx";
import { useFavoritesStore } from "@/features/menu/context/MenuFavoritesContext.jsx";
import "@/components/ui/styles/sfx.css";

function PreorderDashboardModal({ isOpen, onClose, preorderItems, onSave, currentUser }) {
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Filters state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortOrder, setSortOrder] = useState("default");
  
  // Local cart state for the modal
  const [cart, setCart] = useState({});

  const { favorites, toggleFavorite } = useFavoritesStore(currentUser);
  
  const isFavorite = useCallback((dishId) => {
    return favorites.some((f) => String(f.id) === String(dishId) || String(f.dish_id) === String(dishId));
  }, [favorites]);

  useEffect(() => {
    if (isOpen) {
      setCart({ ...preorderItems });
      setSearchTerm("");
      setSelectedCategory("All");
      setSortOrder("default");
    }
  }, [isOpen, preorderItems]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setLoading(true);
    fetch('/api/menu')
      .then(res => res.json())
      .then((json) => {
        if (!active) return;
        const data = json.data || [];
        // Filter out items that are not preorderable
        const valid = data.filter((d) => d.is_preorderable);
        setDishes(valid);
      })
      .catch((err) => console.error("Failed to load preorder menu:", err))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen]);

  const updateQuantity = (dish, delta) => {
    setCart((prev) => {
      const next = { ...prev };
      const currentQty = next[dish.dish_id]?.quantity || 0;
      const newQty = currentQty + delta;

      if (newQty <= 0) {
        delete next[dish.dish_id];
      } else {
        const imageUrl = dish.image_url || dish.image || null;
        next[dish.dish_id] = {
          dish_id: dish.dish_id,
          name: dish.dish_name || dish.name,
          price: dish.price,
          image: imageUrl,
          quantity: newQty,
          notes: next[dish.dish_id]?.notes || "",
        };
      }
      return next;
    });
  };

  const handleSave = () => {
    onSave(cart);
    onClose();
  };

  if (!isOpen) return null;

  // Filter and Sort Logic
  const categories = ["All", ...(currentUser ? ["Bookmarks"] : []), ...new Set(dishes.map(d => d.category).filter(Boolean))];
  
  const filteredDishes = dishes.filter(d => {
    if (selectedCategory === "Bookmarks") {
      return isFavorite(d.dish_id || d.id);
    }
    if (selectedCategory !== "All" && d.category !== selectedCategory) return false;
    const name = d.dish_name || d.name || "";
    if (searchTerm && !name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    if (sortOrder === "price_asc") return a.price - b.price;
    if (sortOrder === "price_desc") return b.price - a.price;
    return 0;
  });

  const modalContent = (
    <div className="sfx-overlay sfx-overlay--visible" style={{ zIndex: 1000, background: 'none' }}>
      <div style={{ width: '1024px', maxWidth: 'none', height: '910px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--color-background)', boxShadow: '0 24px 70px rgba(0,0,0,0.3)', borderRadius: '18px', animation: 'sfxPop 0.24s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
        
        {/* Original Header */}
        <header className="sfx-modal__head" style={{ padding: '20px', background: 'var(--color-background)' }}>
          <div>
            <h2 className="sfx-modal__title" style={{ fontSize: '1.5rem' }}>Select Pre-order Items</h2>
            <p className="sfx-muted">Choose dishes to be ready for your arrival. (Only available items are shown)</p>
          </div>
          <button className="sfx-modal__close" onClick={onClose}>×</button>
        </header>

        {/* Filters Toolbar */}
        <div style={{ padding: '16px 20px', background: 'var(--color-background)', borderBottom: '1px solid #e5e5e5', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 250px', position: 'relative' }}>
            <Search size={18} color="#888" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Search dishes..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '10px 10px 10px 38px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', outline: 'none', background: '#fff' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Filter size={18} color="#555" />
            <select 
              value={selectedCategory} 
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{ padding: '10px 14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', outline: 'none', background: '#fff', cursor: 'pointer' }}
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <ArrowUpDown size={18} color="#555" />
            <select 
              value={sortOrder} 
              onChange={(e) => setSortOrder(e.target.value)}
              style={{ padding: '10px 14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', outline: 'none', background: '#fff', cursor: 'pointer' }}
            >
              <option value="default">Default Sort</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
          </div>
        </div>

        {/* Content Area */}
        <div className="sfx-modal__body" style={{ flex: 1, overflowY: 'auto', padding: '20px', background: 'var(--color-background)' }}>
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }} aria-busy="true" aria-label="Loading dishes">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
                  <Skeleton className="w-full h-[180px] rounded-none" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px' }}>
                    <Skeleton className="w-3/4 h-5" />
                    <Skeleton className="w-full h-3.5" />
                    <Skeleton className="w-1/2 h-3.5" />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                      <Skeleton className="w-16 h-5" />
                      <Skeleton className="w-20 h-8 rounded-lg" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredDishes.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>No pre-order items available matching your criteria.</div>
          ) : (
            <div key={`${searchTerm}-${selectedCategory}-${sortOrder}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
              {filteredDishes.map((dish, index) => {
                const dishId = dish.dish_id;
                const dishName = dish.dish_name || dish.name || "";
                const qty = cart[dishId]?.quantity || 0;
                // Safely handle "null" strings
                const rawUrl = dish.image_url || dish.image;
                let imageUrl = (rawUrl && String(rawUrl).trim() !== "null" && String(rawUrl).trim() !== "undefined") ? rawUrl : null;
                
                // Map the URL through imagePathMap if it exists
                if (imageUrl && imagePathMap[imageUrl]) {
                  imageUrl = imagePathMap[imageUrl];
                }
                
                const isAvailable = dish.is_available !== false && dish.is_available !== 0;
                
                return (
                  <div key={dishId || dish.id || dish._id || index} style={{ 
                    background: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column',
                    animation: 'sfxRise 0.4s both', animationDelay: `${index * 0.05}s`,
                    opacity: isAvailable ? 1 : 0.6
                  }}>
                    <div style={{ height: '180px', background: '#eee', position: 'relative' }}>
                      {imageUrl ? (
                        <img 
                          src={imageUrl} 
                          alt={dishName} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover', filter: isAvailable ? 'none' : 'grayscale(100%)' }} 
                          onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                        />
                      ) : null}
                      <div style={{ width: '100%', height: '100%', display: imageUrl ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa' }}>No Image</div>
                      {currentUser && isAvailable && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(dish);
                          }}
                          style={{
                            position: 'absolute',
                            top: '12px',
                            right: '12px',
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: 'rgba(255, 255, 255, 0.9)',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                            transition: 'all 0.2s',
                            zIndex: 2,
                          }}
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill={isFavorite(dishId || dish.id) ? "var(--rzv-gold, #c2a67a)" : "none"}
                            stroke={isFavorite(dishId || dish.id) ? "var(--rzv-gold, #c2a67a)" : "#666"}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: '#222' }}>
                        {dishName}
                        {!isAvailable && (
                          <span style={{
                            display: 'inline-block',
                            marginLeft: '8px',
                            backgroundColor: '#fee2e2',
                            color: '#dc2626',
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
                            fontSize: '11px',
                            fontWeight: '700',
                            verticalAlign: 'middle'
                          }}>
                            Sold Out
                          </span>
                        )}
                      </h3>
                      <p style={{ margin: '0 0 16px 0', color: '#111', fontWeight: 'bold' }}>{formatVND(dish.price)}</p>
                      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        {!isAvailable && qty === 0 ? (
                          <button 
                            style={{ width: '100%', padding: '10px', background: '#ccc', color: '#666', border: 'none', borderRadius: '6px', cursor: 'not-allowed', fontWeight: 600 }}
                            disabled
                          >
                            Sold Out
                          </button>
                        ) : qty === 0 ? (
                          <button 
                            style={{ width: '100%', padding: '10px', background: '#111', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                            onClick={() => updateQuantity(dish, 1)}
                          >
                            Add to Pre-order
                          </button>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: '#f5f5f5', borderRadius: '6px', padding: '4px' }}>
                            <button 
                              style={{ width: '32px', height: '32px', border: 'none', background: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
                              onClick={() => updateQuantity(dish, -1)}
                            >
                              -
                            </button>
                            <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{qty}</span>
                            <button 
                              style={{ width: '32px', height: '32px', border: 'none', background: isAvailable ? '#111' : '#ccc', color: isAvailable ? '#fff' : '#666', borderRadius: '4px', cursor: isAvailable ? 'pointer' : 'not-allowed', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              onClick={() => isAvailable && updateQuantity(dish, 1)}
                              disabled={!isAvailable}
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Original Footer */}
        <footer className="sfx-modal__foot" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e5e5e5', background: 'var(--color-background)' }}>
          <div>
            <span style={{ color: '#666', fontSize: '0.9rem' }}>Items selected: </span>
            <strong style={{ fontSize: '1.1rem' }}>{Object.values(cart).reduce((sum, i) => sum + i.quantity, 0)}</strong>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={onClose} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
            <button onClick={handleSave} style={{ padding: '10px 24px', background: '#111', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Save Pre-order</button>
          </div>
        </footer>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export default PreorderDashboardModal;
