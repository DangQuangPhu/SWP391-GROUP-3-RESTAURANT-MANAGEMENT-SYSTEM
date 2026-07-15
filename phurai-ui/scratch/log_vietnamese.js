import fs from 'fs';
import path from 'path';

const regex = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệđìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆĐÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ]/;

const results = [];

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
        const fileMatches = [];
        lines.forEach((line, idx) => {
          if (regex.test(line)) {
            fileMatches.push({ line: idx + 1, text: line.trim() });
          }
        });
        if (fileMatches.length > 0) {
          results.push({ file: fullPath, matches: fileMatches });
        }
      }
    }
  }
};

const rootDir = '/Volumes/Kingston/Github/SWP391-GROUP-3-RESTAURANT-MANAGEMENT-SYSTEM/phurai-ui';
scanDir(path.join(rootDir, 'backend/src'));
scanDir(path.join(rootDir, 'frontend/src'));

let output = '';
results.forEach(res => {
  output += `FILE: ${res.file}\n`;
  res.matches.forEach(m => {
    output += `  Line ${m.line}: ${m.text}\n`;
  });
  output += '\n';
});

fs.writeFileSync('/Users/phu/.gemini/antigravity-ide/scratch/vietnamese_results.txt', output, 'utf8');
console.log('Done searching.');
