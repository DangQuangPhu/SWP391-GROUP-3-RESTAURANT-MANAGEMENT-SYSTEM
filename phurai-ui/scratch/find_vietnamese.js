import fs from 'fs';
import path from 'path';

const regex = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệđìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆĐÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ]/;

const scanDir = (dir) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        scanDir(fullPath);
      }
    } else {
      if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.css') || file.endsWith('.html')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');
        let fileReported = false;
        lines.forEach((line, idx) => {
          if (regex.test(line)) {
            // Ignore some typical patterns if any (e.g. comments with full names if they have specific names)
            // But we want to inspect all matches
            if (!fileReported) {
              console.log(`\nFILE: ${fullPath}`);
              fileReported = true;
            }
            console.log(`  Line ${idx + 1}: ${line.trim()}`);
          }
        });
      }
    }
  }
};

const rootDir = '/Volumes/Kingston/Github/SWP391-GROUP-3-RESTAURANT-MANAGEMENT-SYSTEM/phurai-ui';
scanDir(path.join(rootDir, 'backend/src'));
scanDir(path.join(rootDir, 'frontend/src'));
console.log('\n--- SCAN COMPLETE ---');
