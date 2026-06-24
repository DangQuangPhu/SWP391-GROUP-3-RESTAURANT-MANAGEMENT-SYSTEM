import fs from 'fs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });

const secret = process.env.JWT_SECRET || 'fallback_secret';
const token = jwt.sign({ userId: 1, role: 'manager' }, secret);

async function test() {
  try {
    const res = await fetch('http://localhost:8080/api/staff/reservations/9/check-in', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const text = await res.text();
    console.log(`Status: ${res.status}`);
    console.log(`Response:`, text);
    
    if (fs.existsSync('CRASH_LOG.txt')) {
      console.log('CRASH LOG CONTENT:');
      console.log(fs.readFileSync('CRASH_LOG.txt', 'utf8'));
    }
  } catch(e) {
    console.error(e);
  }
}
test();
