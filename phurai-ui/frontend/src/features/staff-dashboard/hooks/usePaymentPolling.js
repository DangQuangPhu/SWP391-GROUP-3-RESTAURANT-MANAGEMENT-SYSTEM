import { useState, useEffect, useCallback, useRef } from 'react';
import { checkPaymentStatus } from '../services/paymentApi';

export const usePaymentPolling = (orderId, onSuccess) => {
  const [phase, setPhase] = useState('pending'); // 'pending' | 'success' | 'expired'
  const [secondsLeft, setSecondsLeft] = useState(15 * 60); // 15 minutes
  const phaseRef = useRef(phase);

  // Sync phase to ref for interval access
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Timer logic
  useEffect(() => {
    if (phase !== 'pending') return;
    
    if (secondsLeft <= 0) {
      setPhase('expired');
      return;
    }
    
    const timerId = setInterval(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);
    
    return () => clearInterval(timerId);
  }, [phase, secondsLeft]);

  // Polling logic
  useEffect(() => {
    if (phase !== 'pending' || !orderId) return;

    const pollId = setInterval(async () => {
      // Avoid firing if phase changed in between intervals
      if (phaseRef.current !== 'pending') return;

      try {
        const response = await checkPaymentStatus(orderId);
        // Assuming the response is { success: true, data: { status: 'Paid' } }
        // Adjust condition as necessary if the backend wraps the response
        const status = response?.data?.status || response?.status;
        
        if (status === 'Paid' || status === 'Complete Paid') {
          setPhase('success');
          if (onSuccess) onSuccess();
        }
      } catch (err) {
        console.error('Payment polling failed:', err);
      }
    }, 3000);

    return () => clearInterval(pollId);
  }, [phase, orderId, onSuccess]);

  const resetPayment = useCallback(() => {
    setSecondsLeft(15 * 60);
    setPhase('pending');
  }, []);

  return { phase, secondsLeft, resetPayment };
};
