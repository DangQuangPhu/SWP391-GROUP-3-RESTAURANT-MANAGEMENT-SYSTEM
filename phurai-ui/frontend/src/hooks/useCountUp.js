import React, { useState, useEffect } from 'react';
import { animate } from 'framer-motion';

export function useCountUp(value, duration = 0.9, formatFn = (v) => Math.round(v)) {
  const [displayValue, setDisplayValue] = useState(formatFn(0));

  const prevValue = React.useRef(0);

  useEffect(() => {
    const startValue = prevValue.current;
    const controls = animate(startValue, value, {
      duration,
      ease: [0.215, 0.61, 0.355, 1], // easeOutCubic
      onUpdate(v) {
        setDisplayValue(formatFn(v));
      },
    });
    prevValue.current = value;
    return () => controls.stop();
  }, [value, duration, formatFn]);

  return displayValue;
}
