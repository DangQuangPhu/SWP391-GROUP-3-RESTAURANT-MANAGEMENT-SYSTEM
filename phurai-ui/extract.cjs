const fs = require('fs');
const path = require('path');

const logPath = '/Users/phu/.gemini/antigravity-ide/brain/7d372253-15d5-47df-9e79-e0c114009f28/.system_generated/logs/transcript.jsonl';
const content = fs.readFileSync(logPath, 'utf8');

const lines = content.split('\n');
let maxContent = "";

for (let i = lines.length - 1; i >= 0; i--) {
  if (!lines[i].trim()) continue;
  try {
    const data = JSON.parse(lines[i]);
    if (data.type === 'VIEW_FILE' && data.content && data.content.includes('function ReservationPage(')) {
       // found the view_file block
       if (data.content.length > maxContent.length) {
          maxContent = data.content;
       }
    }
    if (data.type === 'CODE_ACTION' && data.content && data.content.includes('ReservationPage.jsx')) {
       // also capture code actions
    }
  } catch (e) {}
}

if (maxContent) {
  fs.writeFileSync('extracted.txt', maxContent);
} else {
  fs.writeFileSync('extracted.txt', 'not found');
}
