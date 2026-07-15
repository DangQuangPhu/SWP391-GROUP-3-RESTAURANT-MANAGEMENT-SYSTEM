import { execSync } from 'child_process';
import fs from 'fs';

const path = 'phurai-ui/frontend/src/features/staff-dashboard/components/StaffTableTab.jsx';
const cwd = '/Volumes/Kingston/Github/SWP391-GROUP-3-RESTAURANT-MANAGEMENT-SYSTEM';

try {
  console.log("Reading HEAD content from git...");
  const content = execSync(`git show HEAD:${path}`, { cwd, encoding: 'utf8' });
  console.log("Writing content back to file...");
  fs.writeFileSync(`${cwd}/${path}`, content, 'utf8');
  console.log("Restored successfully via write!");
} catch (err) {
  console.error("Failed to restore:");
  console.error(err.message);
}
