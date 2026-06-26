import pool from "../db.js";

function jsonOk(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

function jsonError(res, message, status = 500) {
  return res.status(status).json({ success: false, message });
}

/**
 * GET /api/manager/shift-mapping
 * GET /api/staff/shift-mapping
 */
export async function getStaffShiftMapping(req, res) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [rows] = await pool.query(
      `SELECT ss.user_id, sh.shift_name
       FROM dbo.StaffSchedules ss
       JOIN dbo.Shifts sh ON ss.shift_id = sh.shift_id
       WHERE ss.work_date = ?`,
      [today]
    );
    const mapping = {};
    rows.forEach(r => {
      mapping[r.user_id] = r.shift_name;
    });
    return jsonOk(res, mapping);
  } catch (error) {
    console.error("GET shift-mapping failed:", error);
    return jsonError(res, "Could not load shift assignments.");
  }
}

/**
 * PUT /api/manager/shift-mapping/:staffId
 * Body: { shift: "Morning" | "Afternoon" | "Night" }
 */
export async function putStaffShiftMapping(req, res) {
  const staffIdStr = String(req.params.staffId ?? "").trim();
  const shift = req.body?.shift;

  if (!staffIdStr) {
    return jsonError(res, "staffId is required.", 400);
  }

  try {
    const today = new Date().toISOString().slice(0, 10);
    
    // Find shift ID
    const [shiftRows] = await pool.query(
      `SELECT shift_id FROM dbo.Shifts WHERE shift_name = ? AND is_active = 1`,
      [shift]
    );
    
    if (shiftRows.length === 0) {
      return jsonError(res, `Shift '${shift}' not found.`, 404);
    }
    
    const shiftId = shiftRows[0].shift_id;
    
    // Upsert StaffSchedules for today
    const [existing] = await pool.query(
      `SELECT schedule_id FROM dbo.StaffSchedules WHERE user_id = ? AND work_date = ?`,
      [staffIdStr, today]
    );
    
    if (existing.length > 0) {
      await pool.query(
        `UPDATE dbo.StaffSchedules SET shift_id = ? WHERE schedule_id = ?`,
        [shiftId, existing[0].schedule_id]
      );
    } else {
      await pool.query(
        `INSERT INTO dbo.StaffSchedules (user_id, shift_id, work_date, attendance_status, created_at)
         VALUES (?, ?, ?, N'Pending', SYSDATETIME())`,
        [staffIdStr, today]
      );
    }

    return jsonOk(res, {
      staff_id: staffIdStr,
      shift: shift
    });
  } catch (error) {
    console.error("PUT shift-mapping failed:", error);
    return jsonError(res, "Could not update shift assignment.", 500);
  }
}
