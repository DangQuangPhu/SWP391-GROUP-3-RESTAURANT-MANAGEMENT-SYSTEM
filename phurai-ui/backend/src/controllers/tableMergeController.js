import sql from "mssql";
import { getRawPool } from "../db.js";

// Helper to get socket io
function getIo(req) {
  return req.app.get("io");
}

export async function mergeTables(req, res) {
  const { source_table_id, target_table_id } = req.body;
  const userId = req.user?.userId || req.user?.id || null;
  const userName = req.user?.full_name || req.user?.username || "Staff";
  
  if (!source_table_id || !target_table_id || source_table_id === target_table_id) {
    return res.status(400).json({ success: false, message: "Invalid source or target table." });
  }

  const pool = await getRawPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // 1. Fetch both tables
    const reqGet = new sql.Request(transaction);
    reqGet.input("sourceId", sql.SmallInt, source_table_id);
    reqGet.input("targetId", sql.SmallInt, target_table_id);
    const tablesResult = await reqGet.query(`
      SELECT t.table_id, t.area_id, t.table_status, t.is_counter, t.merged_into_table_id, t.table_number, a.area_name
      FROM dbo.RestaurantTables t WITH (UPDLOCK, ROWLOCK)
      JOIN dbo.RestaurantAreas a ON t.area_id = a.area_id
      WHERE t.table_id IN (@sourceId, @targetId);
    `);

    const tables = tablesResult.recordset;
    if (tables.length !== 2) {
      throw new Error("One or both tables not found.");
    }

    const source = tables.find(t => t.table_id === source_table_id);
    const target = tables.find(t => t.table_id === target_table_id);

    // 2. Business Rules Validation
    if (source.area_id !== target.area_id) {
      throw new Error("Tables must be in the exact same area to merge.");
    }
    if (source.is_counter || target.is_counter) {
      throw new Error("Counter seats cannot be merged.");
    }

    const allowedStatuses = ['Available', 'Occupied'];
    if (!allowedStatuses.includes(source.table_status)) {
      throw new Error(`Cannot merge: table ${source.table_number} is currently ${source.table_status}`);
    }
    if (!allowedStatuses.includes(target.table_status)) {
      throw new Error(`Cannot merge: table ${target.table_number} is currently ${target.table_status}`);
    }

    // No double-merge check
    if (source.merged_into_table_id !== null) {
      throw new Error(`Cannot merge: table ${source.table_number} is already part of another merge.`);
    }
    if (target.merged_into_table_id !== null) {
      throw new Error(`Cannot merge: table ${target.table_number} is already part of another merge.`);
    }

    // Check if either table is already a parent
    const reqCheckParent = new sql.Request(transaction);
    reqCheckParent.input("sourceId", sql.SmallInt, source.table_id);
    reqCheckParent.input("targetId", sql.SmallInt, target.table_id);
    const parentCheck = await reqCheckParent.query(`
      SELECT COUNT(*) as count FROM dbo.RestaurantTables
      WHERE merged_into_table_id IN (@sourceId, @targetId)
    `);
    if (parentCheck.recordset[0].count > 0) {
      throw new Error("Cannot merge: one of the tables is already a parent table in another merge.");
    }

    // 4. Determine final status and reassign orders if necessary
    const sourceActive = source.table_status === 'Occupied';
    const targetActive = target.table_status === 'Occupied';

    if (sourceActive && targetActive) {
      throw new Error("Cannot merge two Occupied tables.");
    }

    const finalStatus = sourceActive ? source.table_status : target.table_status;

    if (sourceActive && !targetActive) {
      // Reassign Orders from source to target
      const reqOrders = new sql.Request(transaction);
      reqOrders.input("sourceId", sql.SmallInt, source.table_id);
      reqOrders.input("targetId", sql.SmallInt, target.table_id);
      await reqOrders.query(`
        UPDATE dbo.Orders
        SET table_id = @targetId
        WHERE table_id = @sourceId AND order_status NOT IN (N'Paid', N'Cancelled');
        
        UPDATE dbo.QROrderSessions
        SET table_id = @targetId
        WHERE table_id = @sourceId AND session_status = N'Active';
      `);
    }

    // 5. Update source table (merge into target)
    const reqUpdateSource = new sql.Request(transaction);
    reqUpdateSource.input("sourceId", sql.SmallInt, source.table_id);
    reqUpdateSource.input("targetId", sql.SmallInt, target.table_id);
    await reqUpdateSource.query(`
      UPDATE dbo.RestaurantTables
      SET merged_into_table_id = @targetId, table_status = N'Inactive'
      WHERE table_id = @sourceId;
    `);

    // 6. Update target table status if needed
    if (finalStatus !== target.table_status) {
      const reqUpdateTarget = new sql.Request(transaction);
      reqUpdateTarget.input("targetId", sql.SmallInt, target.table_id);
      reqUpdateTarget.input("status", sql.NVarChar(20), finalStatus);
      await reqUpdateTarget.query(`
        UPDATE dbo.RestaurantTables
        SET table_status = @status
        WHERE table_id = @targetId;
      `);
    }

    // 7. Insert AuditLog
    const reqAudit = new sql.Request(transaction);
    reqAudit.input("userId", sql.Int, userId);
    reqAudit.input("targetId", sql.Int, target.table_id);
    reqAudit.input("newVal", sql.NVarChar, JSON.stringify({ action: "merge", child: source.table_id, child_number: source.table_number }));
    await reqAudit.query(`
      INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, target_id, new_value_json)
      VALUES (@userId, 'STAFF_MERGE_TABLES', 'RestaurantTables', @targetId, @newVal);
    `);

    await transaction.commit();

    const io = getIo(req);
    if (io) {
      io.to("room:manager").to("room:staff").emit("table:sync", { action: "merge", source_table_id, target_table_id: target.table_id });
      
      io.to("room:manager").emit("table:merged", {
        parent_table_id: target.table_id,
        parent_table_number: target.table_number,
        child_table_id: source.table_id,
        child_table_number: source.table_number,
        area_name: source.area_name,
        staff_name: userName,
        merged_at: new Date().toISOString()
      });
    }

    return res.json({ success: true, message: "Tables merged successfully." });
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error("Merge error:", error);
    return res.status(400).json({ success: false, message: error.message || "Failed to merge tables." });
  }
}

export async function unmergeTable(req, res) {
  const { table_id } = req.body;

  if (!table_id) {
    return res.status(400).json({ success: false, message: "table_id is required." });
  }

  const pool = await getRawPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // 1. Fetch table and its children
    const reqGet = new sql.Request(transaction);
    reqGet.input("tableId", sql.SmallInt, table_id);
    const tablesResult = await reqGet.query(`
      SELECT table_id, table_status, merged_into_table_id
      FROM dbo.RestaurantTables WITH (UPDLOCK, ROWLOCK)
      WHERE table_id = @tableId OR merged_into_table_id = @tableId;
    `);

    const tables = tablesResult.recordset;
    const parent = tables.find(t => t.table_id === table_id);
    const children = tables.filter(t => t.merged_into_table_id === table_id);

    if (!parent) {
      throw new Error("Table not found.");
    }
    if (children.length === 0) {
      throw new Error("Table is not merged with any others.");
    }

    // 2. Unmerge: Parent keeps active status/orders. Children revert to Cleaning (or Available if Parent is Available).
    let childStatus = 'Cleaning';
    if (parent.table_status === 'Available') {
      childStatus = 'Available';
    }

    const reqUpdate = new sql.Request(transaction);
    reqUpdate.input("parentId", sql.SmallInt, table_id);
    reqUpdate.input("childStatus", sql.NVarChar(20), childStatus);
    await reqUpdate.query(`
      UPDATE dbo.RestaurantTables
      SET merged_into_table_id = NULL, table_status = @childStatus
      WHERE merged_into_table_id = @parentId;
    `);

    // 3. Insert AuditLog
    const reqAudit = new sql.Request(transaction);
    reqAudit.input("userId", sql.Int, req.user?.userId || req.user?.id || null);
    reqAudit.input("targetId", sql.Int, parent.table_id);
    reqAudit.input("newVal", sql.NVarChar, JSON.stringify({ action: "unmerge" }));
    await reqAudit.query(`
      INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, target_id, new_value_json)
      VALUES (@userId, 'STAFF_UNMERGE_TABLES', 'RestaurantTables', @targetId, @newVal);
    `);

    await transaction.commit();

    const io = getIo(req);
    if (io) {
      io.to("room:manager").to("room:staff").emit("table:sync", { action: "unmerge", parent_table_id: table_id });
    }

    return res.json({ success: true, message: "Tables separated successfully." });
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error("Unmerge error:", error);
    return res.status(400).json({ success: false, message: error.message || "Failed to unmerge tables." });
  }
}

export async function getTableTimeline(req, res) {
  const tableId = req.params.tableId || req.params.id;

  if (!tableId) {
    return res.status(400).json({ success: false, message: "tableId is required." });
  }

  try {
    const pool = await getRawPool();
    const result = await pool.request()
      .input("tableId", sql.Int, tableId)
      .query(`
        SELECT al.audit_log_id as audit_id, al.action_name, al.created_at, u.full_name, u.email as username
        FROM dbo.AuditLogs al
        LEFT JOIN dbo.UserAccounts u ON al.user_id = u.user_id
        WHERE al.target_table = 'RestaurantTables' 
          AND al.target_id = @tableId
          AND al.action_name IN ('STAFF_MERGE_TABLES', 'STAFF_UNMERGE_TABLES', 'SYSTEM_AUTO_UNMERGE_ON_CLEAR')
        ORDER BY al.created_at DESC
      `);

    return res.json({ success: true, timeline: result.recordset });
  } catch (error) {
    console.error("Timeline error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch timeline." });
  }
}

import * as db from '../repositories/paymentRepository.js';

export async function verifyClearTable(req, res) {
  try {
    const parentTableId = Number(req.params.tableId);
    const { order_id } = req.body;
    const staff_id = req.user?.userId || req.user?.id || null;

    if (!order_id) {
      return res.status(400).json({ success: false, message: 'order_id is required' });
    }

    const order = await db.getOrderById(order_id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    if (order.order_status !== 'Paid') {
      return res.status(400).json({ success: false, message: 'Order is not Paid yet' });
    }

    const { clearedTableIds } = await db.verifyAndClearTableTransaction({
      parentTableId,
      staffId: staff_id,
    });

    const io = getIo(req);
    if (io && clearedTableIds && clearedTableIds.length > 0) {
      io.to('room:manager').emit('table:cleared', { tableIds: clearedTableIds });
      io.to('room:staff').emit('table:cleared', { tableIds: clearedTableIds });
      // Emit sync to refresh the UI
      io.to('room:manager').to('room:staff').emit('table:sync', { action: 'verify_clear' });
    }

    return res.json({ success: true, clearedTableIds });
  } catch (err) {
    console.error('[verify-clear] error:', err);
    return res.status(500).json({ success: false, message: 'Internal error' });
  }
}

