const http = require('http');

const options = {
  hostname: '127.0.0.1',
  port: process.env.PORT || 5002,
  path: '/api/staff/reservations/9/assign-table',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-user-id': '3'
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => console.log(`BODY: ${data}`));
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(JSON.stringify({ tableId: 10 }));
req.end();
