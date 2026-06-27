import React, { useState, useEffect, useRef } from 'react';

export function useCountUp(value, duration = 0.8, formatFn = (v) => Math.round(v), delay = 600) {
  const [displayValue, setDisplayValue] = useState(formatFn(0));
  const prevValue = useRef(0);
  const [shouldStart, setShouldStart] = useState(false);

  // Delay the start of the initial count-up until the page is settled
  useEffect(() => {
    const timer = setTimeout(() => {
      setShouldStart(true);
    }, delay);
    return () => clearTimeout(timer);
  }, [delay]);

  useEffect(() => {
    if (!shouldStart) {
      setDisplayValue(formatFn(0));
      return;
    }

    const start = prevValue.current;
    const end = Number(value) || 0;
    
    const durationMs = duration * 1000;
    const startTime = performance.now();

    let rAF;
    const tick = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      
      // Smooth easeOutQuad function: f(t) = t * (2 - t)
      const easeProgress = progress * (2 - progress);
      
      const currentVal = start + (end - start) * easeProgress;
      setDisplayValue(formatFn(currentVal));

      if (progress < 1) {
        rAF = requestAnimationFrame(tick);
      } else {
        setDisplayValue(formatFn(end));
      }
    };

    rAF = requestAnimationFrame(tick);
    prevValue.current = end;

    return () => {
      if (rAF) cancelAnimationFrame(rAF);
    };
  }, [value, duration, formatFn, shouldStart]);

  return displayValue;
}
