import {
  readShiftMapping,
  updateShiftForStaff,
} from "../services/shiftMappingStore.js";

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
export function getStaffShiftMapping(_req, res) {
  try {
    const mapping = readShiftMapping();
    console.log("--- SHIFT MAPPING LOADED:", Object.keys(mapping).length, "staff");
    return jsonOk(res, mapping);
  } catch (error) {
    console.error("GET shift-mapping failed:", error);
    return jsonError(res, "Could not load shift assignments.");
  }
}

/**
 * PUT /api/manager/shift-mapping/:staffId
 * PUT /api/manager/shifts/:staffId  (alias)
 * Body: { shift: "Morning" | "Afternoon" | "Night" }
 */
export function putStaffShiftMapping(req, res) {
  const staffIdStr = String(req.params.staffId ?? "").trim();
  const shift = req.body?.shift;

  if (!staffIdStr) {
    return jsonError(res, "staffId is required.", 400);
  }

  console.log("--- SHIFT UPDATED FOR STAFF:", staffIdStr, "TO:", shift);

  try {
    const mapping = updateShiftForStaff(staffIdStr, shift);
    return jsonOk(res, {
      staff_id: staffIdStr,
      shift: mapping[staffIdStr],
      mapping,
    });
  } catch (error) {
    const message = error?.message || "Could not update shift assignment.";
    const status = message.includes("must be") ? 400 : 500;
    if (status === 500) {
      console.error("PUT shift-mapping failed:", error);
    }
    return jsonError(res, message, status);
  }
}
