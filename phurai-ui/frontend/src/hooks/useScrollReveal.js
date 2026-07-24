<<<<<<< HEAD
import { useEffect, useRef } from 'react';

export function useScrollReveal(options = {}, externalRef = null) {
  const { enabled = true, ...observerOptions } = options;
  const internalRef = useRef(null);
  const ref = externalRef || internalRef;

  useEffect(() => {
    if (!enabled) return undefined;
    
    const el = ref.current;
    if (!el) return undefined;

    // Respect reduced motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      el.classList.add('is-visible');
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-visible');
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px', ...observerOptions }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled, observerOptions.threshold, observerOptions.rootMargin]);

  return ref;
}
=======
/**
 * useScrollReveal.js
 * Re-exports the canonical useScrollReveal hook from advancedScrollToolkit.
 * Multiple home-page components import from this path; this shim ensures
 * they all receive the same implementation without duplication.
 */
export { useScrollReveal } from './advancedScrollToolkit.js';
>>>>>>> f806b6a516e7391a2486c456e4d2139f2df344d6
