import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { scanStaticQrCode } from "@/features/table-session/services/qrSessionApi.js";
import { useTableSession } from "@/features/table-session/context/TableSessionContext.jsx";
import { useSocket } from "@/core/socket/SocketContext.jsx";
import toast from "react-hot-toast";
// Force Vite HMR Cache Bust: 2026-06-22
export default function QrScanPage() {
  const { qr_code } = useParams();
  const navigate = useNavigate();
  const { setSession } = useTableSession();
  const { socket } = useSocket();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pendingSession, setPendingSession] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function processScan() {
      try {
        const res = await scanStaticQrCode(qr_code);
        if (res?.success) {
          if (res.session?.session_status === "Pending") {
            if (mounted) setPendingSession(res.session);
            setSession(res.session, false);
          } else {
            setSession(res.session, true);
            toast.success("Joined table successfully!");
            navigate("/menus", { replace: true });
          }
        }
      } catch (err) {
        if (mounted) setError(err.response?.data?.message || err.message || "Failed to scan QR code.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    processScan();
    return () => { mounted = false; };
  }, [qr_code, navigate, setSession]);

  useEffect(() => {
    if (!socket || !pendingSession) return;

    const matchesPendingSession = (data = {}) =>
      String(data.session_id || data.qr_session_id) === String(pendingSession.session_id);

    const handleApproval = (data) => {
      if (matchesPendingSession(data)) {
        toast.success("Table approved! You can now order.");
        setSession({ ...pendingSession, session_status: "Active" }, true);
        navigate("/menus", { replace: true });
      }
    };

    const handleRejection = (data) => {
      if (matchesPendingSession(data)) {
        toast.error("Table request rejected by staff.");
        setSession(null, false);
        navigate("/", { replace: true });
      }
    };

    socket.on("SESSION_APPROVED", handleApproval);
    socket.on("QR_SESSION_APPROVED", handleApproval);
    socket.on("SESSION_REJECTED", handleRejection);
    socket.on("QR_SESSION_REJECTED", handleRejection);
    return () => {
        socket.off("SESSION_APPROVED", handleApproval);
        socket.off("QR_SESSION_APPROVED", handleApproval);
        socket.off("SESSION_REJECTED", handleRejection);
        socket.off("QR_SESSION_REJECTED", handleRejection);
    };
  }, [socket, pendingSession, navigate, setSession]);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "20px" }}>
        <h2>Processing QR Code...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "20px", textAlign: "center" }}>
        <h2 style={{ color: "var(--sfx-danger, red)" }}>Scan Failed</h2>
        <p>{error}</p>
        <button onClick={() => navigate("/")} style={{ marginTop: "20px", padding: "10px 20px", cursor: "pointer", background: "var(--sfx-gold, #d4af37)", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "600" }}>Return to Home</button>
      </div>
    );
  }

  if (pendingSession) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "20px", textAlign: "center", background: "#fafafa" }}>
        <div style={{ background: "#fff", padding: "40px", borderRadius: "16px", boxShadow: "0 8px 24px rgba(0,0,0,0.05)", maxWidth: "400px" }}>
          <h2 style={{ margin: "0 0 16px 0", fontSize: "24px", color: "var(--sfx-gold, #d4af37)" }}>Pending Approval</h2>
          <p style={{ margin: "0 0 24px 0", fontSize: "16px", color: "#555" }}>
            Please wait for staff approval...
          </p>
          <div className="sfx-spinner" style={{ margin: "0 auto 24px auto", width: "40px", height: "40px", border: "4px solid #eee", borderTop: "4px solid var(--sfx-gold)", borderRadius: "50%", animation: "sfx-spin 1s linear infinite" }}></div>
          <p style={{ margin: 0, fontSize: "14px", color: "#888" }}>
            This page will automatically refresh once the staff approves your table.
          </p>
        </div>
        <style>{`
          @keyframes sfx-spin {
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return null;
}
