const http = require('http');

const data = JSON.stringify({
  guest_count: 2,
  reservation_start_at: '2026-06-22T20:00:00',
  durationMinutes: 30,
  special_request: '[Casual Dinner]',
  table_ids: [1],
  contact_name: 'Test',
  contact_phone: '0123456789',
  contact_email: 'test@example.com',
  preorder_items: [{ dish_id: 1, quantity: 1, customization_requests: '' }]
});

const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/api/reservations',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('Response:', body));
});

req.on('error', e => console.error(e));
req.write(data);
req.end();
