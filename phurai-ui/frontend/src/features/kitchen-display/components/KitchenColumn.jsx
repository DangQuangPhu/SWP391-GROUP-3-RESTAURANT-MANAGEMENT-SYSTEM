import React from 'react';
import KitchenTicketCard from './KitchenTicketCard';

export default function KitchenColumn({ title, count, color, tickets, onStatusUpdated }) {
  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className={`px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-white dark:bg-gray-800`}>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${color}`} />
          <h2 className="font-bold text-gray-800 dark:text-white uppercase tracking-wider">{title}</h2>
        </div>
        <span className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-full text-xs font-bold">
          {count}
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tickets.map(ticket => (
          <KitchenTicketCard 
            key={ticket.kitchen_ticket_id} 
            ticket={ticket} 
            onStatusUpdated={onStatusUpdated}
          />
        ))}
        {tickets.length === 0 && (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm italic">
            Trống
          </div>
        )}
      </div>
    </div>
  );
}
