import pool from "./db.js";

async function run() {
  try {
    const [rows] = await pool.query(`SELECT
         r.reservation_id,
         COALESCE(ua.full_name, r.contact_name, N'Guest')   AS customer_name,
         COALESCE(ua.phone,    r.contact_phone, N'')         AS customer_phone,
         COALESCE(ua.email,    r.contact_email, N'')         AS customer_email,
         r.reservation_start_at,
         r.reservation_end_at,
         r.guest_count,
         r.special_request,
         r.reservation_status,
         CASE WHEN r.has_pending_request = 1
              THEN N'Request'
              ELSE r.reservation_status
         END AS display_status,
         r.has_pending_request,
         r.request_type,
         r.edit_used_count,
         r.pending_changes_json,
         r.reservation_source,
         r.created_at,
         r.confirmed_at,
         r.checked_in_at,
         r.cancelled_at,
         r.cancel_reason,
         r.resolved_at,
         a.area_name AS preferred_area,
         STRING_AGG(t.table_number, ', ') AS assigned_tables
       FROM dbo.Reservations r
       LEFT JOIN dbo.UserAccounts ua ON r.customer_id = ua.user_id
       LEFT JOIN dbo.RestaurantAreas a ON r.preferred_area_id = a.area_id
       LEFT JOIN dbo.ReservationTables rt ON r.reservation_id = rt.reservation_id
       LEFT JOIN dbo.RestaurantTables t ON rt.table_id = t.table_id
       GROUP BY
         r.reservation_id, ua.full_name, r.contact_name, ua.phone, r.contact_phone,
         ua.email, r.contact_email, r.reservation_start_at, r.reservation_end_at,
         r.guest_count, r.special_request, r.reservation_status, r.reservation_source,
         r.created_at, r.confirmed_at, r.checked_in_at, r.cancelled_at,
         r.cancel_reason, r.resolved_at, a.area_name,
         r.has_pending_request, r.request_type, r.edit_used_count, r.pending_changes_json
       ORDER BY r.reservation_start_at DESC`);
    console.log("SUCCESS", rows.length);
  } catch (e) {
    console.error("ERROR", e);
  } finally {
    process.exit();
  }
}
run();
