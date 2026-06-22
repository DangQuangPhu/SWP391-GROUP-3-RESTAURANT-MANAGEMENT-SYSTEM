import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const managerUIExports = new Set([
  'StatusBadge', 'SectionHead', 'ContentPanel', 'Toolbar', 'SearchField', 
  'Button', 'EmptyState', 'Card', 'NotConnectedNote'
]);

const staffUIExports = new Set([
  'StatusBadge', 'SectionHead', 'Toolbar', 'SearchField', 
  'Button', 'EmptyState', 'NotConnectedNote'
]);

function scanDirectory(dir, uiName, allowedExports) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      scanDirectory(fullPath, uiName, allowedExports);
    } else if (fullPath.endsWith('.jsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const importRegex = new RegExp(`import\\s+\\{([^}]+)\\}\\s+from\\s+["'](?:\\.\\/|\\.\\.\\/)+${uiName}(?:\\.jsx)?["']`, 'g');
      
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const importedNames = match[1].split(',').map(n => n.trim()).filter(n => n);
        const badImports = importedNames.filter(n => !allowedExports.has(n));
        
        if (badImports.length > 0) {
          console.log(`ERROR in ${fullPath}`);
          console.log(`  Phantom imports from ${uiName}: ${badImports.join(', ')}`);
        }
      }
    }
  }
}

console.log('--- Scanning Manager Dashboard ---');
scanDirectory(path.join(__dirname, 'src/features/manager-dashboard'), 'ManagerUI', managerUIExports);

console.log('--- Scanning Staff Dashboard ---');
scanDirectory(path.join(__dirname, 'src/features/staff-dashboard'), 'StaffUI', staffUIExports);
