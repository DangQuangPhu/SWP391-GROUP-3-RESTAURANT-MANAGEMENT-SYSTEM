import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Play, CheckCircle2, AlertCircle } from "lucide-react";
import { apiGet, apiPatch } from "@/core/api";
import { useSocket } from "@/core/socket/SocketContext.jsx";
import { toast } from "react-hot-toast";

export function KitchenDashboardPage({ currentUser }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();

  const fetchQueue = useCallback(async () => {
    try {
      const res = await apiGet("/kitchen/queue");
      if (res.success) {
        setTickets(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch kitchen queue:", err);
      toast.error("Failed to load kitchen queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    // Refresh every minute to update wait times
    const interval = setInterval(fetchQueue, 60000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  useEffect(() => {
    if (!socket) return;

    // Join kitchen room if not already joined by RealtimeShell
    socket.emit("join:room", "room:kitchen");

    const handleNewTicket = (data) => {
      toast("New order received!", { icon: "🔔", style: { background: '#1f2937', color: '#fff' } });
      fetchQueue();
    };

    const handleTicketUpdate = () => {
      fetchQueue();
    };

    socket.on("kds:new_ticket", handleNewTicket);
    socket.on("kds:ticket_updated", handleTicketUpdate);

    return () => {
      socket.off("kds:new_ticket", handleNewTicket);
      socket.off("kds:ticket_updated", handleTicketUpdate);
    };
  }, [socket, fetchQueue]);

  const handleUpdateStatus = async (ticketId, currentStatus, newStatus) => {
    try {
      // Optimistic update
      setTickets(prev => prev.map(t =>
        t.kitchen_ticket_id === ticketId
          ? { ...t, kitchen_status: newStatus }
          : t
      ));

      await apiPatch(`/kitchen/tickets/${ticketId}/status`, {
        new_status: newStatus,
        triggered_by: "staff"
      });
      fetchQueue();
    } catch (err) {
      console.error("Failed to update status:", err);
      toast.error("Could not update ticket status");
      fetchQueue(); // Revert optimistic update
    }
  };

  const renderColumn = (title, statusFilter, emptyMessage) => {
    const columnTickets = tickets.filter(t => t.kitchen_status === statusFilter);

    return (
      <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex-shrink-0 p-4 bg-white border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            {title}
            <span className="bg-amber-100 text-amber-700 text-xs py-0.5 px-2 rounded-full font-bold">
              {columnTickets.length}
            </span>
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
          {columnTickets.length === 0 ? (
            <div className="h-32 flex flex-col items-center justify-center text-gray-500">
              <p className="text-sm">{emptyMessage}</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {columnTickets.map(ticket => (
                <TicketCard
                  key={ticket.kitchen_ticket_id}
                  ticket={ticket}
                  onUpdateStatus={handleUpdateStatus}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div></div>;
  }

  return (
    <div className="h-full p-4 grid grid-cols-1 md:grid-cols-3 gap-6">
      {renderColumn("Pending", "Pending", "No pending orders")}
      {renderColumn("Preparing", "Preparing", "No items preparing")}
      {renderColumn("Ready", "Ready", "No items ready")}
    </div>
  );
}

function TicketCard({ ticket, onUpdateStatus }) {
  const isPending = ticket.kitchen_status === "Pending";
  const isPreparing = ticket.kitchen_status === "Preparing";

  const waitClass = ticket.wait_minutes > 15 ? "text-red-600 bg-red-50 border border-red-100"
    : ticket.wait_minutes > 10 ? "text-amber-600 bg-amber-50 border border-amber-100"
      : "text-gray-500 bg-gray-50 border border-gray-200";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ duration: 0.3 }}
      className={`p-4 rounded-xl shadow-sm flex flex-col gap-3 bg-white border transition-all duration-300 hover:-translate-y-1 hover:shadow-md ${isPending ? "border-l-4 border-l-orange-500 border-y-gray-200 border-r-gray-200" :
        isPreparing ? "border-l-4 border-l-amber-400 border-y-gray-200 border-r-gray-200" :
          "border-l-4 border-l-emerald-500 border-y-gray-200 border-r-gray-200 opacity-90"
      }`}
    >
      <div className="flex justify-between items-start gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-lg font-bold text-gray-800 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-md">
              {ticket.table_number}
            </span>
            <span className="text-sm font-medium text-gray-500">Order #{ticket.order_id}</span>
          </div>
          <h3 className="text-lg font-bold text-gray-900 leading-tight">
            <span className="text-amber-600 mr-2">{ticket.quantity}x</span>
            {ticket.dish_name}
          </h3>
        </div>

        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${waitClass}`}>
          <Clock className="w-3.5 h-3.5" />
          {ticket.wait_minutes}m
        </div>
      </div>

      {ticket.special_notes && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-3 py-2 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" />
          <span className="font-medium">{ticket.special_notes}</span>
        </div>
      )}

      <div className="mt-1 pt-3 border-t border-gray-100 flex items-center justify-between">
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wider truncate">
          {ticket.guest_label}
        </div>

        <div className="flex gap-2">
          {isPending && (
            <button
              onClick={() => onUpdateStatus(ticket.kitchen_ticket_id, "Pending", "Preparing")}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 hover:shadow-lg hover:scale-[1.03] active:scale-95 transition-all duration-200 text-white text-sm font-bold rounded-lg shadow-sm"
            >
              <Play className="w-4 h-4 fill-current" />
              Start
            </button>
          )}
          {isPreparing && (
            <button
              onClick={() => onUpdateStatus(ticket.kitchen_ticket_id, "Preparing", "Ready")}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 hover:shadow-lg hover:scale-[1.03] active:scale-95 transition-all duration-200 text-white text-sm font-bold rounded-lg shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              Complete
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
