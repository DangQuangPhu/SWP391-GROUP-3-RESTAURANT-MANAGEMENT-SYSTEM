/**
 * KDS Controller
 * Handles:
 *   - POST /api/kds/activate       — PIN authentication, issues KDS JWT
 *   - POST /api/admin/kds-devices  — Admin CRUD for KitchenDevices
 *   - GET  /api/admin/kds-devices
 *   - PATCH /api/admin/kds-devices/:id
 *   - DELETE /api/admin/kds-devices/:id (soft-delete)
 */
import { getRawPool } from '../db.js';
import sql from 'mssql';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────
// POST /api/kds/activate  (public — no auth middleware)
// ─────────────────────────────────────────────────────────────
export const activateDevice = async (req, res) => {
  const { device_id, pin } = req.body ?? {};

  if (!device_id || !pin) {
    return res.status(400).json({ success: false, message: 'device_id and pin are required.' });
  }
  if (!/^\d{4,8}$/.test(String(pin))) {
    return res.status(400).json({ success: false, message: 'PIN must be 4–8 digits.' });
  }

  let pool;
  try {
    pool = await getRawPool();
    const result = await pool.request()
      .input('deviceId', sql.Int, device_id)
      .query(`
        SELECT device_id, device_name, device_pin_hash, is_active,
               pin_fail_count, pin_locked_until, station_category_ids
        FROM dbo.KitchenDevices
        WHERE device_id = @deviceId
      `);

    const device = result.recordset[0];
    if (!device || !device.is_active) {
      return res.status(404).json({ success: false, message: 'Device not found or inactive.' });
    }

    // Lockout check
    if (device.pin_locked_until && new Date(device.pin_locked_until) > new Date()) {
      const unlockAt = new Date(device.pin_locked_until);
      return res.status(429).json({
        success: false,
        message: 'Too many failed attempts. Device is temporarily locked.',
        unlock_at: unlockAt.toISOString(),
      });
    }

    const pinValid = await bcrypt.compare(String(pin), device.device_pin_hash);

    if (!pinValid) {
      const newCount = (device.pin_fail_count ?? 0) + 1;
      const lockUntil = newCount >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;

      await pool.request()
        .input('deviceId', sql.Int, device_id)
        .input('count', sql.TinyInt, Math.min(newCount, 127))
        .input('lockUntil', sql.DateTime2, lockUntil)
        .query(`
          UPDATE dbo.KitchenDevices
          SET pin_fail_count = @count, pin_locked_until = @lockUntil
          WHERE device_id = @deviceId
        `);

      return res.status(401).json({
        success: false,
        message: newCount >= 5
          ? 'Incorrect PIN. Device locked for 15 minutes.'
          : `Incorrect PIN. ${5 - newCount} attempt(s) remaining.`,
      });
    }

    // Success — reset counters, update last_active_at
    await pool.request()
      .input('deviceId', sql.Int, device_id)
      .query(`
        UPDATE dbo.KitchenDevices
        SET pin_fail_count = 0, pin_locked_until = NULL, last_active_at = SYSDATETIME()
        WHERE device_id = @deviceId
      `);

    // Issue KDS JWT — station_category_ids NOT embedded (fetched fresh from DB per request)
    const token = jwt.sign(
      { type: 'kds_device', device_id: device.device_id, device_name: device.device_name },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    return res.json({
      success: true,
      token,
      device_name: device.device_name,
      expires_in: '12h',
    });
  } catch (err) {
    console.error('[kdsController] activateDevice error:', err);
    return res.status(500).json({ success: false, message: 'Failed to activate device.' });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/admin/kds-devices
// ─────────────────────────────────────────────────────────────
export const listDevices = async (req, res) => {
  try {
    const pool = await getRawPool();
    const result = await pool.request().query(`
      SELECT kd.device_id, kd.device_name, kd.station_category_ids,
             kd.is_active, kd.pin_fail_count, kd.pin_locked_until,
             kd.created_at, kd.last_active_at,
             ua.full_name AS created_by_name
      FROM dbo.KitchenDevices kd
      LEFT JOIN dbo.UserAccounts ua ON ua.user_id = kd.created_by
      ORDER BY kd.created_at DESC
    `);
    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('[kdsController] listDevices error:', err);
    return res.status(500).json({ success: false, message: 'Failed to list devices.' });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/admin/kds-devices
// Body: { device_name, pin, station_category_ids? }
// ─────────────────────────────────────────────────────────────
export const createDevice = async (req, res) => {
  const { device_name, pin, station_category_ids } = req.body ?? {};
  const adminId = req.user?.user_id;

  if (!device_name?.trim()) {
    return res.status(400).json({ success: false, message: 'device_name is required.' });
  }
  if (!pin || !/^\d{4,8}$/.test(String(pin))) {
    return res.status(400).json({ success: false, message: 'pin must be 4–8 digits.' });
  }

  // Validate station_category_ids if provided
  let categoryJson = null;
  if (station_category_ids !== undefined && station_category_ids !== null) {
    if (!Array.isArray(station_category_ids) || station_category_ids.some(n => !Number.isFinite(Number(n)))) {
      return res.status(400).json({ success: false, message: 'station_category_ids must be an array of integers.' });
    }
    categoryJson = JSON.stringify(station_category_ids.map(Number));
  }

  try {
    const hash = await bcrypt.hash(String(pin), 10);
    const pool = await getRawPool();
    const result = await pool.request()
      .input('name', sql.NVarChar(100), device_name.trim())
      .input('hash', sql.VarChar(255), hash)
      .input('categoryIds', sql.NVarChar(500), categoryJson)
      .input('adminId', sql.Int, adminId)
      .query(`
        INSERT INTO dbo.KitchenDevices (device_name, device_pin_hash, station_category_ids, created_by)
        OUTPUT inserted.device_id, inserted.device_name, inserted.is_active, inserted.created_at
        VALUES (@name, @hash, @categoryIds, @adminId)
      `);

    return res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('[kdsController] createDevice error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create device.' });
  }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/admin/kds-devices/:id
// Body: { device_name?, pin?, station_category_ids?, is_active? }
// ─────────────────────────────────────────────────────────────
export const updateDevice = async (req, res) => {
  const deviceId = parseInt(req.params.id, 10);
  if (!Number.isFinite(deviceId)) {
    return res.status(400).json({ success: false, message: 'Invalid device ID.' });
  }

  const { device_name, pin, station_category_ids, is_active } = req.body ?? {};
  const updates = [];
  const request = (await getRawPool()).request().input('deviceId', sql.Int, deviceId);

  if (device_name !== undefined) {
    updates.push('device_name = @name');
    request.input('name', sql.NVarChar(100), device_name.trim());
  }
  if (pin !== undefined) {
    if (!/^\d{4,8}$/.test(String(pin))) {
      return res.status(400).json({ success: false, message: 'pin must be 4–8 digits.' });
    }
    const hash = await bcrypt.hash(String(pin), 10);
    updates.push('device_pin_hash = @hash, pin_fail_count = 0, pin_locked_until = NULL');
    request.input('hash', sql.VarChar(255), hash);
  }
  if (station_category_ids !== undefined) {
    const categoryJson = station_category_ids === null
      ? null
      : JSON.stringify(station_category_ids.map(Number));
    updates.push('station_category_ids = @categoryIds');
    request.input('categoryIds', sql.NVarChar(500), categoryJson);
  }
  if (is_active !== undefined) {
    updates.push('is_active = @isActive');
    request.input('isActive', sql.Bit, is_active ? 1 : 0);
  }

  if (updates.length === 0) {
    return res.status(400).json({ success: false, message: 'No fields to update.' });
  }

  try {
    const result = await request.query(`
      UPDATE dbo.KitchenDevices
      SET ${updates.join(', ')}
      OUTPUT inserted.device_id, inserted.device_name, inserted.is_active
      WHERE device_id = @deviceId
    `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }
    return res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('[kdsController] updateDevice error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update device.' });
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/admin/kds-devices/:id  (soft-delete)
// ─────────────────────────────────────────────────────────────
export const deleteDevice = async (req, res) => {
  const deviceId = parseInt(req.params.id, 10);
  if (!Number.isFinite(deviceId)) {
    return res.status(400).json({ success: false, message: 'Invalid device ID.' });
  }

  try {
    const pool = await getRawPool();
    const result = await pool.request()
      .input('deviceId', sql.Int, deviceId)
      .query(`
        UPDATE dbo.KitchenDevices
        SET is_active = 0
        OUTPUT inserted.device_id
        WHERE device_id = @deviceId AND is_active = 1
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Device not found or already inactive.' });
    }
    // Real-time effect: next request by this device's token will be rejected by requireKdsDevice
    return res.json({ success: true, message: 'Device deactivated. Any active sessions will be terminated on next request.' });
  } catch (err) {
    console.error('[kdsController] deleteDevice error:', err);
    return res.status(500).json({ success: false, message: 'Failed to deactivate device.' });
  }
};
