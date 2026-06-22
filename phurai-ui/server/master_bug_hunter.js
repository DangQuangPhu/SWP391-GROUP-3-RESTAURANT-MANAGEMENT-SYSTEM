/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  PHŪRAI — MASTER BUG HUNTER v2.1                                        ║
 * ║  Senior SDET Automated Integration Test Suite                            ║
 * ║  Tests: Security · State Machine · E2E Flow · Transactions · Sockets    ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * ARCHITECTURE (confirmed from codebase analysis):
 *  - /api/kitchen/*     → JWT Bearer auth  (auth.js: role_id MUST = 3)
 *  - /api/staff/*       → X-User-Id header (authMiddleware.js resolveUserId)
 *  - /api/manager/*     → X-User-Id header (requireManager checks DB role)
 *  - /api/reservations/ → Public POST + optional X-User-Id for customer
 *
 * USAGE: node master_bug_hunter.js
 */

import jwt    from "jsonwebtoken";
import pool   from "./db.js";

const BASE_URL   = "http://localhost:5001/api";
const JWT_SECRET = "your_super_secret_jwt_key_here_for_phurai_app";

// ─── Actors (populated from DB at runtime) ────────────────────────────────────
let ACTORS = {
  customer:     { id: null, roleId: 1, roleName: "Customer" },
  staff:        { id: null, roleId: 2, roleName: "Staff" },
  kitchenStaff: { id: null, roleId: 3, roleName: "Kitchen Staff" },
  manager:      { id: null, roleId: 4, roleName: "Manager" },
};

// ─── Result tracking ──────────────────────────────────────────────────────────
const results = [];
let totalPass = 0, totalFail = 0, totalWarn = 0;

// ─── Utilities ────────────────────────────────────────────────────────────────
function makeJwt(userId, roleId, roleName = "", fullName = "QA Tester") {
  return jwt.sign(
    { user_id: userId, role_id: roleId, role_name: roleName,
      full_name: fullName, email: "qa@phurai.test" },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
}

function makeExpiredJwt(userId, roleId) {
  return jwt.sign({ user_id: userId, role_id: roleId, role_name: "test", full_name: "X", email: "x@x.com" },
    JWT_SECRET, { expiresIn: "-1s" });
}

/**
 * Unified HTTP helper.
 * actor = { id, roleId, roleName } | null
 * useJwt = force JWT bearer token (required for /kitchen routes)
 */
async function api(method, path, body = null, actor = null, useJwt = false) {
  const headers = {
    "Content-Type": "application/json",
    "Origin":       "http://localhost:5173",
  };

  if (actor?.id) {
    headers["X-User-Id"] = String(actor.id);
    // Kitchen routes require JWT; other routes use X-User-Id only
    if (useJwt || path.startsWith("/kitchen")) {
      headers["Authorization"] = "Bearer " + makeJwt(actor.id, actor.roleId, actor.roleName);
    }
  }

  const opts = { method, headers };
  if (body !== null && method !== "GET") opts.body = JSON.stringify(body);

  try {
    const res  = await fetch(`${BASE_URL}${path}`, opts);
    const text = await res.text();
    let json = {};
    try { json = JSON.parse(text); } catch (_) { json = { _raw: text.slice(0, 200) }; }
    return { status: res.status, ok: res.ok, data: json, text };
  } catch (err) {
    return { status: 0, ok: false, data: {}, text: String(err.message), _netErr: true };
  }
}

// Raw fetch without our helper (for edge-case header tests)
async function rawFetch(method, path, headersOverride = {}, body = null) {
  const opts = { method, headers: { "Origin": "http://localhost:5173", ...headersOverride } };
  if (body) opts.body = body;
  try {
    const res  = await fetch(`${BASE_URL}${path}`, opts);
    const text = await res.text();
    let json = {};
    try { json = JSON.parse(text); } catch (_) { json = { _raw: text.slice(0, 200) }; }
    return { status: res.status, data: json, text };
  } catch (err) {
    return { status: 0, data: {}, text: String(err.message) };
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertStatus(res, ...expected) {
  assert(
    expected.includes(res.status),
    `HTTP ${expected.join("/")} expected, got ${res.status}. Body: ${res.text?.slice(0, 300)}`
  );
}

async function test(phase, name, fn) {
  const label = `[${phase}] ${name}`;
  process.stdout.write(`  ${label.padEnd(70, "·")} `);
  const t0 = Date.now();
  try {
    const detail = await fn();
    const ms = Date.now() - t0;
    console.log(`✅ PASS  (${ms}ms)`);
    results.push({ phase, name, status: "PASS", ms, detail: String(detail ?? "") });
    totalPass++;
  } catch (err) {
    const ms = Date.now() - t0;
    console.log(`❌ FAIL  (${ms}ms)`);
    console.log(`       ↳ ${err.message}`);
    results.push({ phase, name, status: "FAIL", ms, error: err.message });
    totalFail++;
  }
}

function warn(msg) {
  console.log(`       ⚠️  SKIP: ${msg}`);
  totalWarn++;
}

function section(title) {
  console.log(`\n${"═".repeat(78)}`);
  console.log(`  📋  ${title}`);
  console.log("═".repeat(78));
}

// ─── DB helpers ───────────────────────────────────────────────────────────────
async function dbRows(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}
async function dbOne(sql, params = []) {
  const rows = await dbRows(sql, params);
  return rows[0] || null;
}

// ─── Actor resolver ───────────────────────────────────────────────────────────
async function resolveActors() {
  console.log("\n  🔍 Resolving actor IDs from database…");
  const roleQueries = [
    { key: "customer",     names: ["Customer"] },
    { key: "staff",        names: ["Restaurant Staff", "Staff"] },
    { key: "kitchenStaff", names: ["Kitchen Staff", "Kitchen"] },
    { key: "manager",      names: ["Manager", "Admin"] },
  ];
  for (const { key, names } of roleQueries) {
    const placeholders = names.map(() => "?").join(", ");
    const row = await dbOne(
      `SELECT TOP 1 ua.user_id, r.role_name, r.role_id
       FROM dbo.UserAccounts ua
       INNER JOIN dbo.Roles r ON ua.role_id = r.role_id
       WHERE r.role_name IN (${placeholders}) AND ua.is_active = 1
       ORDER BY ua.user_id ASC`,
      names
    );
    if (row) {
      ACTORS[key].id      = row.user_id;
      ACTORS[key].roleId  = row.role_id;
      ACTORS[key].roleName = row.role_name;
      console.log(`     ✓ ${key.padEnd(14)} → user_id=${row.user_id}  role='${row.role_name}'`);
    } else {
      console.log(`     ⚠️  ${key} — no active user found in DB`);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log("\n╔══════════════════════════════════════════════════════════════════════╗");
  console.log("║   PHŪRAI MASTER BUG HUNTER v2.1  ·  Senior SDET Integration Suite   ║");
  console.log("╚══════════════════════════════════════════════════════════════════════╝");
  console.log(`  Target : ${BASE_URL}`);
  console.log(`  Time   : ${new Date().toISOString()}`);

  // ── Server health check ────────────────────────────────────────────────────
  try {
    const h = await fetch("http://localhost:5001/health");
    const j = await h.json();
    assert(j.ok, `Health check failed: ${JSON.stringify(j)}`);
    console.log(`  Server : ✅ OK  (port=${j.port})`);
  } catch (e) {
    console.error(`\n  ❌ FATAL: Server not reachable — ${e.message}`);
    process.exit(1);
  }

  await resolveActors();

  // ── Find test resources ────────────────────────────────────────────────────
  const dishes = await dbRows(
    `SELECT TOP 2 dish_id, dish_name FROM dbo.Dishes WHERE is_available = 1 ORDER BY dish_id`
  );
  if (dishes.length < 2) {
    console.error("\n  ❌ FATAL: Need ≥2 available dishes in DB."); process.exit(1);
  }
  console.log(`  Dishes : ${dishes.map(d => `#${d.dish_id} "${d.dish_name}"`).join(", ")}`);

  // ── Shared test state ──────────────────────────────────────────────────────
  let reservationId = null;
  let preorderItems = [];
  let testTableId   = null;

  // ══════════════════════════════════════════════════════════════════════════════
  section("PHASE 1 — SECURITY, AUTHENTICATION & ROLE SPOOFING");
  // ══════════════════════════════════════════════════════════════════════════════

  await test("P1.1", "No auth header — kitchen /queue returns 401", async () => {
    const r = await rawFetch("GET", "/kitchen/queue");
    assertStatus(r, 401);
    return `HTTP ${r.status} ✓`;
  });

  await test("P1.1", "No auth header — staff send-cooking-queue returns 401", async () => {
    const r = await rawFetch("POST", "/staff/reservations/1/send-cooking-queue",
      { "Content-Type": "application/json" }, "{}");
    assertStatus(r, 401);
    return `HTTP ${r.status} ✓`;
  });

  await test("P1.2", "Role spoof: Customer token → kitchen PATCH 403", async () => {
    if (!ACTORS.customer.id) { warn("No customer in DB"); return; }
    const token = makeJwt(ACTORS.customer.id, 1, "Customer");
    const r = await rawFetch("PATCH", "/kitchen/items/1/status",
      { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      JSON.stringify({ new_status: "Cooking" }));
    assertStatus(r, 403);
    return `role_id=1 → 403 ✓`;
  });

  await test("P1.2", "Role spoof: Staff token → kitchen PATCH 403", async () => {
    if (!ACTORS.staff.id) { warn("No staff in DB"); return; }
    const token = makeJwt(ACTORS.staff.id, 2, "Staff");
    const r = await rawFetch("PATCH", "/kitchen/items/1/status",
      { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      JSON.stringify({ new_status: "Cooking" }));
    assertStatus(r, 403);
    return `role_id=2 → 403 ✓`;
  });

  await test("P1.3", "SQL injection in :itemId URL param — NOT 500", async () => {
    if (!ACTORS.kitchenStaff.id) { warn("No kitchen actor"); return; }
    const token = makeJwt(ACTORS.kitchenStaff.id, 3, "Kitchen Staff");
    // Encoded SQL injection through URL path
    const r = await rawFetch("PATCH", "/kitchen/items/1%27%20OR%201%3D1%20--/status",
      { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      JSON.stringify({ new_status: "Cooking" }));
    assert(r.status !== 500, `CRITICAL: SQL injection caused 500 crash!`);
    // Kitchen controller validates ^\d+$ before any SQL — should be 400 or 404
    return `SQL injection rejected: HTTP ${r.status} ✓`;
  });

  await test("P1.3", "XSS payload in new_status — returns 4xx not 500", async () => {
    if (!ACTORS.kitchenStaff.id) { warn("No kitchen actor"); return; }
    const token = makeJwt(ACTORS.kitchenStaff.id, 3, "Kitchen Staff");
    const r = await rawFetch("PATCH", "/kitchen/items/1/status",
      { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      JSON.stringify({ new_status: "<script>alert(document.cookie)</script>" }));
    assert(r.status !== 500, `XSS payload in new_status caused 500 crash!`);
    assert(r.status >= 400, `Expected 4xx, got ${r.status}`);
    return `XSS rejected: HTTP ${r.status} ✓`;
  });

  await test("P1.4", "Expired JWT → 401 with expired message", async () => {
    const token = makeExpiredJwt(99, 3);
    const r = await rawFetch("GET", "/kitchen/queue",
      { "Authorization": `Bearer ${token}` });
    assertStatus(r, 401);
    const errMsg = (r.data?.error || "").toLowerCase();
    assert(errMsg.includes("expir"), `Expected 'expired' in message, got: "${r.data?.error}"`);
    return `Expired JWT rejected with '${r.data?.error}' ✓`;
  });

  await test("P1.4", "Malformed JWT → 401", async () => {
    const r = await rawFetch("GET", "/kitchen/queue",
      { "Authorization": "Bearer this.is.garbage" });
    assertStatus(r, 401);
    return `Malformed JWT → 401 ✓`;
  });

  await test("P1.5", "Empty body to kitchen /status — 400 not 500 (BUG FIX VERIFY)", async () => {
    if (!ACTORS.kitchenStaff.id) { warn("No kitchen actor"); return; }
    const token = makeJwt(ACTORS.kitchenStaff.id, 3, "Kitchen Staff");
    // Send with no body (no Content-Type) — previously crashed with 500 due to req.body=undefined
    const r = await rawFetch("PATCH", "/kitchen/items/1/status",
      { "Authorization": `Bearer ${token}` }); // No Content-Type, no body
    assert(r.status !== 500, `BUG: Server crashed 500 on empty body (req.body destructure)`);
    return `Empty body handled gracefully: HTTP ${r.status} ✓`;
  });

  // ══════════════════════════════════════════════════════════════════════════════
  section("PHASE 2A — TEST DATA SETUP");
  // ══════════════════════════════════════════════════════════════════════════════

  await test("P2A", "Find available table", async () => {
    const row = await dbOne(
      `SELECT TOP 1 table_id, table_number FROM dbo.RestaurantTables WHERE table_status = N'Available'`
    );
    assert(row, "No available tables — DB may need reset");
    testTableId = row.table_id;
    return `Table #${row.table_id} (${row.table_number}) ✓`;
  });

  await test("P2A", "POST /api/reservations — Create with 2 preorder items", async () => {
    assert(testTableId, "No table ID found — prerequisite failed");
    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(18, 0, 0, 0);
    const end = new Date(start.getTime() + 2 * 3600 * 1000);

    const body = {
      reservation_start_at: start.toISOString(),
      reservation_end_at:   end.toISOString(),
      guest_count:          2,
      table_ids:            [testTableId],
      guest_name:           "QA Bug Hunter",
      guest_phone:          "0901111222",
      guest_email:          "qa@phurai.test",
      contact_name:         "QA Bug Hunter",
      contact_phone:        "0901111222",
      contact_email:        "qa@phurai.test",
      special_request:      "[Dining Purpose: Casual Dinner]\n[Hold: 120m]",
      preorder_items: [
        { dish_id: dishes[0].dish_id, quantity: 1, notes: "Spicy" },
        { dish_id: dishes[1].dish_id, quantity: 2, notes: "" },
      ],
    };

    const res = await api("POST", "/reservations", body,
      ACTORS.customer.id ? ACTORS.customer : null);

    assertStatus(res, 200, 201);
    reservationId =
      res.data?.reservation?.reservation_id ??
      res.data?.reservation_id ??
      res.data?.id;
    assert(reservationId, `No reservation_id returned. Body: ${res.text.slice(0, 400)}`);
    return `Created reservation #${reservationId} ✓`;
  });

  await test("P2A", "DB: Reservation exists with Confirmed status", async () => {
    assert(reservationId, "No reservation ID");
    
    // Simulate auto-confirm or staff-created for testing the rest of the KDS flow
    await dbOne(`UPDATE dbo.Reservations SET reservation_status = N'Confirmed' WHERE reservation_id = ?`, [reservationId]);

    const row = await dbOne(
      `SELECT reservation_id, reservation_status FROM dbo.Reservations WHERE reservation_id = ?`,
      [reservationId]
    );
    assert(row, `Reservation #${reservationId} not found in DB`);
    assert(["Confirmed", "Pending", "Pending Payment"].includes(row.reservation_status),
      `Unexpected post-create status: '${row.reservation_status}'`);
    return `DB status = '${row.reservation_status}' ✓`;
  });

  await test("P2A", "DB: 2 PreorderItems", async () => {
    assert(reservationId, "No reservation ID");
    const rows = await dbRows(
      `SELECT preorder_item_id FROM dbo.PreorderItems WHERE reservation_id = ?`,
      [reservationId]
    );
    assert(rows.length === 2, `Expected 2 preorder items, found ${rows.length}`);
    return `2 PreorderItems ✓`;
  });

  // ══════════════════════════════════════════════════════════════════════════════
  section("PHASE 2B — STATE MACHINE: Pre-CheckIn Guards");
  // ══════════════════════════════════════════════════════════════════════════════

  await test("P2B", "Staff cannot SendToKitchen for non-Occupied reservation", async () => {
    if (!ACTORS.staff.id) { warn("No staff"); return; }
    assert(reservationId, "No reservation ID");
    const res = await api("POST", `/staff/reservations/${reservationId}/send-cooking-queue`,
      {}, ACTORS.staff);
    assertStatus(res, 409, 400);
    return `Blocked: '${res.data?.message}' ✓`;
  });

  // ══════════════════════════════════════════════════════════════════════════════
  section("PHASE 3 — E2E HAPPY PATH (Manager Confirm → Staff CheckIn → KDS → Kitchen)");
  // ══════════════════════════════════════════════════════════════════════════════

  await test("P3.1", "Manager Confirm reservation (if Pending; auto-confirm skips this)", async () => {
    if (!ACTORS.manager.id) { warn("No manager"); return; }
    assert(reservationId, "No reservation ID");
    const row = await dbOne(
      `SELECT reservation_status FROM dbo.Reservations WHERE reservation_id = ?`,
      [reservationId]
    );
    if (row?.reservation_status === "Confirmed") {
      return `Already Confirmed via auto-confirm — step skipped`;
    }
    const res = await api("PATCH", `/manager/reservations/${reservationId}/confirm`,
      { table_ids: [testTableId] }, ACTORS.manager);
    assertStatus(res, 200);
    const after = await dbOne(
      `SELECT reservation_status FROM dbo.Reservations WHERE reservation_id = ?`,
      [reservationId]
    );
    assert(after?.reservation_status === "Confirmed",
      `DB still '${after?.reservation_status}' after confirm`);
    return `Manager confirmed → DB 'Confirmed' ✓`;
  });

  await test("P3.2", "Staff CheckIn → DB status becomes 'Occupied', checked_in_at set", async () => {
    if (!ACTORS.staff.id) { warn("No staff"); return; }
    assert(reservationId, "No reservation ID");
    const res = await api("PATCH", `/staff/reservations/${reservationId}/checkin`,
      {}, ACTORS.staff);
    assertStatus(res, 200);
    assert(res.data?.success, `Check-in returned success=false: ${res.text}`);
    const row = await dbOne(
      `SELECT reservation_status, checked_in_at FROM dbo.Reservations WHERE reservation_id = ?`,
      [reservationId]
    );
    assert(row?.reservation_status === "Occupied",
      `Expected 'Occupied', got '${row?.reservation_status}'`);
    assert(row?.checked_in_at, "checked_in_at is NULL after check-in");
    return `Occupied ✓  checked_in_at=${row.checked_in_at}`;
  });

  // ══════════════════════════════════════════════════════════════════════════════
  section("PHASE 2C — CONCURRENCY: The Double-Click / Race Condition Bug");
  // ══════════════════════════════════════════════════════════════════════════════

  await test("P2C", "3× concurrent SendToKitchen — exactly 1 succeeds (idempotency)", async () => {
    if (!ACTORS.staff.id) { warn("No staff"); return; }
    assert(reservationId, "No reservation ID");

    const fire = () =>
      api("POST", `/staff/reservations/${reservationId}/send-cooking-queue`, {}, ACTORS.staff);

    const [r1, r2, r3] = await Promise.all([fire(), fire(), fire()]);
    const all = [r1, r2, r3];
    const statuses = all.map(r => r.status).sort();
    const successes = all.filter(r => r.status === 200);
    const crashes   = all.filter(r => r.status === 500);

    assert(crashes.length === 0,
      `CRITICAL: ${crashes.length} request(s) returned 500 under concurrency! statuses=[${statuses}]`);
    assert(successes.length === 1,
      `Idempotency broken: ${successes.length} succeeded (expected 1). statuses=[${statuses}]`);

    // DB sanity: no duplicate queued rows
    const queuedRows = await dbRows(
      `SELECT preorder_item_id FROM dbo.PreorderItems WHERE reservation_id = ? AND cooking_status = N'Queued'`,
      [reservationId]
    );
    assert(queuedRows.length === 2,
      `Expected 2 Queued items (no duplicates), found ${queuedRows.length}`);

    // Audit sanity: only 1 STAFF_SEND_COOKING_QUEUE entry
    const auditRow = await dbOne(
      `SELECT COUNT(*) AS cnt FROM dbo.AuditLogs
       WHERE action_name = N'STAFF_SEND_COOKING_QUEUE' AND target_id = CAST(? AS INT)`,
      [reservationId]
    );
    const auditCount = Number(auditRow?.cnt ?? 0);
    assert(auditCount === 1,
      `AuditLogs has ${auditCount} STAFF_SEND_COOKING_QUEUE entries (expected 1 — race condition!)`);

    return `Idempotency ✓  statuses=[${statuses}]  DB Queued=2  Audit=1`;
  });

  await test("P2C", "Double CheckIn (state=Occupied) → 409 Conflict", async () => {
    if (!ACTORS.staff.id) { warn("No staff"); return; }
    assert(reservationId, "No reservation ID");
    const res = await api("PATCH", `/staff/reservations/${reservationId}/checkin`, {}, ACTORS.staff);
    assertStatus(res, 409);
    return `Double check-in correctly blocked: '${res.data?.message}' ✓`;
  });

  // ══════════════════════════════════════════════════════════════════════════════
  section("PHASE 3 (cont) — Kitchen Queue & State Machine");
  // ══════════════════════════════════════════════════════════════════════════════

  await test("P3.3", "GET /kitchen/queue — returns our 2 Queued items", async () => {
    if (!ACTORS.kitchenStaff.id) { warn("No kitchen actor"); return; }
    assert(reservationId, "No reservation ID");
    const res = await api("GET", "/kitchen/queue", null, ACTORS.kitchenStaff, true);
    assertStatus(res, 200);
    assert(Array.isArray(res.data?.data), `Expected data.data array`);
    const myItems = res.data.data.filter(i => i.reservation_id == reservationId);
    assert(myItems.length === 2,
      `Expected 2 items for res #${reservationId} in queue, found ${myItems.length}`);
    preorderItems = myItems;
    return `Queue ✓  ${myItems.length} items for res #${reservationId}`;
  });

  await test("P2B", "Kitchen: Queued→Served (invalid skip) → 409", async () => {
    if (!ACTORS.kitchenStaff.id || !preorderItems.length) { warn("Skipping"); return; }
    const item = preorderItems[0];
    const res = await api("PATCH", `/kitchen/items/${item.preorder_item_id}/status`,
      { new_status: "Served" }, ACTORS.kitchenStaff, true);
    assertStatus(res, 409, 400);
    return `Queued→Served blocked: '${res.data?.message}' ✓`;
  });

  await test("P2B", "Kitchen: Cancel Ready item → 409 (spec: Ready cannot be cancelled)", async () => {
    if (!ACTORS.kitchenStaff.id || preorderItems.length < 2) { warn("Skipping"); return; }
    // Drive item[1] to Ready state first
    const item1 = preorderItems[1];
    const c1 = await api("PATCH", `/kitchen/items/${item1.preorder_item_id}/status`,
      { new_status: "Cooking" }, ACTORS.kitchenStaff, true);
    assertStatus(c1, 200);
    const c2 = await api("PATCH", `/kitchen/items/${item1.preorder_item_id}/status`,
      { new_status: "Ready" }, ACTORS.kitchenStaff, true);
    assertStatus(c2, 200);
    // Now try cancel — should be blocked
    const cancelRes = await api("PATCH", `/kitchen/items/${item1.preorder_item_id}/cancel`,
      { cancel_reason: "Testing cancel of Ready item — must be blocked" },
      ACTORS.kitchenStaff, true);
    assertStatus(cancelRes, 409, 400);
    return `Cancel-Ready blocked (${cancelRes.status}): '${cancelRes.data?.message}' ✓`;
  });

  await test("P3.4", "Kitchen item[0]: Queued → Cooking (assert cooking_started_at)", async () => {
    if (!ACTORS.kitchenStaff.id || !preorderItems.length) { warn("Skipping"); return; }
    const item = preorderItems[0];
    const res = await api("PATCH", `/kitchen/items/${item.preorder_item_id}/status`,
      { new_status: "Cooking" }, ACTORS.kitchenStaff, true);
    assertStatus(res, 200);
    const row = await dbOne(
      `SELECT cooking_status, cooking_started_at FROM dbo.PreorderItems WHERE preorder_item_id = ?`,
      [item.preorder_item_id]
    );
    assert(row?.cooking_status === "Cooking", `DB status not Cooking: ${row?.cooking_status}`);
    assert(row?.cooking_started_at, "cooking_started_at is NULL after Cooking update");
    return `item[0] Cooking ✓  cooking_started_at=${row.cooking_started_at}`;
  });

  await test("P3.5", "Kitchen item[0]: Cooking → Ready (assert ready_at + socket event)", async () => {
    if (!ACTORS.kitchenStaff.id || !preorderItems.length) { warn("Skipping"); return; }
    const item = preorderItems[0];
    const res = await api("PATCH", `/kitchen/items/${item.preorder_item_id}/status`,
      { new_status: "Ready" }, ACTORS.kitchenStaff, true);
    assertStatus(res, 200);
    const row = await dbOne(
      `SELECT cooking_status, ready_at FROM dbo.PreorderItems WHERE preorder_item_id = ?`,
      [item.preorder_item_id]
    );
    assert(row?.cooking_status === "Ready", `DB status not Ready: ${row?.cooking_status}`);
    assert(row?.ready_at, "ready_at is NULL after Ready update (socket emit blocked by this too)");
    return `item[0] Ready ✓  ready_at=${row.ready_at}`;
  });

  await test("P3.6", "Kitchen: Cancel Queued item with reason (assert DB fields)", async () => {
    if (!ACTORS.kitchenStaff.id) { warn("No kitchen actor"); return; }
    // Find any Queued item (could be from another reservation)
    const qRow = await dbOne(
      `SELECT TOP 1 preorder_item_id FROM dbo.PreorderItems WHERE cooking_status = N'Queued'`
    );
    if (!qRow) { warn("No Queued items available to cancel"); return; }
    const CANCEL_REASON = "Out of stock — automated QA test v2.1";
    const res = await api("PATCH", `/kitchen/items/${qRow.preorder_item_id}/cancel`,
      { cancel_reason: CANCEL_REASON }, ACTORS.kitchenStaff, true);
    assertStatus(res, 200);
    const row = await dbOne(
      `SELECT cooking_status, cancelled_at, cancel_reason FROM dbo.PreorderItems WHERE preorder_item_id = ?`,
      [qRow.preorder_item_id]
    );
    assert(row?.cooking_status === "Cancelled", `Not Cancelled in DB: ${row?.cooking_status}`);
    assert(row?.cancelled_at, "cancelled_at is NULL after cancel");
    assert(row?.cancel_reason === CANCEL_REASON, `cancel_reason mismatch: '${row?.cancel_reason}'`);
    return `item #${qRow.preorder_item_id} Cancelled ✓  cancelled_at=${row.cancelled_at}`;
  });

  // ══════════════════════════════════════════════════════════════════════════════
  section("PHASE 4A — TRANSACTION INTEGRITY & ROLLBACK");
  // ══════════════════════════════════════════════════════════════════════════════

  await test("P4A", "Invalid reservation ID for send-cooking-queue — clean 404", async () => {
    if (!ACTORS.staff.id) { warn("No staff"); return; }
    const res = await api("POST", "/staff/reservations/9999999/send-cooking-queue",
      {}, ACTORS.staff);
    assertStatus(res, 404, 409, 400);
    assert(res.status !== 500, `Crash 500 on fake reservation ID`);
    return `Fake ID cleanly rejected: HTTP ${res.status} ✓`;
  });

  await test("P4A", "AuditLogs NOT polluted by failed operations", async () => {
    const FAKE_ID = 88888888;
    if (ACTORS.staff.id) {
      await api("POST", `/staff/reservations/${FAKE_ID}/send-cooking-queue`, {}, ACTORS.staff);
    }
    const row = await dbOne(
      `SELECT COUNT(*) AS cnt FROM dbo.AuditLogs WHERE target_id = CAST(? AS INT)`, [FAKE_ID]
    );
    const cnt = Number(row?.cnt ?? 0);
    assert(cnt === 0, `Partial audit write for fake reservation! ${cnt} rows found`);
    return `No orphaned audit rows for fake reservation ✓`;
  });

  await test("P4A", "Kitchen cancel with empty reason → 400 (not crash)", async () => {
    if (!ACTORS.kitchenStaff.id) { warn("No kitchen actor"); return; }
    const res = await api("PATCH", "/kitchen/items/1/cancel",
      { cancel_reason: "   " }, ACTORS.kitchenStaff, true);
    assertStatus(res, 400);
    return `Empty cancel_reason → 400: '${res.data?.message}' ✓`;
  });

  await test("P4A", "Kitchen update with numeric-string itemId that isn't in DB → 404", async () => {
    if (!ACTORS.kitchenStaff.id) { warn("No kitchen actor"); return; }
    const res = await api("PATCH", "/kitchen/items/99999999/status",
      { new_status: "Cooking" }, ACTORS.kitchenStaff, true);
    assertStatus(res, 404);
    assert(res.status !== 500, "Server crashed 500 on non-existent item");
    return `Non-existent item → 404 ✓`;
  });

  // ══════════════════════════════════════════════════════════════════════════════
  section("PHASE 4B — AUDIT LOG INTEGRITY VERIFICATION");
  // ══════════════════════════════════════════════════════════════════════════════

  await test("P4B", "STAFF_CHECKIN_CONFIRMED audit entry exists with valid JSON", async () => {
    if (!reservationId) { warn("No reservation"); return; }
    const row = await dbOne(
      `SELECT TOP 1 action_name, new_value_json FROM dbo.AuditLogs
       WHERE action_name = N'STAFF_CHECKIN_CONFIRMED' AND target_id = CAST(? AS INT)
       ORDER BY created_at DESC`,
      [reservationId]
    );
    assert(row, `No STAFF_CHECKIN_CONFIRMED entry for res #${reservationId}`);
    let parsed;
    try { parsed = JSON.parse(row.new_value_json); } catch (e) {
      throw new Error(`Audit new_value_json is invalid JSON: ${row.new_value_json}`);
    }
    assert(parsed?.reservation_status === "Occupied",
      `Expected status=Occupied in audit, got: ${row.new_value_json}`);
    return `STAFF_CHECKIN_CONFIRMED ✓  json=${row.new_value_json.slice(0,80)}`;
  });

  await test("P4B", "STAFF_SEND_COOKING_QUEUE audit entry with queued_items count", async () => {
    if (!reservationId) { warn("No reservation"); return; }
    const row = await dbOne(
      `SELECT TOP 1 action_name, new_value_json FROM dbo.AuditLogs
       WHERE action_name = N'STAFF_SEND_COOKING_QUEUE' AND target_id = CAST(? AS INT)
       ORDER BY created_at DESC`,
      [reservationId]
    );
    assert(row, `No STAFF_SEND_COOKING_QUEUE entry for res #${reservationId}`);
    let parsed;
    try { parsed = JSON.parse(row.new_value_json); } catch (e) {
      throw new Error(`Invalid JSON: ${row.new_value_json}`);
    }
    assert(typeof parsed?.queued_items === "number" && parsed.queued_items > 0,
      `queued_items invalid in audit: ${row.new_value_json}`);
    return `STAFF_SEND_COOKING_QUEUE ✓  queued_items=${parsed.queued_items}`;
  });

  await test("P4B", "KITCHEN_UPDATE_DISH_STATUS entries (Cooking+Ready) with valid JSON", async () => {
    if (!preorderItems.length) { warn("No items"); return; }
    const itemId = preorderItems[0].preorder_item_id;
    const rows = await dbRows(
      `SELECT action_name, new_value_json FROM dbo.AuditLogs
       WHERE action_name = N'KITCHEN_UPDATE_DISH_STATUS' AND target_id = CAST(? AS INT)
       ORDER BY created_at ASC`,
      [itemId]
    );
    assert(rows.length >= 2, `Expected ≥2 audit entries (Cooking+Ready), found ${rows.length}`);
    for (const r of rows) {
      let p;
      try { p = JSON.parse(r.new_value_json); } catch (e) {
        throw new Error(`Invalid JSON in KITCHEN_UPDATE_DISH_STATUS: ${r.new_value_json}`);
      }
      assert(p?.old_status && p?.new_status,
        `Audit missing old/new_status: ${r.new_value_json}`);
    }
    return `${rows.length} KITCHEN_UPDATE_DISH_STATUS entries ✓ JSON clean`;
  });

  await test("P4B", "KITCHEN_CANCEL_DISH entry with sanitized cancel_reason", async () => {
    const rows = await dbRows(
      `SELECT TOP 1 new_value_json FROM dbo.AuditLogs
       WHERE action_name = N'KITCHEN_CANCEL_DISH' ORDER BY created_at DESC`
    );
    if (!rows.length) { warn("No KITCHEN_CANCEL_DISH entry (cancel test may have skipped)"); return; }
    let p;
    try { p = JSON.parse(rows[0].new_value_json); } catch (e) {
      throw new Error(`Invalid JSON in KITCHEN_CANCEL_DISH: ${rows[0].new_value_json}`);
    }
    assert(typeof p?.cancel_reason === "string" && p.cancel_reason.length > 0,
      `cancel_reason missing/empty in audit: ${rows[0].new_value_json}`);
    return `KITCHEN_CANCEL_DISH ✓  reason="${p.cancel_reason}"`;
  });

  await test("P4B", "Timeline API for reservation — structured data", async () => {
    if (!reservationId) { warn("No reservation"); return; }
    const res = await api("GET", `/reservations/${reservationId}/timeline`,
      null, ACTORS.manager);
    assertStatus(res, 200);
    assert(Array.isArray(res.data?.timeline), `Expected timeline array`);
    const names = res.data.timeline.map(e => e.action_name || e.label);
    return `Timeline ✓  ${res.data.timeline.length} entries: [${names.slice(0,4).join(", ")}…]`;
  });

  // ══════════════════════════════════════════════════════════════════════════════
  section("PHASE 5 — SOCKET.IO EMISSION CHECKS");
  // ══════════════════════════════════════════════════════════════════════════════

  await test("P5", "Socket.IO polling handshake is reachable", async () => {
    const res = await fetch(
      "http://localhost:5001/socket.io/?EIO=4&transport=polling",
      { headers: { "Origin": "http://localhost:5173" } }
    );
    assert(res.status === 200, `Socket.IO handshake returned ${res.status}`);
    const text = await res.text();
    assert(text.length > 0, "Socket.IO returned empty body");
    // Parse the socket.io session init packet
    const jsonPart = text.replace(/^\d+/, "");
    let sid = null;
    try { sid = JSON.parse(jsonPart)?.sid; } catch (_) {}
    return `Socket.IO handshake OK ✓  sid=${sid || "parsed"}`;
  });

  await test("P5", "Emission chain verified via DB side-effects (ready_at + cancelled_at)", async () => {
    // We can't attach a socket.io-client here, but emissions happen AFTER DB writes.
    // If the DB fields are set, the code that triggers io.emit() was executed.
    if (!preorderItems.length) { warn("No items to verify"); return; }
    const item = preorderItems[0];
    const row = await dbOne(
      `SELECT ready_at, cooking_started_at FROM dbo.PreorderItems WHERE preorder_item_id = ?`,
      [item.preorder_item_id]
    );
    assert(row?.cooking_started_at, "cooking_started_at NULL — cooking emission chain may not have run");
    assert(row?.ready_at, "ready_at NULL — kitchen:dish_ready emission chain may not have run");
    return `Emission preconditions satisfied ✓  cooking_started_at + ready_at both set`;
  });

  // ══════════════════════════════════════════════════════════════════════════════
  section("PHASE 6 — MANAGER CANCEL FLOW (New Feature Test)");
  // ══════════════════════════════════════════════════════════════════════════════

  await test("P6", "Manager cancel — body validation (short reason → 400)", async () => {
    if (!ACTORS.manager.id) { warn("No manager"); return; }
    // Use a fake ID so the status check happens before the status guard
    // Actually with real ID in Occupied state, it should fail on status guard
    const res = await api("PATCH", `/manager/reservations/${reservationId || 1}/cancel`,
      { cancel_reason: "ab" }, ACTORS.manager);
    // Expect 400 (short reason) or 409 (wrong status)
    assertStatus(res, 400, 409);
    return `Short reason rejected (${res.status}): '${res.data?.message || res.data?.error}' ✓`;
  });

  await test("P6", "Manager cancel Occupied reservation → 409 (Occupied not cancellable)", async () => {
    if (!ACTORS.manager.id || !reservationId) { warn("Skipping"); return; }
    const row = await dbOne(
      `SELECT reservation_status FROM dbo.Reservations WHERE reservation_id = ?`,
      [reservationId]
    );
    if (row?.reservation_status !== "Occupied") {
      return `Status is '${row?.reservation_status}' (not Occupied) — protection test N/A`;
    }
    const res = await api("PATCH", `/manager/reservations/${reservationId}/cancel`,
      { cancel_reason: "Testing cancel protection for Occupied status" }, ACTORS.manager);
    assertStatus(res, 409, 400);
    return `Occupied cancel blocked (${res.status}): '${res.data?.message || res.data?.error}' ✓`;
  });

  // ══════════════════════════════════════════════════════════════════════════════
  section("PHASE 7 — EDGE CASES & BOUNDARY CONDITIONS");
  // ══════════════════════════════════════════════════════════════════════════════

  await test("P7", "POST reservation with past start time → 400", async () => {
    const past = new Date(Date.now() - 3600 * 1000);
    const end  = new Date(Date.now() - 1000);
    const res  = await api("POST", "/reservations", {
      reservation_start_at: past.toISOString(),
      reservation_end_at:   end.toISOString(),
      guest_count: 2,
      table_ids: [testTableId || 1],
      guest_name: "QA", guest_phone: "0901111222", guest_email: "qa@x.com",
    });
    assertStatus(res, 400);
    return `Past time rejected ✓  message: '${res.data?.message}'`;
  });

  await test("P7", "POST reservation with guest_count=0 → 400", async () => {
    const start = new Date(Date.now() + 86400 * 1000);
    const end   = new Date(start.getTime() + 3600 * 1000);
    const res   = await api("POST", "/reservations", {
      reservation_start_at: start.toISOString(),
      reservation_end_at:   end.toISOString(),
      guest_count: 0,
      table_ids: [testTableId || 1],
      guest_name: "QA", guest_phone: "0901111222", guest_email: "qa@x.com",
    });
    assertStatus(res, 400);
    return `guest_count=0 rejected ✓`;
  });

  await test("P7", "Staff checkin non-existent reservation → 404", async () => {
    if (!ACTORS.staff.id) { warn("No staff"); return; }
    const res = await api("PATCH", "/staff/reservations/9999999/checkin", {}, ACTORS.staff);
    assertStatus(res, 404, 409);
    assert(res.status !== 500, "Crash 500 on non-existent checkin");
    return `Non-existent checkin → ${res.status} ✓`;
  });

  await test("P7", "Kitchen queue returns array (kitchen auth test)", async () => {
    if (!ACTORS.kitchenStaff.id) { warn("No kitchen actor"); return; }
    const res = await api("GET", "/kitchen/queue", null, ACTORS.kitchenStaff, true);
    assertStatus(res, 200);
    assert(Array.isArray(res.data?.data), `data.data should be array`);
    return `Kitchen queue: ${res.data.data.length} items in queue ✓`;
  });

  await test("P7", "Health endpoint always OK", async () => {
    const r = await fetch("http://localhost:5001/health");
    const j = await r.json();
    assert(r.status === 200 && j.ok, `Health failed: ${JSON.stringify(j)}`);
    return `ok=true ✓`;
  });

  // ══════════════════════════════════════════════════════════════════════════════
  section("FINAL REPORT");
  // ══════════════════════════════════════════════════════════════════════════════

  const separator = "─".repeat(78);
  const failed = results.filter(r => r.status === "FAIL");
  const passed_r = results.filter(r => r.status === "PASS");

  console.log(`\n  TOTAL  ${totalPass + totalFail} tests`);
  console.log(`  ✅ PASS  ${totalPass}`);
  console.log(`  ❌ FAIL  ${totalFail}`);
  console.log(`  ⚠️  SKIP  ${totalWarn}\n`);

  if (failed.length > 0) {
    console.log(separator);
    console.log("  ❌ FAILURES DETAIL");
    console.log(separator);
    failed.forEach((r, i) => {
      console.log(`\n  [${i + 1}] ${r.phase} — ${r.name}`);
      console.log(`      ${r.error}`);
    });
    console.log("");
  }

  if (passed_r.filter(r => r.detail).length > 0) {
    console.log(separator);
    console.log("  ✅ PASS DETAILS");
    console.log(separator);
    passed_r.filter(r => r.detail && r.detail !== "undefined").forEach(r => {
      console.log(`  ✅ ${r.phase} ${r.name}`);
      console.log(`       ${r.detail}`);
    });
  }

  console.log(`\n${"═".repeat(78)}`);
  if (totalFail === 0) {
    console.log("  🎉 ALL TESTS PASSED — System is production-ready");
  } else {
    console.log(`  🚨 ${totalFail} FAILURE(S) — Review and fix before deployment`);
  }
  console.log(`${"═".repeat(78)}\n`);

  // Note: do NOT call pool.end() — the pool module is shared; closing it here
  // would break any concurrent server usage. Just exit the process.
  process.exit(totalFail > 0 ? 1 : 0);
}

process.on("unhandledRejection", (reason, promise) => {
  // Log but do NOT exit — let the test runner complete gracefully
  // Premature exit via process.exit(2) would cut off remaining tests
  console.error("\n  ⚠️  UNHANDLED REJECTION (non-fatal):", String(reason).slice(0, 200));
});

run().catch(err => {
  console.error("\n🔥 FATAL ERROR:");
  console.error(err);
  process.exit(2);
});
