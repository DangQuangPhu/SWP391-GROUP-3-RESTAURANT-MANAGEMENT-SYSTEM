import React, { useState, useEffect } from 'react';

export function useCountUp(value, duration = 0.8, formatFn = (v) => Math.round(v)) {
  const [displayValue, setDisplayValue] = useState(formatFn(0));
  const prevValue = React.useRef(0);

  useEffect(() => {
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
  }, [value, duration, formatFn]);

  return displayValue;
}
