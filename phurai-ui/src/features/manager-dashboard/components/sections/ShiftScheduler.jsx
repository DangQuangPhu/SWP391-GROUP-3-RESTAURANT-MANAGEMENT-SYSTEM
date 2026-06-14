import { useCallback, useEffect, useMemo, useState } from "react";
import { ManagerModal } from "../ManagerOverlay.jsx";
import { Toolbar, Button, EmptyState } from "../ManagerUI.jsx";
import Icon from "../ManagerIcons.jsx";
import { useManagerPortal } from "../../context/ManagerPortalContext.jsx";
import { STAFF_ASSIGNABLE_ROLES } from "../../data/managerDashboardMockData.js";
import {
  fetchShifts,
  fetchSchedules,
  fetchManager,
  assignSchedule,
  updateScheduleAttendance,
} from "../../services/managerApi.js";
import { formatVND } from "@/utils/formatCurrency.js";

const ATTENDANCE_STATUSES = ["Scheduled", "Present", "Absent", "On Leave"];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatTodayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function formatShiftLabel(shift) {
  if (!shift) return "—";
  const { shift_name: name, start_time: start, end_time: end } = shift;
  if (start && end) return `${name}: ${start} - ${end}`;
  return name || "—";
}

function isAssignableStaff(member) {
  return STAFF_ASSIGNABLE_ROLES.includes(String(member?.role_name ?? "").trim());
}

function staffMemberId(member) {
  return member?.user_id ?? member?.manager_id ?? null;
}

function ShiftScheduler() {
  const { toast, currentUser } = useManagerPortal();
  const managerUserId = currentUser?.userId ?? currentUser?.id ?? null;

  const [selectedDate, setSelectedDate] = useState(formatTodayIso);
  const [schedules, setSchedules] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [assignableStaff, setAssignableStaff] = useState([]);

  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [patchingId, setPatchingId] = useState(null);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({ user_id: "", shift_id: "" });
  const [assigning, setAssigning] = useState(false);

  const dailyLaborCost = useMemo(() => {
    return schedules.reduce((sum, row) => {
      const salary = row.base_salary != null ? Number(row.base_salary) : 0;
      return sum + (Number.isFinite(salary) ? salary / 30 : 0);
    }, 0);
  }, [schedules]);

  const loadSchedules = useCallback(async () => {
    if (!managerUserId) return;
    setLoadingSchedules(true);
    try {
      const res = await fetchSchedules(selectedDate, managerUserId);
      setSchedules(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast("Could not load schedules", "error");
      setSchedules([]);
    } finally {
      setLoadingSchedules(false);
    }
  }, [managerUserId, selectedDate, toast]);

  useEffect(() => {
    if (!managerUserId) {
      setLoadingMeta(false);
      return undefined;
    }

    let alive = true;
    setLoadingMeta(true);

    Promise.all([fetchShifts(managerUserId), fetchManager()])
      .then(([shiftRes, staffRes]) => {
        if (!alive) return;
        setShifts(Array.isArray(shiftRes.data) ? shiftRes.data : []);
        const staff = (Array.isArray(staffRes.data) ? staffRes.data : []).filter(isAssignableStaff);
        setAssignableStaff(staff);
      })
      .catch(() => {
        if (!alive) return;
        toast("Could not load shift metadata", "error");
      })
      .finally(() => {
        if (alive) setLoadingMeta(false);
      });

    return () => {
      alive = false;
    };
  }, [managerUserId, toast]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  const openAssignModal = () => {
    const defaultShiftId = shifts[0]?.shift_id ?? "";
    setAssignForm({ user_id: "", shift_id: defaultShiftId ? String(defaultShiftId) : "" });
    setAssignOpen(true);
  };

  const handleStatusChange = async (schedule, nextStatus) => {
    if (!managerUserId || nextStatus === schedule.attendance_status) return;

    const previousStatus = schedule.attendance_status;
    setSchedules((prev) =>
      prev.map((row) =>
        row.schedule_id === schedule.schedule_id
          ? { ...row, attendance_status: nextStatus }
          : row
      )
    );
    setPatchingId(schedule.schedule_id);

    try {
      await updateScheduleAttendance(schedule.schedule_id, nextStatus, managerUserId);
      toast("Attendance status updated", "success");
    } catch (error) {
      setSchedules((prev) =>
        prev.map((row) =>
          row.schedule_id === schedule.schedule_id
            ? { ...row, attendance_status: previousStatus }
            : row
        )
      );
      toast(error?.message || "Could not update attendance status", "error");
    } finally {
      setPatchingId(null);
    }
  };

  const handleAssignSubmit = async () => {
    if (!managerUserId) {
      toast("Manager session required", "error");
      return;
    }
    const userId = Number(assignForm.user_id);
    const shiftId = Number(assignForm.shift_id);
    if (!Number.isFinite(userId) || userId <= 0 || !Number.isFinite(shiftId) || shiftId <= 0) {
      toast("Select a staff member and shift", "error");
      return;
    }

    setAssigning(true);
    try {
      await assignSchedule(
        {
          work_date: selectedDate,
          user_id: userId,
          shift_id: shiftId,
        },
        managerUserId
      );
      toast("Shift assigned successfully", "success");
      setAssignOpen(false);
      await loadSchedules();
    } catch (error) {
      toast(error?.message || "Could not assign shift", "error");
    } finally {
      setAssigning(false);
    }
  };

  if (!managerUserId) {
    return (
      <EmptyState
        icon="users"
        title="Manager session required"
        hint="Sign in as a Manager to manage shift schedules."
      />
    );
  }

  if (loadingMeta) {
    return (
      <div className="sfx-loading">
        <span className="sfx-spinner" />
        <p>Loading shift scheduler…</p>
      </div>
    );
  }

  return (
    <div className="sfx-stack">
      <div className="sfx-kpis">
        <article className="sfx-kpi sfx-kpi--amber">
          <div className="sfx-kpi__top">
            <span className="sfx-kpi__icon">
              <Icon name="wallet" size={18} />
            </span>
          </div>
          <p className="sfx-kpi__value">{formatVND(dailyLaborCost)}</p>
          <p className="sfx-kpi__label">Estimated Daily Labor Cost</p>
        </article>
      </div>

      <Toolbar>
        <label className="sfx-field">
          <span>Work date</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </label>
        <Button variant="gold" icon="plus" onClick={openAssignModal}>
          Assign Shift
        </Button>
      </Toolbar>

      <div className="sfx-card sfx-card--flush">
        {loadingSchedules ? (
          <div className="sfx-loading">
            <span className="sfx-spinner" />
            <p>Loading schedules…</p>
          </div>
        ) : (
          <div className="sfx-table-wrap">
            <table className="sfx-table sfx-table--hover">
              <thead>
                <tr>
                  <th>Staff Name</th>
                  <th>Role</th>
                  <th>Shift</th>
                  <th>Attendance Status</th>
                  <th className="sfx-table__right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((row) => (
                  <tr key={row.schedule_id}>
                    <td>
                      <strong>{row.full_name}</strong>
                    </td>
                    <td>{row.role_name}</td>
                    <td>{formatShiftLabel(row)}</td>
                    <td>
                      <select
                        className="sfx-select"
                        value={row.attendance_status}
                        disabled={patchingId === row.schedule_id}
                        onChange={(e) => handleStatusChange(row, e.target.value)}
                        aria-label={`Attendance status for ${row.full_name}`}
                      >
                        {ATTENDANCE_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="sfx-table__right">
                      <span className="sfx-cell-sub">—</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loadingSchedules && schedules.length === 0 ? (
          <EmptyState
            icon="calendar"
            title="No shifts scheduled"
            hint="Assign staff to a shift for this date."
          />
        ) : null}
      </div>

      <ManagerModal
        open={assignOpen}
        title="Assign Shift"
        onClose={() => setAssignOpen(false)}
        footer={
          <div className="sfx-modal__footacts">
            <Button variant="ghost" onClick={() => setAssignOpen(false)} disabled={assigning}>
              Cancel
            </Button>
            <Button variant="gold" onClick={handleAssignSubmit} disabled={assigning}>
              {assigning ? "Assigning…" : "Assign shift"}
            </Button>
          </div>
        }
      >
        <div className="sfx-form">
          <label className="sfx-field">
            <span>Staff member</span>
            <select
              value={assignForm.user_id}
              onChange={(e) => setAssignForm((prev) => ({ ...prev, user_id: e.target.value }))}
            >
              <option value="">Select staff…</option>
              {assignableStaff.map((member) => {
                const id = staffMemberId(member);
                return (
                  <option key={id} value={id}>
                    {member.full_name} ({member.role_name})
                  </option>
                );
              })}
            </select>
          </label>
          <label className="sfx-field">
            <span>Shift</span>
            <select
              value={assignForm.shift_id}
              onChange={(e) => setAssignForm((prev) => ({ ...prev, shift_id: e.target.value }))}
            >
              <option value="">Select shift…</option>
              {shifts.map((shift) => (
                <option key={shift.shift_id} value={shift.shift_id}>
                  {formatShiftLabel(shift)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </ManagerModal>
    </div>
  );
}

export default ShiftScheduler;
