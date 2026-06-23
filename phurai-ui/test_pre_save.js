import http from 'http';

const payload = {
  customer_id: null,
  guest_count: 2,
  reservation_start_at: "2026-06-23T12:00:00",
  durationMinutes: 30,
  reservation_end_at: "2026-06-23T12:45:00",
  special_request: "[Dining Purpose: casual]",
  table_ids: [1]
};

const data = JSON.stringify(payload);

const options = {
  hostname: 'localhost',
  port: 5001,
  path: '/api/reservations/pre-save',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  let responseData = '';
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  res.on('end', () => {
    console.log('Response:', responseData);
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(data);
req.end();
