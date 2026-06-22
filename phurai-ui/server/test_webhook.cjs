const http = require('http');

const runTest = (amount, code, expectedStatus) => {
  return new Promise((resolve) => {
    const data = JSON.stringify({
      id: 12345,
      gateway: "TPBank",
      transactionDate: "2026-06-22 20:00:00",
      accountNumber: "00003942326",
      subAccount: null,
      code: "SEPAY123",
      content: code,
      transferType: "in",
      transferAmount: amount,
      accumulated: 1000000,
      channel: "APP",
      referenceCode: "REF" + Math.floor(Math.random() * 10000)
    });

    const options = {
      hostname: 'localhost',
      port: 5001, // Assuming your backend runs on 5001
      path: '/api/payment/sepay-webhook',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Apikey test-sepay-key', // if there's an api key, we might need it, but let's see.
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = http.request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log(`Test Amount=${amount} Code=${code} -> Expected: ${expectedStatus}, Got: ${res.statusCode}, Body: ${body}`);
        resolve();
      });
    });

    req.on('error', e => {
      console.error(e);
      resolve();
    });
    req.write(data);
    req.end();
  });
};

async function main() {
  await runTest(215000, "RES13", 200); // adjust with real values
}
main();
