#!/usr/bin/env node

const API_BASE = process.env.API_BASE || "http://localhost:5173/api";
const reservationId = process.env.TEST_RESERVATION_ID;
const userId = process.env.TEST_USER_ID;

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(userId ? { "x-user-id": userId } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });
  const contentType = res.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await res.json() : await res.text();
  return { res, body };
}

function assertOk(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function testMenuAndDishImages() {
  const { res, body } = await request("/menu");
  assertOk(res.ok, `/api/menu failed with ${res.status}`);
  const dishes = Array.isArray(body?.data) ? body.data : [];
  assertOk(dishes.length > 0, "/api/menu returned no dishes");

  const imageCandidates = dishes
    .filter((dish) => dish?.dish_id)
    .slice(0, 5);

  for (const dish of imageCandidates) {
    const image = await fetch(`${API_BASE}/dishes/${dish.dish_id}/image`);
    assertOk(image.status !== 404, `/api/dishes/${dish.dish_id}/image returned 404`);
  }

  return `checked ${dishes.length} menu dishes and ${imageCandidates.length} image endpoints`;
}

async function testAvailabilityDoesNotNeedTableFirst() {
  const today = new Date().toISOString().slice(0, 10);
  const { res, body } = await request(`/reservations/availability?date=${today}&time=17:00&guests=2`);
  assertOk(res.ok, `/api/reservations/availability failed with ${res.status}`);
  assertOk(body?.success !== false, "availability returned success=false");
  return "availability can be queried before a specific table is selected";
}

async function testRequestEditFlow() {
  if (!reservationId || !userId) {
    return "skipped request-edit; set TEST_RESERVATION_ID and TEST_USER_ID to run it";
  }

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  tomorrow.setHours(19, 0, 0, 0);
  const end = new Date(tomorrow.getTime() + 90 * 60 * 1000);

  const payload = {
    changes: {
      reservation_start_at: tomorrow.toISOString(),
      reservation_end_at: end.toISOString(),
      guest_count: 2,
      special_request: "Automated request flow test",
    },
  };

  const { res, body } = await request(`/reservations/${reservationId}/request-edit`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  assertOk(res.status !== 404, "request-edit route returned 404");
  assertOk(res.status !== 500, `request-edit returned 500: ${JSON.stringify(body)}`);
  assertOk(body?.success === true || body?.code === "REQUEST_ALREADY_PENDING" || body?.code === "EDIT_LIMIT_REACHED", `unexpected request-edit response: ${JSON.stringify(body)}`);
  return `request-edit route responded with ${body?.code || "success"}`;
}

async function main() {
  const tests = [
    ["menu and dish images", testMenuAndDishImages],
    ["availability without table", testAvailabilityDoesNotNeedTableFirst],
    ["request-edit pending flow", testRequestEditFlow],
  ];

  const results = [];
  for (const [name, fn] of tests) {
    try {
      const detail = await fn();
      results.push({ name, ok: true, detail });
    } catch (error) {
      results.push({ name, ok: false, detail: error.message });
    }
  }

  for (const result of results) {
    const marker = result.ok ? "PASS" : "FAIL";
    console.log(`${marker} ${result.name}: ${result.detail}`);
  }

  if (results.some((result) => !result.ok)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
