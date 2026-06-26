import { useState, useEffect } from 'react';

export function useGracePeriod(startTimeIso, gracePeriodMinutes = 15) {
  const [isLate, setIsLate] = useState(false);

  useEffect(() => {
    if (!startTimeIso) {
      setIsLate(false);
      return;
    }

    const checkLateness = () => {
      try {
        const now = new Date();
        const start = new Date(startTimeIso);
        if (isNaN(start.getTime())) return;

        const diffMs = now.getTime() - start.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        setIsLate(diffMins >= gracePeriodMinutes);
      } catch (err) {
        console.error("Grace period calculation error:", err);
      }
    };

    checkLateness();
    const intervalId = setInterval(checkLateness, 60000);

    return () => {
      clearInterval(intervalId);
    };
  }, [startTimeIso, gracePeriodMinutes]);

  return isLate;
}
