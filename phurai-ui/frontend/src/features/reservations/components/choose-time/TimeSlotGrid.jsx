import React, { useMemo } from 'react';

export default function TimeSlotGrid({ selectedDate, selectedTime, onSelectTime }) {
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let h = 10; h <= 23; h++) {
      for (let m = 0; m <= 30; m += 30) {
        if (h === 23 && m > 30) continue; // Stops at 23:30
        const hh = String(h).padStart(2, '0');
        const mm = String(m).padStart(2, '0');
        slots.push(`${hh}:${mm}`);
      }
    }
    return slots;
  }, []);

  const todayStr = useMemo(() => {
    const today = new Date();
    // Use local time for YYYY-MM-DD
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const isToday = selectedDate === todayStr;
  
  const currentHH = new Date().getHours();
  const currentMM = new Date().getMinutes();

  return (
    <div className="flex flex-wrap gap-3 mt-2">
      {timeSlots.map((time) => {
        let isDisabled = false;
        
        if (isToday) {
          const [hh, mm] = time.split(':').map(Number);
          if (hh < currentHH || (hh === currentHH && mm <= currentMM)) {
            isDisabled = true;
          }
        }

        const isSelected = selectedTime === time;

        return (
          <button
            key={time}
            type="button"
            disabled={isDisabled}
            onClick={() => !isDisabled && onSelectTime(time)}
            className={`px-4 py-2 rounded-full font-medium transition-colors duration-200 border ${
              isDisabled
                ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-400 border-gray-200'
                : isSelected
                ? 'bg-amber-600 text-white border-amber-600 shadow-md'
                : 'bg-white text-gray-700 border-gray-300 hover:border-amber-600 hover:text-amber-600'
            }`}
          >
            {time}
          </button>
        );
      })}
    </div>
  );
}
