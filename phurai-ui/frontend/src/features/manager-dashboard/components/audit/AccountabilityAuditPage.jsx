import { useCallback, useEffect, useMemo, useState } from "react";
import { SectionHead, ContentPanel, Button } from "../ManagerUI.jsx";
import { fetchAccountabilityAudit } from "../../services/managerApi.js";

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAction(value) {
  return String(value || "—").replace(/_/g, " ");
}

function SummaryCard({ label, value }) {
  return (
    <article className="manager-audit-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function AccountabilityAuditPage({ currentUser, toast }) {
  const userId = currentUser?.user_id ?? currentUser?.userId ?? currentUser?.id;
  const today = new Date().toISOString().slice(0, 10);
  const [filters, setFilters] = useState({
    table_id: "",
    staff_id: "",
    action: "",
    date: today,
  });
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadAudit = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await fetchAccountabilityAudit(
        {
          ...filters,
          limit: 100,
        },
        userId
      );
      setRows(Array.isArray(data.logs) ? data.logs : []);
      setSummary(data.summary || {});
      setActions(Array.isArray(data.actions) ? data.actions : []);
    } catch (err) {
      toast?.(err.message || "Could not load accountability audit.", "error");
      setRows([]);
      setSummary({});
    } finally {
      setLoading(false);
    }
  }, [filters, toast, userId]);

  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  const busiestTableLabel = useMemo(() => {
    if (!summary?.busiest_table?.table_id) return "—";
    return `Table ${summary.busiest_table.table_id} (${summary.busiest_table.count})`;
  }, [summary]);

  return (
    <div className="sfx-stack manager-audit">
      <SectionHead
        title="Accountability Audit"
        subtitle="Read-only oversight of table, order stage, payment and release events"
      />

      <div className="manager-audit-grid">
        <SummaryCard label="Events" value={summary.total_events ?? 0} />
        <SummaryCard label="Staff actors" value={summary.active_staff_count ?? 0} />
        <SummaryCard label="Served actions" value={summary.order_served_count ?? 0} />
        <SummaryCard label="Bill requests" value={summary.bill_requested_count ?? 0} />
        <SummaryCard label="Busiest table" value={busiestTableLabel} />
      </div>

      <ContentPanel compact>
        <div className="manager-audit-filters" aria-label="Audit filters">
          <label>
            <span>Table ID</span>
            <input
              className="sfx-input"
              inputMode="numeric"
              value={filters.table_id}
              onChange={(e) => setFilters((prev) => ({ ...prev, table_id: e.target.value }))}
              placeholder="Any"
            />
          </label>
          <label>
            <span>Staff ID</span>
            <input
              className="sfx-input"
              inputMode="numeric"
              value={filters.staff_id}
              onChange={(e) => setFilters((prev) => ({ ...prev, staff_id: e.target.value }))}
              placeholder="Any"
            />
          </label>
          <label>
            <span>Action</span>
            <select
              className="sfx-select"
              value={filters.action}
              onChange={(e) => setFilters((prev) => ({ ...prev, action: e.target.value }))}
            >
              <option value="">All actions</option>
              {actions.map((action) => (
                <option key={action} value={action}>
                  {formatAction(action)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Date</span>
            <input
              className="sfx-input"
              type="date"
              value={filters.date}
              onChange={(e) => setFilters((prev) => ({ ...prev, date: e.target.value }))}
            />
          </label>
          <Button variant="ghost" icon="refresh" onClick={loadAudit} disabled={loading}>
            Refresh
          </Button>
        </div>

        <div className="manager-audit-table-wrap">
          <table className="manager-audit-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Table</th>
                <th>Stage</th>
                <th>Order</th>
                <th>Reservation</th>
                <th>Customer</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.audit_log_id}>
                  <td>{formatDateTime(row.created_at)}</td>
                  <td>{formatAction(row.action_name)}</td>
                  <td>
                    <strong>{row.actor_name || "SYSTEM"}</strong>
                    <span>{row.actor_role || "—"} · #{row.actor_user_id || "—"}</span>
                  </td>
                  <td>{row.table_id ? `#${row.table_id}` : "—"}</td>
                  <td>{row.course_stage || "—"}</td>
                  <td>{row.order_id ? `#${row.order_id}` : "—"}</td>
                  <td>{row.reservation_id ? `#${row.reservation_id}` : "—"}</td>
                  <td>{row.customer_id ? `#${row.customer_id}` : "—"}</td>
                </tr>
              ))}
              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan="8" className="manager-audit-empty">
                    No audit events match these filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </ContentPanel>
    </div>
  );
}

export default AccountabilityAuditPage;
