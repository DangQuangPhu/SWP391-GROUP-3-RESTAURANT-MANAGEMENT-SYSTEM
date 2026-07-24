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
