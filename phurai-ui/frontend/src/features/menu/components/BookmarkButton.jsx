import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark } from 'lucide-react';

/**
 * BookmarkButton — animated Apple Liquid Glass bookmark button.
 * Hover Spring & Glow animation matching Apple design language.
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
      <motion.button
        type="button"
        onClick={handleClick}
        aria-pressed={isSaved}
        aria-label={isSaved ? 'Remove from favorites' : 'Add to favorites'}
        whileHover={{ scale: 1.18, y: -2 }}
        whileTap={{ scale: 0.88 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        style={{
          boxShadow: isSaved
            ? '0 6px 18px rgba(155, 132, 94, 0.4), inset 0 1px 1px #ffffff'
            : '0 4px 14px rgba(0, 0, 0, 0.12), inset 0 1px 1px #ffffff',
          borderColor: isSaved ? '#9b845e' : 'rgba(255, 255, 255, 0.9)',
          background: isSaved ? '#ffffff' : 'rgba(255, 255, 255, 0.92)'
        }}
        className="menu-card__bookmark-btn absolute bottom-3 left-3 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-colors z-10 border-2"
      >
        <motion.div
          initial={{ scale: 1 }}
          animate={{ scale: isSaved ? 1.1 : 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          className="relative flex items-center justify-center"
        >
          {/* Outline bookmark */}
          <Bookmark
            size={18}
            className="transition-colors duration-300"
            style={{
              color: isSaved ? '#9b845e' : '#4d463d',
              opacity: isSaved ? 1 : 0.75
            }}
            aria-hidden="true"
          />

          {/* Filled bookmark when saved */}
          <Bookmark
            size={18}
            aria-hidden="true"
            className="absolute inset-0 transition-all duration-300"
            style={{
              opacity: isSaved ? 1 : 0,
              fill: isSaved ? '#9b845e' : 'none',
              color: '#9b845e'
            }}
          />

          {/* Burst ring */}
          <AnimatePresence>
            {isSaved && (
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    'radial-gradient(circle, rgba(155, 132, 94, 0.35) 0%, rgba(155, 132, 94, 0) 80%)',
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 1.5, 1], opacity: [0, 0.6, 0] }}
                exit={{}}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            )}
          </AnimatePresence>
        </motion.div>
      </motion.button>

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
                className="absolute rounded-full"
                style={{
                  width: `${4 + Math.random() * 2}px`,
                  height: `${4 + Math.random() * 2}px`,
                  background: '#9b845e',
                  filter: 'blur(0.5px)',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                }}
                initial={{ scale: 0, opacity: 0.3, x: 0, y: 0 }}
                animate={{
                  scale: [0, cfg.scale, 0],
                  opacity: [0.4, 0.9, 0],
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
