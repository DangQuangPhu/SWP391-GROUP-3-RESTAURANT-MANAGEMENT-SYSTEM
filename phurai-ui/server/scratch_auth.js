import jwt from 'jsonwebtoken';

import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

const token = jwt.sign(
  {
    user_id: 3,
    role_id: 3,
    role_name: 'Kitchen Staff',
    full_name: 'Kitchen Demo',
    email: 'kitchen1@phurai.vn',
  },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
);

async function testAuth() {
  const queueRes = await fetch('http://localhost:5001/api/kitchen/queue', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (queueRes.ok) {
    console.log("SUCCESS: /api/kitchen/queue returned 200 OK");
    const queueData = await queueRes.json();
    console.log("Queue data size:", queueData.data.length);
  } else {
    const text = await queueRes.text();
    console.error("FAILED: /api/kitchen/queue returned", queueRes.status, text);
  }
}

testAuth();
