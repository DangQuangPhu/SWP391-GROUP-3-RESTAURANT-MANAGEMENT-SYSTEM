import sql from "mssql";
import { createDbRequest } from "../db.js";

const ASSIGNABLE_ROLES = new Set(["Restaurant Staff", "Kitchen Staff"]);

const ATTENDANCE_STATUSES = new Set(["Scheduled", "Present", "Absent", "On Leave"]);

function jsonOk(res, data) {
  return res.json({ success: true, data });
}

function jsonError(res, message, status = 500) {
  return res.status(status).json({ success: false, message });
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatSqlTime(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${pad2(value.getHours())}:${pad2(value.getMinutes())}`;
  }
  const text = String(value);
  return text.length >= 5 ? text.slice(0, 5) : text;
}

function formatTodayDate() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function parseWorkDate(raw) {
  if (!raw) return formatTodayDate();
  const text = String(raw).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return text;
}

async function fetchUserRoleName(userId) {
  const request = await createDbRequest();
  request.input("userId", sql.Int, userId);

  const result = await request.query(
    `SELECT r.role_name
     FROM dbo.UserAccounts AS ua
     INNER JOIN dbo.Roles AS r ON ua.role_id = r.role_id
     WHERE ua.user_id = @userId
       AND ua.is_active = 1;`
  );

  return result.recordset[0]?.role_name ?? null;
}

function mapScheduleRow(row) {
  return {
    schedule_id: row.schedule_id,
    user_id: row.user_id,
    full_name: row.full_name,
    role_name: row.role_name,
    base_salary: row.base_salary != null ? Number(row.base_salary) : null,
    shift_id: row.shift_id,
    shift_name: row.shift_name,
    start_time: formatSqlTime(row.start_time),
    end_time: formatSqlTime(row.end_time),
    attendance_status: row.attendance_status,
  };
}

export async function listShifts(_req, res) {
  try {
    const request = await createDbRequest();
    const result = await request.query(
      `SELECT
         s.shift_id,
         s.shift_name,
         s.start_time,
         s.end_time
       FROM dbo.Shifts AS s
       WHERE s.is_active = 1
       ORDER BY s.start_time ASC, s.shift_name ASC;`
    );

    const data = result.recordset.map((row) => ({
      shift_id: row.shift_id,
      shift_name: row.shift_name,
      start_time: formatSqlTime(row.start_time),
      end_time: formatSqlTime(row.end_time),
    }));

    return jsonOk(res, data);
  } catch (error) {
    console.error("GET /api/manager/shifts failed:", error);
    return jsonError(res, "Could not load shifts.");
  }
}

export async function listSchedules(req, res) {
  try {
    const workDate = parseWorkDate(req.query.date);
    if (!workDate) {
      return jsonError(res, "Invalid date. Use YYYY-MM-DD.", 400);
    }

    const request = await createDbRequest();
    request.input("workDate", sql.Date, workDate);

    const result = await request.query(
      `SELECT
         ss.schedule_id,
         ss.user_id,
         ua.full_name,
         r.role_name,
         sp.base_salary,
         ss.shift_id,
         s.shift_name,
         s.start_time,
         s.end_time,
         ss.attendance_status
       FROM dbo.StaffSchedules AS ss
       INNER JOIN dbo.UserAccounts AS ua ON ua.user_id = ss.user_id
       INNER JOIN dbo.Roles AS r ON r.role_id = ua.role_id
       INNER JOIN dbo.Shifts AS s ON s.shift_id = ss.shift_id
       LEFT JOIN dbo.StaffProfiles AS sp ON sp.user_id = ua.user_id
       WHERE ss.work_date = @workDate
       ORDER BY s.start_time ASC, ua.full_name ASC;`
    );

    return jsonOk(res, result.recordset.map(mapScheduleRow));
  } catch (error) {
    console.error("GET /api/manager/schedules failed:", error);
    return jsonError(res, "Could not load schedules.");
  }
}

export async function createSchedule(req, res) {
  try {
    const userId = Number(req.body?.user_id);
    const shiftId = Number(req.body?.shift_id);
    const workDate = parseWorkDate(req.body?.work_date);

    if (!Number.isFinite(userId) || userId <= 0) {
      return jsonError(res, "user_id is required.", 400);
    }
    if (!Number.isFinite(shiftId) || shiftId <= 0) {
      return jsonError(res, "shift_id is required.", 400);
    }
    if (!workDate) {
      return jsonError(res, "work_date is required (YYYY-MM-DD).", 400);
    }

    const targetRole = await fetchUserRoleName(userId);
    if (!targetRole) {
      return jsonError(res, "Target user not found or inactive.", 404);
    }
    if (!ASSIGNABLE_ROLES.has(targetRole)) {
      return jsonError(
        res,
        "Shifts can only be assigned to Restaurant Staff or Kitchen Staff.",
        403
      );
    }

    const shiftRequest = await createDbRequest();
    shiftRequest.input("shiftId", sql.Int, shiftId);
    const shiftResult = await shiftRequest.query(
      `SELECT TOP 1 shift_id
       FROM dbo.Shifts
       WHERE shift_id = @shiftId
         AND is_active = 1;`
    );
    if (!shiftResult.recordset[0]) {
      return jsonError(res, "Shift not found or inactive.", 404);
    }

    const insertRequest = await createDbRequest();
    insertRequest.input("userId", sql.Int, userId);
    insertRequest.input("shiftId", sql.Int, shiftId);
    insertRequest.input("workDate", sql.Date, workDate);
    insertRequest.input("assignedBy", sql.Int, req.userId);

    const insertResult = await insertRequest.query(
      `INSERT INTO dbo.StaffSchedules
         (user_id, shift_id, work_date, attendance_status, assigned_by)
       OUTPUT
         INSERTED.schedule_id,
         INSERTED.user_id,
         INSERTED.shift_id,
         INSERTED.work_date,
         INSERTED.attendance_status
       VALUES
         (@userId, @shiftId, @workDate, N'Scheduled', @assignedBy);`
    );

    const created = insertResult.recordset[0];
    return res.status(201).json({
      success: true,
      data: {
        schedule_id: created.schedule_id,
        user_id: created.user_id,
        shift_id: created.shift_id,
        work_date: created.work_date,
        attendance_status: created.attendance_status,
      },
    });
  } catch (error) {
    console.error("POST /api/manager/schedules failed:", error);
    return jsonError(res, "Could not assign shift.");
  }
}

export async function updateScheduleStatus(req, res) {
  try {
    const scheduleId = Number(req.params.id);
    const attendanceStatus = String(req.body?.attendance_status ?? "").trim();

    if (!Number.isFinite(scheduleId) || scheduleId <= 0) {
      return jsonError(res, "Invalid schedule id.", 400);
    }
    if (!ATTENDANCE_STATUSES.has(attendanceStatus)) {
      return jsonError(
        res,
        "attendance_status must be one of: Scheduled, Present, Absent, On Leave.",
        400
      );
    }

    const lookupRequest = await createDbRequest();
    lookupRequest.input("scheduleId", sql.Int, scheduleId);
    const lookupResult = await lookupRequest.query(
      `SELECT
         ss.schedule_id,
         ss.user_id,
         r.role_name
       FROM dbo.StaffSchedules AS ss
       INNER JOIN dbo.UserAccounts AS ua ON ua.user_id = ss.user_id
       INNER JOIN dbo.Roles AS r ON r.role_id = ua.role_id
       WHERE ss.schedule_id = @scheduleId;`
    );

    const existing = lookupResult.recordset[0];
    if (!existing) {
      return jsonError(res, "Schedule not found.", 404);
    }
    if (!ASSIGNABLE_ROLES.has(existing.role_name)) {
      return jsonError(
        res,
        "Attendance can only be updated for Restaurant Staff or Kitchen Staff schedules.",
        403
      );
    }

    const updateRequest = await createDbRequest();
    updateRequest.input("scheduleId", sql.Int, scheduleId);
    updateRequest.input("attendanceStatus", sql.NVarChar(20), attendanceStatus);

    const updateResult = await updateRequest.query(
      `UPDATE dbo.StaffSchedules
       SET attendance_status = @attendanceStatus
       OUTPUT INSERTED.schedule_id, INSERTED.attendance_status
       WHERE schedule_id = @scheduleId;`
    );

    const updated = updateResult.recordset[0];
    return jsonOk(res, {
      schedule_id: updated.schedule_id,
      attendance_status: updated.attendance_status,
    });
  } catch (error) {
    console.error("PATCH /api/manager/schedules/:id/status failed:", error);
    return jsonError(res, "Could not update attendance status.");
  }
}
