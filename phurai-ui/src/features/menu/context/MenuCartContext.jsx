import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from 'react';

const STORAGE_KEY = 'phurai_menu_cart';

const MenuCartContext = createContext(null);

function loadStoredCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistCart(items) {
  try {
    if (!items.length) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* ignore quota errors */
  }
}

function cartReducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':
      return action.items;

    case 'ADD': {
      const dish = action.dish;
      const existing = state.find((item) => item.id === dish.id);
      if (existing) {
        return state.map((item) =>
          item.id === dish.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...state,
        {
          id: dish.id,
          name: dish.name,
          price: dish.price,
          image: dish.image,
          quantity: 1,
        },
      ];
    }

    case 'SET_QUANTITY': {
      const nextQty = action.quantity;
      if (nextQty <= 0) {
        return state.filter((item) => item.id !== action.id);
      }
      return state.map((item) =>
        item.id === action.id ? { ...item, quantity: nextQty } : item
      );
    }

    case 'REMOVE':
      return state.filter((item) => item.id !== action.id);

    case 'CLEAR':
      return [];

    default:
      return state;
  }
}

export function MenuCartProvider({ children }) {
  const [items, dispatch] = useReducer(cartReducer, []);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [badgePop, setBadgePop] = useState(false);

  useEffect(() => {
    dispatch({ type: 'HYDRATE', items: loadStoredCart() });
  }, []);

  useEffect(() => {
    persistCart(items);
    if (!items.length) {
      setIsDrawerOpen(false);
    }
  }, [items]);

  const triggerBadgePop = useCallback(() => {
    setBadgePop(true);
    window.setTimeout(() => setBadgePop(false), 420);
  }, []);

  const addItem = useCallback(
    (dish) => {
      dispatch({ type: 'ADD', dish });
      triggerBadgePop();
    },
    [triggerBadgePop]
  );

  const setQuantity = useCallback((id, quantity) => {
    dispatch({ type: 'SET_QUANTITY', id, quantity });
  }, []);

  const removeItem = useCallback((id) => {
    dispatch({ type: 'REMOVE', id });
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR' });
  }, []);

  const totalQuantity = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items]
  );

  const value = useMemo(
    () => ({
      items,
      addItem,
      setQuantity,
      removeItem,
      clearCart,
      totalQuantity,
      subtotal,
      isDrawerOpen,
      openDrawer: () => setIsDrawerOpen(true),
      closeDrawer: () => setIsDrawerOpen(false),
      toggleDrawer: () => setIsDrawerOpen((open) => !open),
      badgePop,
    }),
    [
      items,
      addItem,
      setQuantity,
      removeItem,
      clearCart,
      totalQuantity,
      subtotal,
      isDrawerOpen,
      badgePop,
    ]
  );

  return (
    <MenuCartContext.Provider value={value}>{children}</MenuCartContext.Provider>
  );
}

export function useMenuCart() {
  const ctx = useContext(MenuCartContext);
  if (!ctx) {
    throw new Error('useMenuCart must be used within MenuCartProvider');
  }
  return ctx;
}
