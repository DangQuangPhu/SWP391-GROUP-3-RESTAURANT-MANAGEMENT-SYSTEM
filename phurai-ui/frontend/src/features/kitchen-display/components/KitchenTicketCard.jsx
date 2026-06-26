import React, { useState } from 'react';
import { Clock, Utensils, AlertCircle } from 'lucide-react';
import { apiPatch } from '@/core/api/httpClient';

export default function KitchenTicketCard({ ticket, onStatusUpdated }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleUpdateStatus = async (newStatus) => {
    setIsLoading(true);
    try {
      await apiPatch(`/kitchen/tickets/${ticket.kitchen_ticket_id}/status`, {
        new_status: newStatus,
        triggered_by: 'kitchen_staff'
      });
      if (onStatusUpdated) onStatusUpdated();
    } catch (err) {
      console.error('Failed to update ticket status', err);
      alert('Không thể cập nhật trạng thái');
    } finally {
      setIsLoading(false);
    }
  };

  const isPriority = ticket.priority_level === 1;

  return (
    <div className={`p-4 rounded-xl border-2 shadow-sm bg-white dark:bg-gray-800 transition-all ${
      isPriority ? 'border-red-500/50 dark:border-red-500/50' : 'border-gray-200 dark:border-gray-700'
    }`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex gap-2 items-center">
          <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 font-bold px-2 py-1 rounded text-xs">
            Table {ticket.table_number || '?'}
          </span>
          {isPriority && (
            <span className="text-red-500 flex items-center gap-1 text-xs font-bold">
              <AlertCircle className="w-3 h-3" />
              PRIORITY
            </span>
          )}
        </div>
        <span className="flex items-center text-xs text-gray-500 dark:text-gray-400 font-medium">
          <Clock className="w-3 h-3 mr-1" />
          {ticket.wait_minutes} min
        </span>
      </div>

      <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-start gap-2 mb-2">
        <span className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-2 rounded-md font-mono">
          x{ticket.quantity}
        </span>
        {ticket.dish_name}
      </h3>

      {ticket.special_notes && (
        <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg italic mb-3">
          "{ticket.special_notes}"
        </p>
      )}

      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
        {ticket.kitchen_status === 'Pending' && (
          <button 
            onClick={() => handleUpdateStatus('Preparing')}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition-colors flex justify-center items-center gap-2"
          >
            {isLoading ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : <Utensils className="w-4 h-4" />}
            Bắt đầu nấu
          </button>
        )}

        {ticket.kitchen_status === 'Preparing' && (
          <button 
            onClick={() => handleUpdateStatus('Ready')}
            disabled={isLoading}
            className="w-full bg-green-500 hover:bg-green-600 disabled:bg-green-400 text-white font-medium py-2 px-4 rounded-lg transition-colors flex justify-center items-center gap-2"
          >
            {isLoading ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : null}
            Hoàn tất
          </button>
        )}
      </div>
    </div>
  );
}
