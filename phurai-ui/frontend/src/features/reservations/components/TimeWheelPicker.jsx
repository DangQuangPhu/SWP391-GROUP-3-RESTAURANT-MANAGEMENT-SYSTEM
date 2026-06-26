import React, { useRef, useState, useEffect, useCallback } from 'react';
import './TimeWheelPicker.css';

// Generate 24h hours (08 to 22) and strict minutes (00, 15, 30, 45)
const HOURS = Array.from({ length: 15 }, (_, i) => String(i + 8).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];
const ITEM_HEIGHT = 40; // Height of each scroll item in pixels

const WheelColumn = React.memo(({ items, selectedValue, onChange, label }) => {
  const containerRef = useRef(null);
  const [localIndex, setLocalIndex] = useState(items.indexOf(selectedValue) !== -1 ? items.indexOf(selectedValue) : 0);
  const isScrolling = useRef(false);

  // Sync incoming props only if not actively scrolling (Anti-Jitter)
  useEffect(() => {
    if (!isScrolling.current) {
      const idx = items.indexOf(selectedValue);
      if (idx !== -1 && idx !== localIndex) {
        setLocalIndex(idx);
        if (containerRef.current) {
          containerRef.current.scrollTop = idx * ITEM_HEIGHT;
        }
      }
    }
  }, [selectedValue, items, localIndex]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    
    isScrolling.current = true;
    
    // Debounce the snap and update logic
    clearTimeout(containerRef.current.scrollTimeout);
    containerRef.current.scrollTimeout = setTimeout(() => {
      isScrolling.current = false;
      const scrollY = containerRef.current.scrollTop;
      const index = Math.round(scrollY / ITEM_HEIGHT);
      
      const clampedIndex = Math.max(0, Math.min(index, items.length - 1));
      
      // Snap to position
      containerRef.current.scrollTo({
        top: clampedIndex * ITEM_HEIGHT,
        behavior: 'smooth'
      });

      if (clampedIndex !== localIndex) {
        setLocalIndex(clampedIndex);
        onChange(items[clampedIndex]); // Inform parent ONLY on snap finish
      }
    }, 150);
  }, [items, localIndex, onChange]);

  return (
    <div className="wheel-column-wrapper">
      <div className="wheel-label">{label}</div>
      <div className="wheel-container" onScroll={handleScroll} ref={containerRef}>
        <div className="wheel-padding"></div>
        {items.map((item, idx) => (
          <div 
            key={item} 
            className={`wheel-item ${idx === localIndex ? 'active' : ''}`}
            onClick={() => {
                containerRef.current.scrollTo({ top: idx * ITEM_HEIGHT, behavior: 'smooth' });
            }}
          >
            {item}
          </div>
        ))}
        <div className="wheel-padding"></div>
      </div>
    </div>
  );
});

export const TimeWheelPicker = React.memo(({ selectedTime, onTimeChange }) => {
  // Ensure we have a valid starting state (e.g. "18:30")
  const [currentHour, currentMinute] = (selectedTime || '18:00').split(':');

  const handleHourChange = useCallback((newHour) => {
    onTimeChange(`${newHour}:${currentMinute}`);
  }, [currentMinute, onTimeChange]);

  const handleMinuteChange = useCallback((newMinute) => {
    onTimeChange(`${currentHour}:${newMinute}`);
  }, [currentHour, onTimeChange]);

  return (
    <div className="time-wheel-picker">
      <WheelColumn items={HOURS} selectedValue={currentHour} onChange={handleHourChange} label="Hour" />
      <div className="wheel-separator">:</div>
      <WheelColumn items={MINUTES} selectedValue={currentMinute} onChange={handleMinuteChange} label="Min" />
    </div>
  );
});
