/**
 * KitchenDashboardPage
 *
 * Phase 1 — PIN Gate: If no valid kds_token in sessionStorage, show PIN entry
 *            screen. On success, store token + show the queue board.
 * Phase 2 — Queue Board: Polls /api/kds/queue, listens to socket events.
 *            Sends expected_updated_at for optimistic-locking CAS.
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Play, CheckCircle2, AlertCircle, ChefHat, Keyboard, Loader2, Wifi } from "lucide-react";
import { useSocket } from "@/core/socket/SocketContext.jsx";
import { toast } from "react-hot-toast";

const KDS_TOKEN_KEY = "kds_device_token";
const API_BASE = "/api";

// ─────────────────────────────────────────────────────────────
// KDS API helpers — use device JWT, NOT user JWT
// ─────────────────────────────────────────────────────────────
async function kdsApi(path, options = {}) {
  const token = sessionStorage.getItem(KDS_TOKEN_KEY);
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
    body: options.body != null ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.message ?? "Request failed"), { status: res.status, data });
  return data;
}

// ─────────────────────────────────────────────────────────────
// PIN Gate Component
// ─────────────────────────────────────────────────────────────
function PinGate({ onAuthenticated }) {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [error, setError] = useState("");

  // Load device list (public endpoint — no auth needed)
  useEffect(() => {
    fetch(`${API_BASE}/kds/devices-public`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data?.length > 0) {
          setDevices(data.data);
          if (data.data.length === 1) setSelectedDevice(data.data[0]);
        }
      })
      .catch(() => {
        // Fallback: show manual device_id entry
        setDevices([]);
      })
      .finally(() => setLoadingDevices(false));
  }, []);

  const handlePinDigit = (digit) => {
    if (pin.length < 8) setPin(p => p + digit);
  };
  const handleBackspace = () => setPin(p => p.slice(0, -1));
  const handleClear = () => setPin("");

  const handleActivate = async () => {
    if (!pin || pin.length < 4) {
      setError("Please enter your PIN (4–8 digits).");
      return;
    }
    const deviceId = selectedDevice?.device_id;
    if (!deviceId) {
      setError("Please select a device.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/kds/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: deviceId, pin }),
      });
      const data = await res.json();
      if (res.status === 429) {
        setError(`Too many attempts. ${data.unlock_at ? `Try again at ${new Date(data.unlock_at).toLocaleTimeString()}` : "Try again later."}`);
        return;
      }
      if (!res.ok) {
        setError(data.message ?? "Incorrect PIN. Try again.");
        setPin("");
        return;
      }
      sessionStorage.setItem(KDS_TOKEN_KEY, data.token);
      onAuthenticated(data.device_name);
    } catch {
      setError("Network error. Check connection.");
    } finally {
      setLoading(false);
    }
  };

  const numPad = ["1","2","3","4","5","6","7","8","9","","0","⌫"];

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-sm shadow-2xl"
      >
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-orange-500/20 rounded-2xl flex items-center justify-center mb-4 border border-orange-500/30">
            <ChefHat className="w-8 h-8 text-orange-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Kitchen Display</h1>
          <p className="text-gray-400 text-sm mt-1">Enter your station PIN to continue</p>
        </div>

        {/* Device selector */}
        {loadingDevices ? (
          <div className="flex justify-center mb-6">
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          </div>
        ) : devices.length > 1 ? (
          <div className="mb-6">
            <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">Station</label>
            <select
              value={selectedDevice?.device_id ?? ""}
              onChange={e => setSelectedDevice(devices.find(d => String(d.device_id) === e.target.value) ?? null)}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500"
            >
              <option value="">Select station...</option>
              {devices.map(d => (
                <option key={d.device_id} value={d.device_id}>{d.device_name}</option>
              ))}
            </select>
          </div>
        ) : selectedDevice ? (
          <div className="mb-6 px-4 py-3 bg-gray-800 rounded-xl flex items-center gap-3 border border-gray-700">
            <Wifi className="w-4 h-4 text-green-400 flex-shrink-0" />
            <span className="text-sm text-gray-200">{selectedDevice.device_name}</span>
          </div>
        ) : null}

        {/* PIN display */}
        <div className="flex gap-3 justify-center mb-6">
          {Array.from({ length: Math.max(pin.length, 4) }).map((_, i) => (
            <div
              key={i}
              className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center text-xl font-bold transition-all
                ${i < pin.length
                  ? "border-orange-500 bg-orange-500/20 text-orange-300"
                  : "border-gray-700 bg-gray-800"
                }`}
            >
              {i < pin.length ? "●" : ""}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-red-400 text-sm text-center mb-4"
          >
            {error}
          </motion.p>
        )}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {numPad.map((d, i) => {
            if (d === "") return <div key={i} />;
            const isBack = d === "⌫";
            return (
              <button
                key={i}
                onClick={() => isBack ? handleBackspace() : handlePinDigit(d)}
                className={`py-4 rounded-xl text-lg font-semibold transition-all active:scale-95
                  ${isBack
                    ? "bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
                    : "bg-gray-800 hover:bg-gray-700 text-white border border-gray-700 hover:border-orange-500/50"
                  }`}
              >
                {d}
              </button>
            );
          })}
        </div>

        {/* Confirm button */}
        <button
          onClick={handleActivate}
          disabled={loading || pin.length < 4 || !selectedDevice}
          className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Keyboard className="w-5 h-5" />}
          {loading ? "Activating..." : "Activate Station"}
        </button>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main KitchenDashboardPage
// ─────────────────────────────────────────────────────────────
export function KitchenDashboardPage({ currentUser }) {
  const [authenticated, setAuthenticated] = useState(() => !!sessionStorage.getItem(KDS_TOKEN_KEY));
  const [deviceName, setDeviceName] = useState("");
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();

  const handleAuthenticated = (name) => {
    setDeviceName(name);
    setAuthenticated(true);
  };

  const fetchQueue = useCallback(async () => {
    try {
      const res = await kdsApi("/kds/queue");
      if (res.success) setTickets(res.data);
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        // Token expired or device disabled — force re-authentication
        sessionStorage.removeItem(KDS_TOKEN_KEY);
        setAuthenticated(false);
        toast.error("Station session expired. Please re-enter PIN.");
      } else {
        console.error("[KDS] Failed to fetch queue:", err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    fetchQueue();
    const interval = setInterval(fetchQueue, 60000);
    return () => clearInterval(interval);
  }, [authenticated, fetchQueue]);

  useEffect(() => {
    if (!socket || !authenticated) return;
    socket.emit("join:room", "room:kitchen");
    const handleNew = () => {
      toast("New order received!", { icon: "🔔", style: { background: "#1f2937", color: "#fff" } });
      fetchQueue();
    };
    socket.on("kds:new_ticket", handleNew);
    socket.on("kds:ticket_updated", fetchQueue);
    return () => {
      socket.off("kds:new_ticket", handleNew);
      socket.off("kds:ticket_updated", fetchQueue);
    };
  }, [socket, authenticated, fetchQueue]);

  const handleUpdateStatus = async (ticket, newStatus) => {
    const ticketId = ticket.kitchen_ticket_id;

    // Optimistic update
    setTickets(prev => prev.map(t =>
      t.kitchen_ticket_id === ticketId ? { ...t, kitchen_status: newStatus } : t
    ));

    try {
      await kdsApi(`/kds/tickets/${ticketId}/status`, {
        method: "PATCH",
        body: {
          new_status: newStatus,
          triggered_by: "kds_device",
          expected_updated_at: ticket.updated_at, // CAS
        },
      });
      fetchQueue();
    } catch (err) {
      if (err.data?.code === "STALE_STATE") {
        toast("Ticket already updated — refreshing...", { icon: "⚡", style: { background: "#1f2937", color: "#fff" } });
      } else if (err.status === 401 || err.status === 403) {
        sessionStorage.removeItem(KDS_TOKEN_KEY);
        setAuthenticated(false);
        toast.error("Session expired. Please re-enter PIN.");
        return;
      } else {
        toast.error("Could not update ticket status.");
      }
      fetchQueue();
    }
  };

  if (!authenticated) {
    return <PinGate onAuthenticated={handleAuthenticated} />;
  }

  const renderColumn = (title, statusFilter, emptyMessage, accentColor) => {
    const columnTickets = tickets.filter(t => t.kitchen_status === statusFilter);
    return (
      <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex-shrink-0 p-4 bg-white border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            {title}
            <span className={`text-xs py-0.5 px-2 rounded-full font-bold ${accentColor}`}>
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
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Station bar */}
      <div className="flex-shrink-0 px-4 py-2 bg-gray-900 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-gray-300">
          <ChefHat className="w-4 h-4 text-orange-400" />
          <span className="font-medium">{deviceName || "Kitchen Display"}</span>
        </div>
        <button
          onClick={() => { sessionStorage.removeItem(KDS_TOKEN_KEY); setAuthenticated(false); }}
          className="text-xs text-gray-500 hover:text-red-400 transition-colors"
        >
          Lock station
        </button>
      </div>

      <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-3 gap-6 min-h-0">
        {renderColumn("Pending", "Pending", "No pending orders", "bg-orange-100 text-orange-700")}
        {renderColumn("Preparing", "Preparing", "No items preparing", "bg-amber-100 text-amber-700")}
        {renderColumn("Ready", "Ready", "No items ready", "bg-emerald-100 text-emerald-700")}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Ticket Card
// ─────────────────────────────────────────────────────────────
function TicketCard({ ticket, onUpdateStatus }) {
  const isPending = ticket.kitchen_status === "Pending";
  const isPreparing = ticket.kitchen_status === "Preparing";

  const waitClass = ticket.wait_minutes > 15
    ? "text-red-600 bg-red-50 border border-red-100"
    : ticket.wait_minutes > 10
      ? "text-amber-600 bg-amber-50 border border-amber-100"
      : "text-gray-500 bg-gray-50 border border-gray-200";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ duration: 0.3 }}
      className={`p-4 rounded-xl shadow-sm flex flex-col gap-3 bg-white border transition-all duration-300 hover:-translate-y-1 hover:shadow-md ${
        isPending   ? "border-l-4 border-l-orange-500 border-y-gray-200 border-r-gray-200" :
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
            {ticket.category_name && (
              <span className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full">
                {ticket.category_name}
              </span>
            )}
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
              onClick={() => onUpdateStatus(ticket, "Preparing")}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 hover:shadow-lg hover:scale-[1.03] active:scale-95 transition-all duration-200 text-white text-sm font-bold rounded-lg shadow-sm"
            >
              <Play className="w-4 h-4 fill-current" />
              Start
            </button>
          )}
          {isPreparing && (
            <button
              onClick={() => onUpdateStatus(ticket, "Ready")}
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
