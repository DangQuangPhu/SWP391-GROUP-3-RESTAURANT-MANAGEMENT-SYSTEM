import React, { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { formatVND } from "@/core/utils/formatCurrency.js";
import { imagePathMap } from "@/features/menu/data/menuAssets.js";
import { Search, Filter, ArrowUpDown } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton.jsx";
import { useFavoritesStore } from "@/features/menu/context/MenuFavoritesContext.jsx";
import "@/components/ui/styles/sfx.css";

function CustomSelect({ value, onChange, options, icon: Icon }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = () => setIsOpen(false);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [isOpen]);

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="rd-datepicker-input"
        style={{
          padding: '10px 14px',
          border: '1px solid rgba(255,255,255,0.16)',
          borderRadius: '8px',
          fontSize: '14px',
          outline: 'none',
          background: 'rgba(0,0,0,0.2)',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          userSelect: 'none'
        }}
      >
        {Icon && <Icon size={16} color="rgba(255, 255, 255, 0.6)" />}
        <span>{selectedOption.label}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            marginLeft: '4px',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            opacity: 0.6
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 100,
            minWidth: '200px',
            background: 'rgba(30, 27, 24, 0.88)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.16)',
            borderRadius: '16px',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
            padding: '6px',
            animation: 'appleFadeSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
          }}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange(opt.value)}
                style={{
                  padding: '8px 12px',
                  background: isSelected ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                  color: isSelected ? '#ffd064' : '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '13px',
                  fontWeight: isSelected ? '600' : 'normal',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent';
                }}
              >
                <span>{opt.label}</span>
                {isSelected && (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#ffd064"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

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

  const categoryOptions = categories.map(cat => ({ value: cat, label: cat }));
  const sortOptions = [
    { value: "default", label: "Default Sort" },
    { value: "price_asc", label: "Price: Low to High" },
    { value: "price_desc", label: "Price: High to Low" }
  ];

  const modalContent = (
    <div 
      className="sfx-overlay sfx-overlay--visible" 
      style={{ 
        zIndex: 1000, 
        background: 'rgba(10, 8, 6, 0.78)', 
        backdropFilter: 'blur(40px)', 
        WebkitBackdropFilter: 'blur(40px)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        position: 'fixed',
        inset: 0
      }}
    >
      <div 
        className="rd-card" 
        style={{ 
          width: '1024px', 
          maxWidth: '95vw', 
          height: '910px', 
          maxHeight: '90vh', 
          display: 'flex', 
          flexDirection: 'column', 
          padding: 0,
          borderRadius: '28px',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          background: 'rgba(26, 23, 20, 0.85)',
          backdropFilter: 'blur(28px) saturate(220%)',
          WebkitBackdropFilter: 'blur(28px) saturate(220%)',
          boxShadow: '0 24px 70px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          opacity: 1,
          animation: 'appleFadeSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}
      >
        
        {/* Header */}
        <header className="sfx-modal__head" style={{ padding: '20px', background: 'transparent', borderBottom: '1px solid rgba(255, 255, 255, 0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="rd-card-title" style={{ fontSize: '1.4rem', color: '#fff', margin: 0, fontWeight: 700 }}>Select Pre-order Items</h2>
            <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)', margin: '4px 0 0' }}>Choose dishes to be ready for your arrival. (Only available items are shown)</p>
          </div>
          <button className="sfx-modal__close" onClick={onClose} style={{ color: '#fff', fontSize: '24px', border: 'none', background: 'none', cursor: 'pointer' }}>×</button>
        </header>

        {/* Filters Toolbar */}
        <div style={{ padding: '16px 20px', background: 'transparent', borderBottom: '1px solid rgba(255, 255, 255, 0.12)', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 250px', position: 'relative' }}>
            <Search size={18} color="rgba(255, 255, 255, 0.4)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Search dishes..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rd-datepicker-input"
              style={{ width: '100%', padding: '10px 10px 10px 38px', border: '1px solid rgba(255,255,255,0.16)', borderRadius: '8px', fontSize: '14px', outline: 'none', background: 'rgba(0, 0, 0, 0.2)', color: '#fff' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <CustomSelect 
              value={selectedCategory} 
              onChange={setSelectedCategory}
              options={categoryOptions}
              icon={Filter}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <CustomSelect 
              value={sortOrder} 
              onChange={setSortOrder}
              options={sortOptions}
              icon={ArrowUpDown}
            />
          </div>
        </div>

        {/* Content Area */}
        <div className="sfx-modal__body" style={{ flex: 1, overflowY: 'auto', padding: '20px', background: 'transparent' }}>
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }} aria-busy="true" aria-label="Loading dishes">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{ background: 'rgba(255, 255, 255, 0.04)', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column' }}>
                  <Skeleton className="w-full h-[180px] rounded-none opacity-20" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px' }}>
                    <Skeleton className="w-3/4 h-5 opacity-20" />
                    <Skeleton className="w-full h-3.5 opacity-20" />
                    <Skeleton className="w-1/2 h-3.5 opacity-20" />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                      <Skeleton className="w-16 h-5 opacity-20" />
                      <Skeleton className="w-20 h-8 rounded-lg opacity-20" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredDishes.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>No pre-order items available matching your criteria.</div>
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
                    background: 'rgba(255, 255, 255, 0.04)', 
                    borderRadius: '16px', 
                    overflow: 'hidden', 
                    border: '1px solid rgba(255, 255, 255, 0.08)', 
                    display: 'flex', 
                    flexDirection: 'column',
                    animation: 'sfxRise 0.4s both', 
                    animationDelay: `${index * 0.05}s`,
                    opacity: isAvailable ? 1 : 0.6
                  }}>
                    <div style={{ height: '180px', background: 'rgba(0, 0, 0, 0.2)', position: 'relative' }}>
                      {imageUrl ? (
                        <img 
                          src={imageUrl} 
                          alt={dishName} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover', filter: isAvailable ? 'none' : 'grayscale(100%)' }} 
                          onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                        />
                      ) : null}
                      <div style={{ width: '100%', height: '100%', display: imageUrl ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)' }}>No Image</div>
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
                            background: 'rgba(0, 0, 0, 0.5)',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                            transition: 'all 0.2s',
                            zIndex: 2,
                          }}
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill={isFavorite(dishId || dish.id) ? "var(--rzv-gold, #ffd064)" : "none"}
                            stroke={isFavorite(dishId || dish.id) ? "var(--rzv-gold, #ffd064)" : "rgba(255,255,255,0.6)"}
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
                      <h3 style={{ margin: '0 0 8px 0', fontSize: '1.05rem', color: '#fff', fontWeight: 600 }}>
                        {dishName}
                        {!isAvailable && (
                          <span style={{
                            display: 'inline-block',
                            marginLeft: '8px',
                            backgroundColor: 'rgba(239, 68, 68, 0.2)',
                            color: '#ef4444',
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
                      <p style={{ margin: '0 0 16px 0', color: 'var(--rzv-gold, #ffd064)', fontWeight: 'bold' }}>{formatVND(dish.price)}</p>
                      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        {!isAvailable && qty === 0 ? (
                          <button 
                            style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)', border: 'none', borderRadius: '8px', cursor: 'not-allowed', fontWeight: 600 }}
                            disabled
                          >
                            Sold Out
                          </button>
                        ) : qty === 0 ? (
                          <button 
                            style={{ width: '100%', padding: '10px', background: 'var(--rzv-gold, #ffd064)', color: '#16120f', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                            onClick={() => updateQuantity(dish, 1)}
                          >
                            Add to Pre-order
                          </button>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px', padding: '4px', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <button 
                              style={{ width: '32px', height: '32px', border: 'none', background: 'rgba(255, 255, 255, 0.08)', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              onClick={() => updateQuantity(dish, -1)}
                            >
                              -
                            </button>
                            <span style={{ fontWeight: 'bold', fontSize: '1.05rem', color: '#fff' }}>{qty}</span>
                            <button 
                              style={{ width: '32px', height: '32px', border: 'none', background: isAvailable ? 'var(--rzv-gold, #ffd064)' : 'rgba(255,255,255,0.08)', color: isAvailable ? '#16120f' : 'rgba(255,255,255,0.3)', borderRadius: '6px', cursor: isAvailable ? 'pointer' : 'not-allowed', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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

        {/* Footer */}
        <footer className="sfx-modal__foot" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.12)', background: 'transparent' }}>
          <div>
            <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.9rem' }}>Items selected: </span>
            <strong style={{ fontSize: '1.1rem', color: '#fff' }}>{Object.values(cart).reduce((sum, i) => sum + i.quantity, 0)}</strong>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={onClose} className="rd-btn-outline" style={{ padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, margin: 0 }}>Cancel</button>
            <button onClick={handleSave} className="rd-btn-primary" style={{ padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, margin: 0 }}>Save Pre-order</button>
          </div>
        </footer>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export default PreorderDashboardModal;
