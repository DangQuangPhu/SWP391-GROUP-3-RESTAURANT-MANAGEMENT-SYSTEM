import { useState, useCallback } from 'react';

const CLOSE_TIME_HOURS = 22;
const CLOSE_TIME_MINS = 0;

export const useReservationTime = (selectedDate, durationMins = 90) => {
  const [startTime, setStartTime] = useState('18:00'); // Default start

  const calculateEndTimeObj = useCallback((startStr) => {
    if (!startStr || !selectedDate) return null;

    // Use a fixed base date to handle time math cleanly without timezone drift
    const baseDateStr = `2000-01-01T${startStr}:00`; 
    const startDateTime = new Date(baseDateStr);
    
    let endDateTime = new Date(startDateTime.getTime() + durationMins * 60000);

    // ECC-VAL: Hard cap at closing time (22:00)
    const endH = endDateTime.getHours();
    const endM = endDateTime.getMinutes();
    
    if (endH > CLOSE_TIME_HOURS || (endH === CLOSE_TIME_HOURS && endM > CLOSE_TIME_MINS)) {
      endDateTime.setHours(CLOSE_TIME_HOURS, CLOSE_TIME_MINS, 0, 0);
    }

    return endDateTime;
  }, [selectedDate, durationMins]);

  // Derived state for the Read-Only UI Display
  const getFormattedEndTime = () => {
    const endObj = calculateEndTimeObj(startTime);
    if (!endObj) return "--:--";
    return `${String(endObj.getHours()).padStart(2, '0')}:${String(endObj.getMinutes()).padStart(2, '0')}`;
  };

  // ECC-VAL Payload Builder: Ensures output matches System_Restaurant.sql DATETIME2(0) requirements
  const getPayload = () => {
    if (!startTime || !selectedDate) return null;
    
    const endObj = calculateEndTimeObj(startTime);
    const endStr = `${String(endObj.getHours()).padStart(2, '0')}:${String(endObj.getMinutes()).padStart(2, '0')}`;

    return {
      reservation_start_at: `${selectedDate}T${startTime}:00`,
      reservation_end_at: `${selectedDate}T${endStr}:00`,
    };
  };

  return { 
    startTime, 
    setStartTime, 
    formattedEndTime: getFormattedEndTime(),
    getPayload 
  };
};
