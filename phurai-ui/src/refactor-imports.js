import fs from 'fs';
import path from 'path';

const searchPath = '/Users/phu/Documents/GitHub/SWP391-GROUP-3-RESTAURANT-MANAGEMENT-SYSTEM/phurai-ui/src';

function replaceImports(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceImports(fullPath);
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      
      // Match patterns like: from "../../data/managerDashboardMockData.js";
      // and replace with correct relative path to src/shared/constants.js
      if (content.includes('managerDashboardMockData.js') || content.includes('staffDashboardMockData.js')) {
        const relativeToShared = path.relative(path.dirname(fullPath), path.join(searchPath, 'shared/constants.js'));
        let replacementPath = relativeToShared.replace(/\\/g, '/');
        if (!replacementPath.startsWith('.')) {
          replacementPath = './' + replacementPath;
        }

        content = content.replace(/from\s+['"][^'"]*(?:managerDashboardMockData\.js|staffDashboardMockData\.js)['"]/g, `from "${replacementPath}"`);
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated imports in ${fullPath}`);
      }
    }
  }
}

replaceImports(searchPath);
console.log('Done refactoring imports.');
