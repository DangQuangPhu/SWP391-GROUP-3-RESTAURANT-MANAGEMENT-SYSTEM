import { useMemo, useState } from "react";
import { StaffDrawer } from "../StaffOverlay.jsx";
import {
  SectionHead,
  Toolbar,
  SearchField,
  StatusBadge,
  Button,
  EmptyState,
} from "../StaffUI.jsx";
import {
  ASSIGN_TABLE_OPTIONS,
  DEMO_NOTICE,
  RESERVATION_STATUS_META,
} from "../../data/staffDashboardMockData.js";
import {
  isPendingOnlineReservation,
  normalizeQueueToken,
} from "../../services/staffApi.js";

function ReservationQueueSection({
  queue,
  setQueue,
  dataSource,
  toast,
}) {
  const [search, setSearch] = useState("");
  const [assignTarget, setAssignTarget] = useState(null);
  const [selectedTable, setSelectedTable] = useState("");

  const pendingOnlineQueue = useMemo(
    () => queue.filter(isPendingOnlineReservation),
    [queue]
  );

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) return pendingOnlineQueue;
    return pendingOnlineQueue.filter(
      (r) =>
        r.customer_name.toLowerCase().includes(kw) ||
        String(r.phone).includes(kw) ||
        r.area_name.toLowerCase().includes(kw)
    );
  }, [pendingOnlineQueue, search]);

  const updateStatus = (id, nextStatus, message) => {
    setQueue((prev) =>
      prev.map((r) => (r.reservation_id === id ? { ...r, status: nextStatus } : r))
    );
    toast(message, "info");
  };

  const openAssign = (reservation) => {
    setAssignTarget(reservation);
    setSelectedTable("");
  };

  const confirmAssign = () => {
    if (!assignTarget) return;
    if (!selectedTable) {
      toast("Please select a table", "error");
      return;
    }
    const table = ASSIGN_TABLE_OPTIONS.find((t) => String(t.table_id) === selectedTable);
    setQueue((prev) =>
      prev.map((r) =>
        r.reservation_id === assignTarget.reservation_id
          ? {
              ...r,
              table_label: table?.table_number || selectedTable,
              status: "confirmed",
            }
          : r
      )
    );
    toast(
      `Table ${table?.table_number || selectedTable} assigned locally (API not connected)`,
      "info"
    );
    setAssignTarget(null);
    setSelectedTable("");
  };

  const eligibleTables = useMemo(() => {
    if (!assignTarget) return ASSIGN_TABLE_OPTIONS;
    return ASSIGN_TABLE_OPTIONS.filter((t) => t.capacity >= assignTarget.party_size);
  }, [assignTarget]);

  return (
    <div className="sfx-stack">
      {dataSource === "mock" ? (
        <div className="sfx-queue-banner sfx-queue-banner--mock" role="status">
          <span>{DEMO_NOTICE}</span>
        </div>
      ) : (
        <div className="sfx-queue-banner" role="status">
          Live queue · pending online bookings for today
        </div>
      )}

      <SectionHead
        title="Reservation Queue"
        subtitle={`${filtered.length} pending online booking${filtered.length === 1 ? "" : "s"}`}
      />

      <Toolbar>
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Guest name, phone, or area…"
        />
      </Toolbar>

      <div className="sfx-card sfx-card--flush">
        <div className="sfx-table-wrap">
          <table className="sfx-table sfx-table--hover">
            <thead>
              <tr>
                <th>Time</th>
                <th>Customer</th>
                <th>Guests</th>
                <th>Preferred area</th>
                <th>Table</th>
                <th>Status</th>
                <th className="sfx-table__right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const statusKey = normalizeQueueToken(r.status ?? r.reservation_status);
                const meta = RESERVATION_STATUS_META[statusKey] || RESERVATION_STATUS_META.pending;
                const isPending = statusKey === "pending";
                return (
                  <tr key={r.reservation_id}>
                    <td className="sfx-mono">
                      {r.start_time}
                      <small className="sfx-cell-sub">{r.reservation_date}</small>
                    </td>
                    <td>
                      <strong>{r.customer_name}</strong>
                      <small className="sfx-cell-sub">{r.phone}</small>
                    </td>
                    <td>{r.party_size}</td>
                    <td>{r.area_name}</td>
                    <td>{r.table_label || "—"}</td>
                    <td>
                      <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                    </td>
                    <td className="sfx-table__right">
                      {isPending ? (
                        <div className="sfx-rowacts">
                          <Button
                            size="sm"
                            variant="soft"
                            onClick={() =>
                              updateStatus(
                                r.reservation_id,
                                "confirmed",
                                "Reservation confirmed (local only — API not connected)"
                              )
                            }
                          >
                            Confirm
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() =>
                              updateStatus(
                                r.reservation_id,
                                "cancelled",
                                "Reservation rejected (local only — API not connected)"
                              )
                            }
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            variant="gold"
                            icon="table"
                            onClick={() => openAssign(r)}
                          >
                            Assign Table
                          </Button>
                        </div>
                      ) : (
                        <span className="sfx-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 ? (
          <EmptyState
            icon="calendar"
            title="No pending online bookings"
            hint="New reservations from the website will appear here for staff review."
          />
        ) : null}
      </div>

      <StaffDrawer
        open={Boolean(assignTarget)}
        title={assignTarget ? `Assign table — ${assignTarget.customer_name}` : ""}
        onClose={() => setAssignTarget(null)}
        footer={
          <div className="sfx-drawer__acts">
            <Button variant="ghost" onClick={() => setAssignTarget(null)}>
              Cancel
            </Button>
            <Button variant="gold" onClick={confirmAssign}>
              Assign table
            </Button>
          </div>
        }
      >
        {assignTarget ? (
          <div className="sfx-assign-form">
            <p>
              Party of <strong>{assignTarget.party_size}</strong> · preferred{" "}
              <strong>{assignTarget.area_name}</strong>
            </p>
            {assignTarget.special_request ? (
              <p className="sfx-note">
                <span>{assignTarget.special_request}</span>
              </p>
            ) : null}
            <label>
              Select table
              <select
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
              >
                <option value="">Choose a table…</option>
                {eligibleTables.map((t) => (
                  <option key={t.table_id} value={String(t.table_id)}>
                    {t.table_number} · {t.area_name} (seats {t.capacity})
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
      </StaffDrawer>
    </div>
  );
}

export default ReservationQueueSection;
