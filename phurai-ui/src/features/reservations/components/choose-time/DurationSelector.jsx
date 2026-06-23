import React from 'react';

const DURATIONS = [
  { label: '15 Mins', value: 15 },
  { label: '30 Mins', value: 30 },
  { label: '45 Mins', value: 45 },
  { label: '60 Mins', value: 60 }
];

export default function DurationSelector({ startTime, selectedDuration, onSelectDuration }) {
  // Convert startTime (e.g. "23:30") to minutes to check 00:00 boundary (1440 mins)
  const getIsDisabled = (durationValue) => {
    if (!startTime) return false;
    const [hh, mm] = startTime.split(':').map(Number);
    const startMins = hh * 60 + mm;
    const endMins = startMins + 90 + durationValue; // Fixed 90m dining + selected hold duration
    return endMins > 1440; // Exceeds 00:00
  };

  return (
    <div className="flex flex-wrap gap-3 mt-2">
      {DURATIONS.map((duration) => {
        const isDisabled = getIsDisabled(duration.value);
        const isSelected = selectedDuration === duration.value;

        return (
          <button
            key={duration.value}
            type="button"
            disabled={isDisabled}
            onClick={() => !isDisabled && onSelectDuration(duration.value)}
            className={`px-4 py-2 rounded-full font-medium transition-colors duration-200 border ${
              isDisabled
                ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-400 border-gray-200 pointer-events-none'
                : isSelected
                ? 'bg-amber-600 text-white border-amber-600 shadow-md'
                : 'bg-white text-gray-700 border-gray-300 hover:border-amber-600 hover:text-amber-600'
            }`}
          >
            {duration.label}
          </button>
        );
      })}
    </div>
  );
}
