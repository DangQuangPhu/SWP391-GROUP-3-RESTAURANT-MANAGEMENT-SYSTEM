import React, { useState, useEffect, useRef } from 'react';

export function useCountUp(value, duration = 0.8, formatFn = (v) => Math.round(v)) {
  const [displayValue, setDisplayValue] = useState(formatFn(0));
  const prevValue = useRef(0);

  useEffect(() => {
    let start = prevValue.current;
    const end = Number(value) || 0;
    
    if (start === end) {
      setDisplayValue(formatFn(end));
      return;
    }

    const durationMs = duration * 1000;
    const stepTime = 16; // ~60fps
    const totalSteps = Math.max(1, durationMs / stepTime);

    // Quadratic easing out: starts smooth and decelerates gracefully
    const easeOutQuad = (t, b, c, d) => {
      t /= d;
      return -c * t * (t - 2) + b;
    };

    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      if (currentStep >= totalSteps) {
        clearInterval(timer);
        setDisplayValue(formatFn(end));
        prevValue.current = end;
      } else {
        const val = easeOutQuad(currentStep, start, end - start, totalSteps);
        setDisplayValue(formatFn(val));
      }
    }, stepTime);

    return () => {
      clearInterval(timer);
      prevValue.current = end;
    };
  }, [value, duration, formatFn]);

  return displayValue;
}
