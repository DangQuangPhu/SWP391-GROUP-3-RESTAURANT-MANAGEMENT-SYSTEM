const http = require('http');

const API_BASE = 'http://localhost:5001/api/staff';

function fetchApi(path) {
  return new Promise((resolve, reject) => {
    http.get(`${API_BASE}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('--- STARTING API TESTS ---\n');

  try {
    // 1. Revenue Dashboard
    console.log('1. Testing Revenue Dashboard API (/reports/revenue)...');
    const revenueRes = await fetchApi('/reports/revenue');
    console.log(`Status: ${revenueRes.status}`);
    if (revenueRes.data && revenueRes.data.success) {
      console.log(`Data count: ${revenueRes.data.data.length} days of data`);
      if (revenueRes.data.data.length > 0) {
        console.log('Sample data:', revenueRes.data.data[0]);
      }
      console.log('✅ Revenue API OK\n');
    } else {
      console.log('❌ Revenue API Failed or returned error:', revenueRes.data);
    }

    // 2. Reservation Statistics (via /overview)
    console.log('2. Testing Reservation Statistics API (/overview)...');
    const overviewRes = await fetchApi('/overview');
    console.log(`Status: ${overviewRes.status}`);
    if (overviewRes.data && overviewRes.data.success) {
      const stats = overviewRes.data.data.reservationStats;
      console.log('Reservation Stats:', stats);
      console.log('✅ Reservation Statistics API OK\n');
    } else {
      console.log('❌ Reservation Statistics API Failed:', overviewRes.data);
    }

    // 3. Top Dishes (Best Selling)
    console.log('3. Testing Top Dishes API (/best-selling?filter=month)...');
    const topDishesRes = await fetchApi('/best-selling?filter=month');
    console.log(`Status: ${topDishesRes.status}`);
    if (topDishesRes.data && topDishesRes.data.success) {
      console.log(`Top dishes count: ${topDishesRes.data.data.length}`);
      if (topDishesRes.data.data.length > 0) {
        console.log('Top dish #1:', topDishesRes.data.data[0]);
      }
      console.log('✅ Top Dishes API OK\n');
    } else {
      console.log('❌ Top Dishes API Failed:', topDishesRes.data);
    }

    console.log('--- TESTS COMPLETED ---');
  } catch (err) {
    console.error('Error running tests:', err);
  }
}

runTests();
