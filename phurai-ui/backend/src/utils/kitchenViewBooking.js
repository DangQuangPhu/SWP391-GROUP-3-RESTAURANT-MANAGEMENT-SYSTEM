export const KITCHEN_VIEW_AREA_NAME = "Kitchen View";
const KITCHEN_VIEW_CAPACITY_SETTING = "kitchen_view_counter_capacity";

export function isKitchenViewAreaName(areaName) {
  return String(areaName || "").trim().toLowerCase() === KITCHEN_VIEW_AREA_NAME.toLowerCase();
}

export async function loadAreaById(connection, areaId) {
  const id = Number(areaId);
  if (!Number.isFinite(id) || id <= 0) return null;

  const [rows] = await connection.query(
    `SELECT TOP 1 area_id, area_name, area_type, is_active
     FROM dbo.RestaurantAreas
     WHERE area_id = ?;`,
    [id]
  );

  return rows[0] || null;
}

export async function resolveKitchenViewCounterCapacity(connection, areaId, settings = {}) {
  const fromSettings = Number(settings[KITCHEN_VIEW_CAPACITY_SETTING]);
  if (Number.isFinite(fromSettings) && fromSettings > 0) {
    return fromSettings;
  }

  const [rows] = await connection.query(
    `SELECT COALESCE(SUM(t.capacity), 0) AS total_capacity
     FROM dbo.RestaurantTables t
     WHERE t.area_id = ?
       AND t.table_status <> N'Inactive';`,
    [areaId]
  );

  const summed = Number(rows[0]?.total_capacity);
  if (Number.isFinite(summed) && summed > 0) return summed;

  return 4;
}

export async function getKitchenViewPlaceholderTableId(connection, areaId) {
  const [rows] = await connection.query(
    `SELECT TOP 1 table_id, table_number, capacity
     FROM dbo.RestaurantTables
     WHERE area_id = ?
       AND table_status <> N'Inactive'
     ORDER BY table_number ASC;`,
    [areaId]
  );

  return rows[0] || null;
}

export async function getKitchenViewSeatsBooked(connection, areaId, slotStart, slotEnd) {
  const [rows] = await connection.query(
    `SELECT COALESCE(SUM(r.guest_count), 0) AS booked_seats
     FROM dbo.Reservations r
     WHERE r.preferred_area_id = ?
       AND r.reservation_status IN (N'Pending', N'Confirmed', N'Checked In')
       AND r.reservation_start_at < ?
       AND r.reservation_end_at > ?;`,
    [areaId, slotEnd, slotStart]
  );

  return Number(rows[0]?.booked_seats) || 0;
}
