import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const files = [
  'frontend/src/assets/images/figma/salmon.jpg',
  'frontend/src/assets/images/figma/gallery-01.jpg',
  'frontend/src/assets/images/figma/gallery-02.jpg',
  'frontend/src/assets/images/figma/gallery-03.jpg',
  'frontend/src/assets/images/figma/gallery-04.jpg',
  'frontend/src/assets/images/figma/gallery-05.jpg',
  'frontend/src/assets/images/figma/gallery-06.jpg',
  'frontend/src/assets/images/figma/gallery-07.jpg',
  'frontend/src/assets/images/figma/gallery-08.jpg',
  'frontend/src/assets/images/figma/gallery-09.jpg',
  'frontend/src/assets/images/fork-near-plate-with-twig.jpg',
  'frontend/src/assets/images/gift-card.jpg',
  'frontend/src/assets/images/hero.jpg',
  'frontend/src/assets/images/kitchen-secrets.jpg',
  'frontend/src/assets/images/kitchen-yellowtail-jalapeno.jpg',
  'frontend/src/assets/images/offering-sushi.jpg',
];

const tempOut = '/tmp/phurai_temp_img.jpg';

files.forEach(file => {
  const fullPath = path.resolve(file);
  if (!fs.existsSync(fullPath)) {
    console.log(`Skipping missing file: ${file}`);
    return;
  }

  const statBefore = fs.statSync(fullPath);
  const sizeBeforeMB = (statBefore.size / (1024 * 1024)).toFixed(2);

  try {
    // Run sips to output to a temp file on primary drive to avoid cross-volume renaming issues
    console.log(`Processing: ${file} (${sizeBeforeMB} MB)...`);
    execSync(`sips -Z 1200 -s formatOptions 75 "${fullPath}" --out "${tempOut}"`, { stdio: 'inherit' });

    // Copy the compressed temp file back to overwrite original using read/write streams
    const imgData = fs.readFileSync(tempOut);
    fs.writeFileSync(fullPath, imgData);
    fs.unlinkSync(tempOut);

    const statAfter = fs.statSync(fullPath);
    const sizeAfterMB = (statAfter.size / (1024 * 1024)).toFixed(2);
    console.log(`Successfully compressed ${file}: ${sizeBeforeMB} MB -> ${sizeAfterMB} MB`);
  } catch (error) {
    console.error(`Failed to process ${file}:`, error.message);
  }
});
