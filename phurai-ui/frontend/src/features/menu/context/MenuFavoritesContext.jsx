import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { resolveDishImage } from '../data/menuAssets.js';


/**
 * Per-user favorites storage.
 *
 * Storage key is scoped to the logged-in user's ID:
 *   phurai_favorites_<userId>
 *
 * This means:
 *  ✅ Favorites persist through reload (localStorage)
 *  ✅ 100 different accounts each have their OWN favorites list
 *  ✅ Switching accounts loads that account's favorites
 *  ✅ Logging out clears the visible list (data is still in storage, just hidden)
 *  ✅ Logging back in restores your personal list
 */

const MenuFavoritesContext = createContext(null);

// Resolve a stable user key from whatever shape currentUser is
function resolveUserKey(currentUser) {
  if (!currentUser) return null;
  const id =
    currentUser.user_id ??
    currentUser.userId ??
    currentUser.id ??
    currentUser.email ??
    null;
  return id ? `phurai_favorites_${id}` : null;
}

function loadStoredFavorites(storageKey) {
  if (!storageKey) return [];
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistFavorites(storageKey, items) {
  if (!storageKey) return;
  try {
    if (!items.length) {
      localStorage.removeItem(storageKey);
      return;
    }
    localStorage.setItem(storageKey, JSON.stringify(items));
  } catch {
    /* ignore quota errors */
  }
}

/**
 * Provider — must be given currentUser prop so storage is per-account.
 * If currentUser is null (guest), favorites are empty and nothing is saved.
 */
export function MenuFavoritesProvider({ children, currentUser }) {
  const storageKeyRef = useRef(resolveUserKey(currentUser));

  // When user changes (login / logout / switch account) update the key
  const storageKey = resolveUserKey(currentUser);

  const [favorites, setFavorites] = useState(() =>
    loadStoredFavorites(storageKey)
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // When the logged-in user changes, reload their personal list
  useEffect(() => {
    const newKey = resolveUserKey(currentUser);
    if (newKey !== storageKeyRef.current) {
      storageKeyRef.current = newKey;
      setFavorites(loadStoredFavorites(newKey));
      setIsSidebarOpen(false);
    }
  }, [currentUser]);

  // Persist whenever favorites change
  useEffect(() => {
    persistFavorites(storageKeyRef.current, favorites);
  }, [favorites]);

  const isFavorite = useCallback(
    (dishId) => favorites.some((f) => f.id === dishId || f.dish_id === dishId),
    [favorites]
  );

  const toggleFavorite = useCallback((dish) => {
    // Guest — not allowed to bookmark
    if (!storageKeyRef.current) return;

    setFavorites((prev) => {
      const exists = prev.some(
        (f) => f.id === dish.id || f.dish_id === dish.id
      );
      if (exists) {
        return prev.filter(
          (f) => f.id !== dish.id && f.dish_id !== dish.id
        );
      }
      const resolvedImg = resolveDishImage(dish.image || dish.image_url) || dish.image || dish.image_url;
      return [
        ...prev,
        {
          id: dish.id,
          dish_id: dish.dish_id || dish.id,
          name: dish.name || dish.dish_name,
          price: dish.price,
          image: resolvedImg,
          description: dish.description,
        },
      ];
    });
  }, []);


  const removeFavorite = useCallback((dishId) => {
    setFavorites((prev) =>
      prev.filter((f) => f.id !== dishId && f.dish_id !== dishId)
    );
  }, []);

  const openSidebar = useCallback(() => setIsSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);

  const value = useMemo(
    () => ({
      favorites,
      isFavorite,
      toggleFavorite,
      removeFavorite,
      isSidebarOpen,
      openSidebar,
      closeSidebar,
    }),
    [
      favorites,
      isFavorite,
      toggleFavorite,
      removeFavorite,
      isSidebarOpen,
      openSidebar,
      closeSidebar,
    ]
  );

  return (
    <MenuFavoritesContext.Provider value={value}>
      {children}
    </MenuFavoritesContext.Provider>
  );
}

export function useMenuFavorites() {
  const ctx = useContext(MenuFavoritesContext);
  if (!ctx) {
    throw new Error('useMenuFavorites must be used within MenuFavoritesProvider');
  }
  return ctx;
}

/**
 * Standalone hook for reading favorites outside MenuPage (e.g. ProfilePage).
 * Accepts currentUser so it reads the correct per-user storage key.
 * Syncs across tabs via the storage event.
 */
export function useFavoritesStore(currentUser) {
  const storageKey = resolveUserKey(currentUser);
  const [favorites, setFavorites] = useState(() =>
    loadStoredFavorites(storageKey)
  );

  // Reload when user changes (e.g. navigating from profile to another account)
  useEffect(() => {
    setFavorites(loadStoredFavorites(resolveUserKey(currentUser)));
  }, [currentUser]);

  // Sync across browser tabs
  useEffect(() => {
    if (!storageKey) return;
    const onStorage = (e) => {
      if (e.key === storageKey) {
        setFavorites(loadStoredFavorites(storageKey));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [storageKey]);

  const removeFavorite = useCallback(
    (dishId) => {
      const next = favorites.filter(
        (f) => f.id !== dishId && f.dish_id !== dishId
      );
      setFavorites(next);
      persistFavorites(storageKey, next);
    },
    [favorites, storageKey]
  );

  const toggleFavorite = useCallback(
    (dish) => {
      if (!storageKey) return;
      const targetId = dish.dish_id || dish.id;
      const exists = favorites.some((f) => f.id === targetId || f.dish_id === targetId);
      let next;
      if (exists) {
        next = favorites.filter((f) => f.id !== targetId && f.dish_id !== targetId);
      } else {
        const resolvedImg = resolveDishImage(dish.image || dish.image_url) || dish.image || dish.image_url;
        next = [
          ...favorites,
          {
            id: targetId,
            dish_id: targetId,
            name: dish.dish_name || dish.name,
            price: dish.price,
            image: resolvedImg,
            description: dish.description || "",
          },
        ];
      }
      setFavorites(next);
      persistFavorites(storageKey, next);
    },
    [favorites, storageKey]
  );


  return { favorites, removeFavorite, toggleFavorite };
}
