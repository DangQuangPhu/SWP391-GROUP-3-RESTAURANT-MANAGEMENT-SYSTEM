import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark } from 'lucide-react';

/**
 * BookmarkButton — animated bookmark icon adapted from BookmarkIconButton.
 * White background, black icon — matches the `+` add-to-cart button style.
 *
 * Props:
 *   isSaved   bool     — controlled saved state
 *   onToggle  function — called when button is clicked
 */

const particleConfigs = Array.from({ length: 5 }, (_, i) => {
  const angle = (i / 5) * (2 * Math.PI);
  const radius = 18 + Math.random() * 8;
  const scale = 0.8 + Math.random() * 0.4;
  const duration = 0.6 + Math.random() * 0.1;
  return { angle, radius, scale, duration, delay: i * 0.04 };
});

export function BookmarkButton({ isSaved, onToggle }) {
  const handleClick = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      onToggle?.();
    },
    [onToggle]
  );

  return (
    <div className="relative flex items-center justify-center">
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={isSaved}
        aria-label={isSaved ? 'Remove from favorites' : 'Add to favorites'}
        className="menu-card__bookmark-btn absolute bottom-3 left-3 bg-white text-gray-900 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.15)] active:scale-95 transition-all z-10 border-2 border-white/80"
      >
        <motion.div
          initial={{ scale: 1 }}
          animate={{ scale: isSaved ? 1.1 : 1 }}
          whileTap={{ scale: 0.85, rotate: isSaved ? 0 : -10 }}
          transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          className="relative flex items-center justify-center"
        >
          {/* Outline bookmark (always visible) */}
          <Bookmark
            size={16}
            className="opacity-60"
            aria-hidden="true"
          />

          {/* Filled bookmark (visible when saved) */}
          <Bookmark
            size={16}
            aria-hidden="true"
            className="absolute inset-0 transition-all duration-300"
            style={{
              opacity: isSaved ? 1 : 0,
              fill: isSaved ? 'currentColor' : 'none',
            }}
          />

          {/* Burst ring */}
          <AnimatePresence>
            {isSaved && (
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    'radial-gradient(circle, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0) 80%)',
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 1.4, 1], opacity: [0, 0.4, 0] }}
                exit={{}}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              />
            )}
          </AnimatePresence>
        </motion.div>
      </button>

      {/* Particle burst */}
      <AnimatePresence>
        {isSaved && (
          <div
            className="absolute pointer-events-none"
            style={{ bottom: '12px', left: '12px', width: '32px', height: '32px' }}
          >
            {particleConfigs.map((cfg, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full bg-gray-800"
                style={{
                  width: `${4 + Math.random() * 2}px`,
                  height: `${4 + Math.random() * 2}px`,
                  filter: 'blur(0.5px)',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                }}
                initial={{ scale: 0, opacity: 0.3, x: 0, y: 0 }}
                animate={{
                  scale: [0, cfg.scale, 0],
                  opacity: [0.3, 0.8, 0],
                  x: [0, Math.cos(cfg.angle) * cfg.radius],
                  y: [0, Math.sin(cfg.angle) * cfg.radius * 0.75],
                }}
                transition={{
                  duration: cfg.duration,
                  delay: cfg.delay,
                  ease: 'easeOut',
                }}
              />
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default BookmarkButton;
