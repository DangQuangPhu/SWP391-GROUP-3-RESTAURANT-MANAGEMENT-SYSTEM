import http from 'http';

function makeRequest(payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const options = {
      hostname: 'localhost',
      port: 5001,
      path: '/api/reservations/pre-save',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log("=== RUNNING 30% DEPOSIT / 70% REMAINING PAYMENT TESTS ===");

  try {
    // Scenario 1: Only Table Reservation (No preorder, no voucher)
    console.log("\nScenario 1: Only Table Reservation (No preorder, no voucher)");
    const res1 = await makeRequest({
      guest_count: 2,
      reservation_start_at: "2026-06-23T19:00:00",
      durationMinutes: 30,
      table_ids: [1]
    });
    console.log("Status:", res1.status);
    console.log("Data:", res1.data);
    if (res1.data && res1.data.success) {
      const { deposit_amount, final_total } = res1.data;
      console.log(`Calculated Deposit: ${deposit_amount} (Expected: 6000)`);
      console.log(`Calculated Final: ${final_total} (Expected: 14000)`);
      if (Number(deposit_amount) === 6000 && Number(final_total) === 14000) {
        console.log("✅ Scenario 1 Passed!");
      } else {
        console.log("❌ Scenario 1 Failed! Math mismatch.");
      }
    } else {
      console.log("❌ Scenario 1 Failed!", res1.body || res1.data);
    }

    // Scenario 2: Table Reservation + Preorder Food (No Voucher)
    // We assume dish_id 1 is a valid dish in the DB (like steak or drink). Let's request it.
    console.log("\nScenario 2: Table Reservation + Preorder Food (No Voucher)");
    const res2 = await makeRequest({
      guest_count: 2,
      reservation_start_at: "2026-06-23T19:00:00",
      durationMinutes: 30,
      table_ids: [1],
      preorder_items: [
        { dish_id: 1, quantity: 1 } // Let's check dish_id 1 price
      ]
    });
    console.log("Status:", res2.status);
    console.log("Data:", res2.data);
    if (res2.data && res2.data.success) {
      const { items_total, deposit_amount, final_total } = res2.data;
      const netTotal = 20000 + Number(items_total);
      const expectedDeposit = Math.round(netTotal * 0.3);
      const expectedFinal = netTotal - expectedDeposit;
      console.log(`Items Total: ${items_total}`);
      console.log(`Calculated Deposit: ${deposit_amount} (Expected: ${expectedDeposit})`);
      console.log(`Calculated Final: ${final_total} (Expected: ${expectedFinal})`);
      if (Number(deposit_amount) === expectedDeposit && Number(final_total) === expectedFinal) {
        console.log("✅ Scenario 2 Passed!");
      } else {
        console.log("❌ Scenario 2 Failed! Math mismatch.");
      }
    } else {
      console.log("❌ Scenario 2 Failed!", res2.body || res2.data);
    }

    // Scenario 3: Table Reservation + Preorder Food + Voucher (WEEKEND10)
    console.log("\nScenario 3: Table Reservation + Preorder Food + WEEKEND10");
    const res3 = await makeRequest({
      guest_count: 2,
      reservation_start_at: "2026-06-23T19:00:00",
      durationMinutes: 30,
      table_ids: [1],
      preorder_items: [
        { dish_id: 1, quantity: 1 }
      ],
      promo_code: "WEEKEND10"
    });
    console.log("Status:", res3.status);
    console.log("Data:", res3.data);
    if (res3.data && res3.data.success) {
      const { items_total, discount_amount, deposit_amount, final_total } = res3.data;
      const expectedDiscount = Math.round(Number(items_total) * 0.1);
      const netTotal = 20000 + Math.max(0, Number(items_total) - expectedDiscount);
      const expectedDeposit = Math.round(netTotal * 0.3);
      const expectedFinal = netTotal - expectedDeposit;
      console.log(`Items Total: ${items_total}`);
      console.log(`Calculated Discount: ${discount_amount} (Expected: ${expectedDiscount})`);
      console.log(`Calculated Deposit: ${deposit_amount} (Expected: ${expectedDeposit})`);
      console.log(`Calculated Final: ${final_total} (Expected: ${expectedFinal})`);
      if (Number(discount_amount) === expectedDiscount && Number(deposit_amount) === expectedDeposit && Number(final_total) === expectedFinal) {
        console.log("✅ Scenario 3 Passed!");
      } else {
        console.log("❌ Scenario 3 Failed! Math/Discount mismatch.");
      }
    } else {
      console.log("❌ Scenario 3 Failed!", res3.body || res3.data);
    }

  } catch (err) {
    console.error("Test execution failed:", err);
  }
}

runTests();
