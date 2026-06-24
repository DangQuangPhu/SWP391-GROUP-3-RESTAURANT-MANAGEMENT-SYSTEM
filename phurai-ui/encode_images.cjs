const fs = require('fs');
const path = require('path');

const brainDir = '/Users/phu/.gemini/antigravity-ide/brain/4f85d582-51c9-42b3-b311-de3c3d6b74b0';
const outputJsPath = path.join(__dirname, 'src', 'features', 'reservations', 'components', 'choose-table', 'ZoneImages.js');

const images = {
  window: 'window_zone_view_1782253604685.png',
  vip: 'vip_room_view_1782253615699.png',
  standard: 'standard_dining_view_1782253625329.png',
  premium: 'premium_dining_view_1782253635769.png',
  private: 'private_room_view_1782253645615.png',
  kitchen: 'kitchen_view_area_1782253941268.png'
};

let jsContent = '// Auto-generated base64 images\n\n';

for (const [name, filename] of Object.entries(images)) {
  const src = path.join(brainDir, filename);
  if (fs.existsSync(src)) {
    const base64 = fs.readFileSync(src).toString('base64');
    jsContent += `export const img_${name} = 'data:image/png;base64,${base64}';\n\n`;
    console.log(`Processed ${filename}`);
  } else {
    console.log(`Source not found: ${src}`);
  }
}

fs.writeFileSync(outputJsPath, jsContent);
console.log(`Wrote to ${outputJsPath}`);
