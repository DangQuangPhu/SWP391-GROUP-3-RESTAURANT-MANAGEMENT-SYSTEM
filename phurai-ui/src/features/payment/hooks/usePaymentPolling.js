import { useState, useEffect } from 'react';
import { apiGet } from '@/core/api/httpClient';

export default function usePaymentPolling(orderId) {
  const [status, setStatus] = useState('Pending');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!orderId) {
      setIsLoading(false);
      return;
    }

    let intervalId;

    const checkStatus = async () => {
      try {
        const response = await apiGet(`/payments/orders/${orderId}/status`);
        if (response.success && response.data) {
          setStatus(response.data.status);
          if (response.data.status === 'Paid') {
            clearInterval(intervalId);
          }
        }
      } catch (error) {
        console.error('Error polling payment status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkStatus(); // Initial check
    intervalId = setInterval(checkStatus, 3000); // Poll every 3 seconds

    return () => clearInterval(intervalId);
  }, [orderId]);

  return { status, isLoading };
}
