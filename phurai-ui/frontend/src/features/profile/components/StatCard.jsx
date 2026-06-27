import React, { useEffect, useState } from 'react';
import { useCountUp } from '@/hooks/useCountUp';

// Module-level cache to persist previous values across component unmounts/remounts
const prevValuesCache = {};

export default function StatCard({ label, value, icon: Icon, deltaPercent, formatValue, theme }) {
  const [flash, setFlash] = useState(false);
  const [trendDirection, setTrendDirection] = useState('none'); // 'up' | 'down' | 'none'

  const endValue = Number(value) || 0;

  // Initialize the cache for this card to 0 on first render so it flashes on initial mount
  if (prevValuesCache[label] === undefined) {
    prevValuesCache[label] = 0;
  }

  useEffect(() => {
    const cachedValue = prevValuesCache[label];
    if (cachedValue !== endValue) {
      setTrendDirection(endValue > cachedValue ? 'up' : 'down');
      setFlash(true);
      const timer = setTimeout(() => {
        setFlash(false);
        setTrendDirection('none');
      }, 1200);
      prevValuesCache[label] = endValue;
      return () => clearTimeout(timer);
    }
  }, [value, label, endValue]);

  const animatedValue = useCountUp(value, 1.2, formatValue);

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

  return (
    <div
      className={`rounded-2xl bg-white p-5 shadow-sm border border-gray-100 flex flex-col justify-between border-t-[3px] ${currentTheme.border} transition-all duration-300 ${
        flash 
          ? (trendDirection === 'up' 
              ? 'shadow-[0_4px_25px_rgba(16,185,129,0.2)] bg-emerald-50 border-emerald-300' 
              : 'shadow-[0_4px_25px_rgba(239,68,68,0.2)] bg-rose-50 border-rose-300') 
          : ''
      }`}
    >
      <div className="flex items-center gap-4 mb-4">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
          flash 
            ? (trendDirection === 'up' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500') 
            : currentTheme.iconBg
        }`}>
          <Icon size={24} strokeWidth={2} />
        </div>
        <div>
          <h3 className={`text-2xl font-bold transition-all duration-500 ${
            flash 
              ? (trendDirection === 'up' ? 'text-emerald-600 scale-105 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'text-rose-600 scale-95 drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]') 
              : 'text-gray-900'
          }`}>
            {animatedValue}
          </h3>
          <p className="text-sm font-semibold text-gray-500">{label}</p>
        </div>
      </div>
      
      {deltaPercent !== null ? (
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          {deltaPercent >= 0 ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 4L4 12L5.41 13.41L11 7.83V20H13V7.83L18.59 13.41L20 12L12 4Z" fill="#10B981" />
              </svg>
              <span className="text-emerald-500">{Math.abs(deltaPercent).toFixed(1)}% (30 days)</span>
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 12L18.59 10.59L13 16.17V4H11V16.17L5.41 10.59L4 12L12 20L20 12Z" fill="#EF4444" />
              </svg>
              <span className="text-red-500">{Math.abs(deltaPercent).toFixed(1)}% (30 days)</span>
            </>
          )}
        </div>
      ) : (
        <div className="h-5"></div>
      )}
    </div>
  );
}
