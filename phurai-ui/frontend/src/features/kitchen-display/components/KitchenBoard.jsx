import React, { useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';
import { apiGet } from '@/core/api/httpClient';
import KitchenColumn from './KitchenColumn';
import { ChefHat, RefreshCw } from 'lucide-react';
import { SOCKET_URL } from "@/core/socket/socketConfig.js";

export default function KitchenBoard() {
  const [tickets, setTickets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTickets = useCallback(async () => {
    try {
      const response = await apiGet('/kitchen/queue');
      console.log("[KITCHEN DEBUG] Raw Queue Data:", response.data);
      if (response.success) {
        setTickets(response.data);
      }
    } catch (error) {
      console.error('Error fetching kitchen queue:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();

    const socketUrl = SOCKET_URL;
    const socket = io(socketUrl, {
      withCredentials: true,
      transports: ['polling', 'websocket'],
      autoConnect: true
    });

    socket.on('connect', () => {
      socket.emit('joinRoom', 'kitchen');
    });

    // Listen to new tickets from staff
    socket.on('kitchen:new_ticket', () => {
      fetchTickets();
    });

    // Listen to global order events from customers
    const handleOrderAlert = (payload) => {
      console.log("[KITCHEN] Real-time order received. Refreshing UI...");
      fetchTickets();
    };
    socket.on('NEW_KITCHEN_ORDER', handleOrderAlert);

    return () => socket.disconnect();
  }, [fetchTickets]);

  const pendingTickets = tickets.filter(t => {
    const status = t.kitchen_status?.toUpperCase();
    return status === 'PENDING' || (status !== 'PREPARING' && status !== 'READY');
  });
  const preparingTickets = tickets.filter(t => t.kitchen_status?.toUpperCase() === 'PREPARING');
  const readyTickets = tickets.filter(t => t.kitchen_status?.toUpperCase() === 'READY');

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-black p-4">
      {/* Header */}
      <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm mb-4 shrink-0 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
            <ChefHat className="w-6 h-6 text-orange-600 dark:text-orange-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">Kitchen Display System</h1>
        </div>
        <button 
          onClick={() => { setIsLoading(true); fetchTickets(); }}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm font-medium"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 min-h-0 overflow-x-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full min-w-[900px]">
          <KitchenColumn 
            title="Chờ nấu" 
            color="bg-red-500" 
            tickets={pendingTickets} 
            onStatusUpdated={fetchTickets}
          />
          <KitchenColumn 
            title="Đang nấu" 
            color="bg-blue-500" 
            tickets={preparingTickets} 
            onStatusUpdated={fetchTickets}
          />
          <KitchenColumn 
            title="Đã xong" 
            color="bg-green-500" 
            tickets={readyTickets} 
            onStatusUpdated={fetchTickets}
          />
        </div>
      </div>
    </div>
  );
}
