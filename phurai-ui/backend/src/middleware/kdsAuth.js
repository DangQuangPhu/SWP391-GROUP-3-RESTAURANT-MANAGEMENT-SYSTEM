/**
 * KDS Device Authentication Middleware
 * requireKdsDevice: validates KDS JWT + DB is_active check on every request.
 *
 * KDS tokens: { type: 'kds_device', device_id, device_name }
 * - Rejected if type !== 'kds_device' (blocks user tokens from accessing KDS routes)
 * - Real-time revocation: checks KitchenDevices.is_active on every call
 * - Parses station_category_ids for queue filtering (attached to req.device)
 */
import jwt from 'jsonwebtoken';
import { getRawPool } from '../db.js';
import sql from 'mssql';

export const requireKdsDevice = async (req, res, next) => {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'KDS device token required.' });
  }

  const token = header.slice(7);
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired KDS token.' });
  }

  // Hard reject user tokens — even a valid Staff/Admin JWT cannot access KDS routes
  if (decoded.type !== 'kds_device' || !decoded.device_id) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. This route requires a KDS device token, not a user token.',
    });
  }

  // DB lookup for real-time revocation (one indexed PK read per request)
  let pool;
  try {
    pool = await getRawPool();
    const result = await pool.request()
      .input('deviceId', sql.Int, decoded.device_id)
      .query(`
        SELECT device_id, device_name, is_active, station_category_ids
        FROM dbo.KitchenDevices
        WHERE device_id = @deviceId
      `);

    const device = result.recordset[0];
    if (!device) {
      return res.status(403).json({ success: false, message: 'KDS device not found.' });
    }
    if (!device.is_active) {
      return res.status(403).json({
        success: false,
        message: 'This KDS device has been disabled by an administrator.',
      });
    }

    // Parse station_category_ids JSON string → int array | null
    let stationCategoryIds = null;
    if (device.station_category_ids) {
      try {
        const parsed = JSON.parse(device.station_category_ids);
        if (Array.isArray(parsed) && parsed.length > 0) {
          stationCategoryIds = parsed.map(Number).filter(Number.isFinite);
        }
      } catch {
        // Malformed JSON → treat as catch-all (null)
      }
    }

    req.device = {
      device_id: device.device_id,
      device_name: device.device_name,
      station_category_ids: stationCategoryIds, // null = all categories
    };

    // Update last_active_at (fire-and-forget — don't block the request)
    pool.request()
      .input('deviceId', sql.Int, device.device_id)
      .query(`UPDATE dbo.KitchenDevices SET last_active_at = SYSDATETIME() WHERE device_id = @deviceId`)
      .catch(err => console.warn('[kdsAuth] Failed to update last_active_at:', err.message));

    next();
  } catch (err) {
    console.error('[kdsAuth] requireKdsDevice DB error:', err);
    return res.status(500).json({ success: false, message: 'Authentication error.' });
  }
};
