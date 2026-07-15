import { useCallback, useEffect, useState } from "react";
import {
  SectionHead,
  Button,
  EmptyState,
  NotConnectedNote,
} from "./StaffUI.jsx";
import {
  fetchShiftReportAudit,
  fetchShiftReportSummary,
} from "../services/staffApi.js";
import { DEMO_NOTICE } from "@/shared/constants.js";
import "../styles/staff-report-tab.css";

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StaffReportTab({ toast, onRefresh, refreshing }) {
  const [summary, setSummary] = useState(null);
  const [auditRows, setAuditRows] = useState([]);
  const [loading, setLoading] = useState(true);


  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, auditRes] = await Promise.all([
        fetchShiftReportSummary(),
        fetchShiftReportAudit(),
      ]);
      setSummary(summaryRes.data ?? null);
      setAuditRows(Array.isArray(auditRes.data) ? auditRes.data : []);

    } catch {
      toast?.("Could not load shift report", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleRefresh = () => {
    onRefresh?.();
    loadReport();
  };

  const handleShiftPlaceholder = (action) => {
    toast?.(`${action} — shift clock-in/out coming in a future update`, "info");
  };

  return (
    <div className="staff-report-tab">
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
        <Button
          variant="ghost"
          size="sm"
          icon="refresh"
          onClick={handleRefresh}
          disabled={refreshing || loading}
        >
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="sfx-loading staff-report-tab__loading">
          <span className="sfx-spinner" />
          <p>Loading shift report…</p>
        </div>
      ) : (
        <>
          <div className="staff-report-kpis">
            <article className="staff-report-kpi">
              <p className="staff-report-kpi__label">Shift revenue</p>
              <p className="staff-report-kpi__value">
                {formatMoney(summary?.total_revenue)}
              </p>
              <p className="staff-report-kpi__hint">
                {summary?.paid_orders_count ?? 0} paid orders today
              </p>
            </article>
            <article className="staff-report-kpi">
              <p className="staff-report-kpi__label">Tables served</p>
              <p className="staff-report-kpi__value">
                {summary?.tables_served_count ?? 0}
              </p>
              <p className="staff-report-kpi__hint">
                Date {summary?.report_date ?? "—"}
              </p>
            </article>
          </div>

          <div className="staff-report-shift">
            <h3 className="staff-report-shift__title">Shift check-in / check-out</h3>
            <div className="staff-report-shift__actions">
              <Button
                variant="primary"
                size="md"
                onClick={() => handleShiftPlaceholder("Start shift")}
              >
                Start shift
              </Button>
              <Button
                variant="ghost"
                size="md"
                onClick={() => handleShiftPlaceholder("End shift")}
              >
                End shift
              </Button>
            </div>
          </div>

          <section className="staff-report-audit">
            <header className="staff-report-audit__head">
              <h3>Activity log</h3>
              <span>Latest 20 entries</span>
            </header>

            {auditRows.length ? (
              <div className="staff-report-audit__table-wrap">
                <table className="staff-report-audit__table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Action</th>
                      <th>User</th>
                      <th>Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditRows.map((row) => (
                      <tr key={row.audit_log_id}>
                        <td>{formatDateTime(row.created_at)}</td>
                        <td>
                          <code className="staff-report-audit__action">
                            {row.action_name}
                          </code>
                        </td>
                        <td>{row.user_name || "—"}</td>
                        <td>{row.target_label || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon="search"
                title="No activity log yet"
                hint="Important actions are recorded in AuditLogs"
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default StaffReportTab;
