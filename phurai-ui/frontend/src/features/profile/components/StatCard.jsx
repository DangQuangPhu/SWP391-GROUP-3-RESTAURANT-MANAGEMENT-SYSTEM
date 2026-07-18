import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useCountUp } from '@/hooks/useCountUp';

export default function StatCard({ label, value, icon: Icon, deltaPercent, formatValue, theme }) {
  const [flashKey, setFlashKey] = useState(0);
  const [trend, setTrend] = useState('none');
  
  // Track previous value to detect changes. Initialize to 0 so it flashes on first mount.
  const prevValue = useRef(0);
  const endValue = Number(value) || 0;

  // Synchronous state derivation (React recommended pattern for derived state)
  // This is completely immune to Strict Mode double-invocations and unmounts!
  if (prevValue.current !== endValue) {
    setTrend(endValue > prevValue.current ? 'up' : 'down');
    setFlashKey(k => k + 1);
    prevValue.current = endValue;
  }

  const animatedValue = useCountUp(value, 1.2, formatValue);

  // Animate the delta percentage if available
  const formatDelta = (v) => {
    const absV = Math.abs(v);
    return Number.isInteger(absV) ? absV : absV.toFixed(1);
  };
  const animatedDelta = useCountUp(
    deltaPercent !== null ? Math.abs(deltaPercent) : 0, 
    1.2, 
    formatDelta
  );

  const themeClasses = {
    blue: {
      border: 'border-t-[#4a7b9d]',
      iconBg: 'bg-[#4a7b9d]/10 text-[#4a7b9d]'
    },
    red: {
      border: 'border-t-[#a95a3f]',
      iconBg: 'bg-[#a95a3f]/10 text-[#a95a3f]'
    },
    green: {
      border: 'border-t-[#4e9d73]',
      iconBg: 'bg-[#4e9d73]/10 text-[#4e9d73]'
    },
    gold: {
      border: 'border-t-[#d4a373]',
      iconBg: 'bg-[#d4a373]/10 text-[#d4a373]'
    }
  };

  const currentTheme = themeClasses[theme] || themeClasses.blue;

  // Base classes + CSS Animation classes
  const flashCardClass = flashKey > 0 ? (trend === 'up' ? 'animate-flash-card-up' : 'animate-flash-card-down') : '';
  const flashIconClass = flashKey > 0 ? (trend === 'up' ? 'animate-flash-icon-up' : 'animate-flash-icon-down') : '';
  const flashTextClass = flashKey > 0 ? (trend === 'up' ? 'animate-flash-text-up' : 'animate-flash-text-down') : '';

  // Calculate exact duration to perfectly synchronize flash fade-out with count-up completion
  // Initial load (flashKey <= 1): useCountUp has 0.6s start delay + 1.2s duration = 1.8s total
  // Subsequent (flashKey > 1): useCountUp starts immediately and takes 1.2s total
  const flashDuration = flashKey <= 1 ? 1.8 : 1.2;

  return (
    <div
      key={`card-${flashKey}`}
      className={`rounded-2xl bg-white p-5 shadow-sm border border-gray-100 flex flex-col justify-between border-t-[3px] ${currentTheme.border} ${flashCardClass}`}
      style={flashKey > 0 ? { animationDuration: `${flashDuration}s` } : {}}
    >
      <div className="flex items-center gap-4 mb-4">
        <div 
          className={`w-14 h-14 rounded-full flex items-center justify-center ${currentTheme.iconBg} ${flashIconClass}`}
          style={flashKey > 0 ? { animationDuration: `${flashDuration}s` } : {}}
        >
          <Icon size={24} strokeWidth={2} />
        </div>
        <div>
          <h3 
            className={`text-2xl font-bold text-gray-900 ${flashTextClass}`}
            style={flashKey > 0 ? { animationDuration: `${flashDuration}s` } : {}}
          >
            {animatedValue}
          </h3>
          <p className="text-sm font-semibold text-gray-500">{label}</p>
        </div>
      </div>
      
      {deltaPercent !== null ? (
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          {deltaPercent > 0 ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 4L4 12L5.41 13.41L11 7.83V20H13V7.83L18.59 13.41L20 12L12 4Z" fill="#10B981" />
              </svg>
              <span className="text-emerald-500">↑ {animatedDelta}%</span>
            </>
          ) : deltaPercent < 0 ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 12L18.59 10.59L13 16.17V4H11V16.17L5.41 10.59L4 12L12 20L20 12Z" fill="#EF4444" />
              </svg>
              <span className="text-red-500">↓ {animatedDelta}%</span>
            </>
          ) : (
            <span className="text-gray-400">0%</span>
          )}
        </div>
      ) : (
        <div className="h-4"></div>
      )}
    </div>
  );
}
