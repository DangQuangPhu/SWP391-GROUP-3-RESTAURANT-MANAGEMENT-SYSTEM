/**
 * KdsDeviceManager.jsx — Admin-only KDS Device Management (Part 3.2)
 * Lists KitchenDevices, supports create/edit (rename, change PIN, station filter, toggle active/inactive).
 * PIN is entered during creation/edit but never displayed again after save.
 */
import { useEffect, useState, useCallback } from "react";
import { getKdsDevices, createKdsDevice, updateKdsDevice, deleteKdsDevice } from "@/features/manager-dashboard/services/managerApi.js";

// ── Small UI primitives (inline to avoid coupling to manager-specific ManagerUI) ─
const Card = ({ children, style }) => (
  <div style={{
    background: "var(--surface-1, #1a1a1a)", border: "1px solid var(--border, #333)",
    borderRadius: "12px", padding: "20px", ...style
  }}>{children}</div>
);

const Input = ({ label, ...props }) => (
  <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "13px", color: "var(--text-muted)" }}>
    {label}
    <input
      {...props}
      style={{
        padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border, #333)",
        background: "var(--surface-2, #252525)", color: "var(--text, #eee)",
        fontSize: "14px", outline: "none",
      }}
    />
  </label>
);

const Btn = ({ children, variant = "primary", disabled, onClick, style }) => {
  const bg = {
    primary: "var(--accent, #c8a96e)",
    danger:  "var(--error, #e05252)",
    ghost:   "transparent",
    success: "#4caf7d",
  }[variant] ?? "var(--accent)";
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: "7px 16px", borderRadius: "8px", border: variant === "ghost" ? "1px solid var(--border)" : "none",
        background: disabled ? "#444" : bg, color: "#fff", cursor: disabled ? "not-allowed" : "pointer",
        fontSize: "13px", fontWeight: "500", ...style,
      }}
    >
      {children}
    </button>
  );
};

const Modal = ({ title, children, onClose, footer }) => (
  <div style={{
    position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", zIndex: 9999,
    display: "flex", alignItems: "center", justifyContent: "center"
  }} onClick={e => e.target === e.currentTarget && onClose()}>
    <div style={{
      background: "var(--surface-1, #1e1e1e)", borderRadius: "14px", padding: "28px",
      width: "420px", maxWidth: "95vw", display: "flex", flexDirection: "column", gap: "16px",
      boxShadow: "0 24px 80px rgba(0,0,0,.7)"
    }}>
      <div style={{ fontWeight: "600", fontSize: "16px" }}>{title}</div>
      {children}
      {footer && <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "8px" }}>{footer}</div>}
    </div>
  </div>
);

const Badge = ({ active }) => (
  <span style={{
    padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "600",
    background: active ? "rgba(76,175,125,.2)" : "rgba(224,82,82,.15)",
    color: active ? "#4caf7d" : "#e05252",
  }}>
    {active ? "Active" : "Inactive"}
  </span>
);

// ═════════════════════════════════════════════════════════════════════════════
export default function KdsDeviceManager({ toast }) {
  const [devices, setDevices]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(null); // null | 'new' | device-object (edit)
  const [form, setForm]         = useState({ device_name: "", pin: "", station_category_ids: "" });
  const [saving, setSaving]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getKdsDevices();
      setDevices(res.data ?? []);
    } catch {
      toast?.({ type: "error", message: "Could not load KDS devices." });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setForm({ device_name: "", pin: "", station_category_ids: "" });
    setModal("new");
  };

  const openEdit = (device) => {
    setForm({
      device_name: device.device_name,
      pin: "",  // never pre-fill PIN
      is_active: device.is_active,
      station_category_ids: device.station_category_ids
        ? JSON.parse(device.station_category_ids).join(", ")
        : "",
    });
    setModal(device);
  };

  const parseCategories = (str) => {
    if (!str?.trim()) return undefined;
    const ids = str.split(",").map(s => parseInt(s.trim(), 10)).filter(Number.isFinite);
    return ids.length > 0 ? ids : undefined;
  };

  const handleSave = async () => {
    if (!form.device_name.trim()) {
      toast?.({ type: "error", message: "Device name is required." }); return;
    }
    setSaving(true);
    try {
      if (modal === "new") {
        if (!form.pin || !/^\d{4,8}$/.test(form.pin)) {
          toast?.({ type: "error", message: "PIN must be 4–8 digits." });
          setSaving(false); return;
        }
        await createKdsDevice({
          device_name: form.device_name.trim(),
          pin: form.pin,
          station_category_ids: parseCategories(form.station_category_ids),
        });
        toast?.({ type: "success", message: `Device "${form.device_name}" created.` });
      } else {
        const updates = { device_name: form.device_name.trim() };
        if (form.pin) {
          if (!/^\d{4,8}$/.test(form.pin)) {
            toast?.({ type: "error", message: "PIN must be 4–8 digits." });
            setSaving(false); return;
          }
          updates.pin = form.pin;
        }
        if ("is_active" in form) updates.is_active = form.is_active;
        const cats = parseCategories(form.station_category_ids);
        updates.station_category_ids = cats !== undefined ? cats : null;
        await updateKdsDevice(modal.device_id, updates);
        toast?.({ type: "success", message: "Device updated." });
      }
      setModal(null);
      await load();
    } catch (err) {
      toast?.({ type: "error", message: err.message || "Save failed." });
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (device) => {
    if (!window.confirm(`Deactivate "${device.device_name}"? Any active KDS sessions will be terminated on next request.`)) return;
    setSaving(true);
    try {
      await deleteKdsDevice(device.device_id);
      toast?.({ type: "success", message: `"${device.device_name}" deactivated.` });
      await load();
    } catch (err) {
      toast?.({ type: "error", message: err.message || "Deactivate failed." });
    } finally {
      setSaving(false);
    }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleString("vi-VN") : "—";

  return (
    <div style={{ padding: "0" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "600" }}>KDS Device Management</h3>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
            Manage kitchen display terminals. PINs are bcrypt-hashed and never retrievable.
          </p>
        </div>
        <Btn onClick={openNew}>+ New Device</Btn>
      </div>

      {/* Device list */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>Loading devices…</div>
      ) : devices.length === 0 ? (
        <Card style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px" }}>
          No KDS devices configured yet. Create one to get started.
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {devices.map(device => (
            <Card key={device.device_id}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
                {/* Info */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                    <span style={{ fontWeight: "600", fontSize: "15px" }}>{device.device_name}</span>
                    <Badge active={device.is_active} />
                    {device.pin_fail_count > 0 && (
                      <span style={{ fontSize: "11px", color: "#f0a500" }}>
                        ⚠ {device.pin_fail_count} failed attempt{device.pin_fail_count > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: "3px" }}>
                    <span>Device ID: #{device.device_id}</span>
                    <span>Station filter: {device.station_category_ids
                      ? `Categories ${device.station_category_ids}` : "All categories (catch-all)"}</span>
                    <span>Created: {fmtDate(device.created_at)} by {device.created_by_name ?? "—"}</span>
                    <span>Last active: {fmtDate(device.last_active_at)}</span>
                    {device.pin_locked_until && new Date(device.pin_locked_until) > new Date() && (
                      <span style={{ color: "#e05252" }}>Locked until: {fmtDate(device.pin_locked_until)}</span>
                    )}
                  </div>
                </div>
                {/* Actions */}
                <div style={{ display: "flex", gap: "8px" }}>
                  <Btn variant="ghost" onClick={() => openEdit(device)}>Edit</Btn>
                  {device.is_active && (
                    <Btn variant="danger" onClick={() => handleDeactivate(device)} disabled={saving}>Deactivate</Btn>
                  )}
                  {!device.is_active && (
                    <Btn variant="success" onClick={() => updateKdsDevice(device.device_id, { is_active: true }).then(load)}>Reactivate</Btn>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modal !== null && (
        <Modal
          title={modal === "new" ? "New KDS Device" : `Edit — ${modal.device_name}`}
          onClose={() => setModal(null)}
          footer={
            <>
              <Btn variant="ghost" onClick={() => setModal(null)}>Cancel</Btn>
              <Btn variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Btn>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <Input
              label="Device Name *"
              placeholder="e.g. Main Kitchen KDS"
              value={form.device_name}
              onChange={e => setForm(f => ({ ...f, device_name: e.target.value }))}
            />
            <Input
              label={modal === "new" ? "PIN (4–8 digits) *" : "New PIN (leave blank to keep current)"}
              type="password"
              inputMode="numeric"
              placeholder="••••"
              value={form.pin}
              onChange={e => setForm(f => ({ ...f, pin: e.target.value }))}
            />
            <Input
              label="Station Category IDs (comma-separated, blank = all)"
              placeholder="e.g. 1, 3"
              value={form.station_category_ids}
              onChange={e => setForm(f => ({ ...f, station_category_ids: e.target.value }))}
            />
            {modal !== "new" && (
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--text-muted)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={!!form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                />
                Active (uncheck to deactivate — all current sessions will be terminated)
              </label>
            )}
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
              ⚠ PIN is bcrypt-hashed and cannot be retrieved after saving. Store it securely.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
