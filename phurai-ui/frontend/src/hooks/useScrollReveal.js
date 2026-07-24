/**
 * useScrollReveal.js
 * Re-exports the canonical useScrollReveal hook from advancedScrollToolkit.
 * Multiple home-page components import from this path; this shim ensures
 * they all receive the same implementation without duplication.
 */
export { useScrollReveal } from './advancedScrollToolkit.js';
