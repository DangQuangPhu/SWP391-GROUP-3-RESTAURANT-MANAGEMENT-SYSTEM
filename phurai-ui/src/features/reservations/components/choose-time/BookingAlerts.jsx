import React from 'react';

export default function BookingAlerts({ duration }) {
  // Case 3: Invalid & Blocked (> 60 mins, negative, or invalid intervals)
  if (duration !== null && (duration > 60 || duration <= 0)) {
    return (
      <div className="mt-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 flex items-start shadow-sm">
        <p className="text-sm font-medium">
          The maximum table hold duration per reservation is 60 minutes. Please re-select the end time or contact the hotline directly if you need to use it for longer.
        </p>
      </div>
    );
  }

  // Case 2: Valid with Surcharge (45 or 60 mins)
  if (duration === 45 || duration === 60) {
    return (
      <div className="mt-4 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 flex items-start shadow-sm">
        <p className="text-sm font-medium">
          Note: For table hold durations of 45 to 60 minutes, the system will apply an additional service charge and VAT as per restaurant regulations. The total estimated cost will be updated at the payment step.
        </p>
      </div>
    );
  }

  // Case 1: Valid & Free (15 or 30 mins)
  return null;
}
