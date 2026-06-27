import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useCountUp } from '@/hooks/useCountUp';

export default function StatCard({ label, value, icon: Icon, deltaPercent, formatValue }) {
  const prevValue = useRef(value);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (prevValue.current !== undefined && prevValue.current !== value) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 400);
      return () => clearTimeout(timer);
    }
    prevValue.current = value;
  }, [value]);

  const animatedValue = useCountUp(value, 0.9, formatValue);

  return (
    <div
      className={`rounded-2xl bg-white p-5 shadow-sm border border-gray-100 flex flex-col justify-between ${flash ? 'opacity-80' : ''}`}
      style={{ transition: 'background-color 0.4s ease' }}
    >
      <div className="flex items-center gap-4 mb-4">
        <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center text-[#8c764b]">
          <Icon size={24} strokeWidth={2} />
        </div>
        <div>
          <h3 className="text-2xl font-bold text-gray-900">{animatedValue}</h3>
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
