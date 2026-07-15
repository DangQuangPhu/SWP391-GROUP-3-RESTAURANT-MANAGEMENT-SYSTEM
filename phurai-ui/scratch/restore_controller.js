import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

try {
  console.log("Fetching original file from Git...");
  const content = execSync('git show HEAD:phurai-ui/backend/src/controllers/employeeController.js', {
    cwd: '/Volumes/Kingston/Github/SWP391-GROUP-3-RESTAURANT-MANAGEMENT-SYSTEM',
    maxBuffer: 10 * 1024 * 1024
  });

  const targetPath = '/Volumes/Kingston/Github/SWP391-GROUP-3-RESTAURANT-MANAGEMENT-SYSTEM/phurai-ui/scratch/employee_controller_original.js';
  fs.writeFileSync(targetPath, content);
  console.log("Written original controller content to workspace scratch directory.");
} catch (err) {
  console.error("Failed:", err.message);
}
