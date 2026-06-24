const fs = require('fs');
const path = require('path');

const brainDir = '/Users/phu/.gemini/antigravity-ide/brain/4f85d582-51c9-42b3-b311-de3c3d6b74b0';
const publicZonesDir = path.join(__dirname, 'public', 'images', 'zones');

// Create directory
if (!fs.existsSync(publicZonesDir)) {
  fs.mkdirSync(publicZonesDir, { recursive: true });
}

// Copy images
const images = {
  window_zone: 'window_zone_view_1782253604685.png',
  vip_room: 'vip_room_view_1782253615699.png',
  standard_dining: 'standard_dining_view_1782253625329.png',
  premium_dining: 'premium_dining_view_1782253635769.png',
  private_room: 'private_room_view_1782253645615.png'
};

for (const [name, filename] of Object.entries(images)) {
  const src = path.join(brainDir, filename);
  const dest = path.join(publicZonesDir, `${name}.png`);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${filename} to ${dest}`);
  } else {
    console.log(`Source not found: ${src}`);
  }
}
