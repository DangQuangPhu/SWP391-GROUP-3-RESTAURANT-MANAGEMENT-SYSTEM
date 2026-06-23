import React from 'react';
import { useGracePeriod } from '../hooks/useGracePeriod';

export default function LateArrivalBadge({ reservationStartAt, status }) {
  const isLate = useGracePeriod(reservationStartAt, 15);

  const isActiveStatus = status === 'AWAIT_CHECK_IN' || status === 'Reserved' || status === 'Pending' || status === 'Confirmed' || status === 'await check-in' || status === 'confirmed' || status === 'reserved';

  if (!isActiveStatus || !isLate) return null;

  return (
    <span style={{
      color: '#ef4444',
      fontWeight: 'bold',
      fontSize: '12px',
      padding: '2px 6px',
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      borderRadius: '4px',
      marginLeft: '8px',
      border: '1px solid #ef4444'
    }}>
      Khách trễ giờ
    </span>
  );
}
