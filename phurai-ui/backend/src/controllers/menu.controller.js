import { query } from '../config/db.js';

export async function getPreorderItems(req, res, next) {
  try {
    const dishes = await query(
      `SELECT
         d.dish_id, d.dish_name, d.description,
         d.price, d.spicy_level, d.prep_time_min,
         c.category_name,
         img.image_url
       FROM dbo.Dishes d
       JOIN dbo.MenuCategories c ON d.category_id = c.category_id
       LEFT JOIN dbo.DishImages img
         ON d.dish_id = img.dish_id AND img.is_primary = 1
       WHERE d.is_available = 1
         AND d.allow_preorder = 1
       ORDER BY ISNULL(d.preorder_sort, 9999), c.display_order, d.dish_name`
    );
    return res.json({ dishes });
  } catch (err) { next(err); }
}

export async function getAvailableTables(req, res, next) {
  try {
    const { area_id, date, start_time, end_time, guest_count } = req.query;

    if (!date || !start_time || !end_time) {
      return res.status(400).json({ error: 'date, start_time, and end_time are required.' });
    }

    const startAt = new Date(`${date}T${start_time}:00`);
    const endAt   = new Date(`${date}T${end_time}:00`);

    if (isNaN(startAt) || isNaN(endAt)) {
      return res.status(400).json({ error: 'Invalid date or time format.' });
    }
    if (endAt <= startAt) {
      return res.status(400).json({ error: 'end_time must be after start_time.' });
    }

    const areaFilter  = area_id    ? 'AND t.area_id = @AreaId'        : '';
    const guestFilter = guest_count ? 'AND t.capacity >= @GuestCount'  : '';

    const tables = await query(
      `SELECT
         t.table_id,
         t.table_number,
         t.capacity,
         t.table_status,
         a.area_name,
         a.area_type,
         CASE
           WHEN t.table_status IN (N'Occupied', N'Cleaning', N'Inactive') THEN 0
           WHEN EXISTS (
             SELECT 1
             FROM dbo.ReservationTables rt2
             JOIN dbo.Reservations r2 ON rt2.reservation_id = r2.reservation_id
             WHERE rt2.table_id = t.table_id
               AND r2.reservation_status IN (N'Confirmed', N'Checked In')
               AND r2.reservation_start_at < @EndAt
               AND r2.reservation_end_at   > @StartAt
           ) THEN 0
           ELSE 1
         END AS is_available
       FROM dbo.RestaurantTables t
       JOIN dbo.RestaurantAreas a ON t.area_id = a.area_id
       WHERE a.is_active = 1
         AND t.table_status != N'Inactive'
         ${areaFilter}
         ${guestFilter}
       ORDER BY a.area_type, t.capacity, t.table_number`,
      {
        StartAt:    startAt,
        EndAt:      endAt,
        AreaId:     area_id     ? Number(area_id)     : null,
        GuestCount: guest_count ? Number(guest_count) : null,
      }
    );

    return res.json({ tables });
  } catch (err) { next(err); }
}

export async function getActivePromoCodes(req, res, next) {
  try {
    const promoCodes = await query(
      `SELECT
         v.promo_code_id, v.promo_code,
         v.usage_limit, v.times_used,
         p.promotion_name, p.description,
         p.discount_type, p.discount_value,
         p.min_order_value, p.max_discount,
         p.end_at
       FROM dbo.PromoCodes v
       JOIN dbo.Promotions p ON v.promotion_id = p.promotion_id
       WHERE v.is_active = 1
         AND p.is_active = 1
         AND v.times_used < v.usage_limit
         AND p.start_at  <= SYSDATETIME()
         AND p.end_at    >= SYSDATETIME()
       ORDER BY p.discount_type, p.discount_value DESC`
    );
    return res.json({ promoCodes: promoCodes });
  } catch (err) { next(err); }
}
