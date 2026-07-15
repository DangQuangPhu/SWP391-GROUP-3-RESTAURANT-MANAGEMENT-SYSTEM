import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

try {
  console.log("Restoring System_Restaurant.sql using git show...");
  const content = execSync('git show HEAD:phurai-ui/database/System_Restaurant.sql', {
    cwd: '/Users/phu/Documents/Documents - Dang\'s MacBook Pro/GitHub/SWP391-GROUP-3-RESTAURANT-MANAGEMENT-SYSTEM'
  });
  
  const dest = '/Users/phu/Documents/Documents - Dang\'s MacBook Pro/GitHub/SWP391-GROUP-3-RESTAURANT-MANAGEMENT-SYSTEM/phurai-ui/database/System_Restaurant.sql';
  fs.writeFileSync(dest, content);
  console.log("✅ Successfully restored System_Restaurant.sql!");
} catch (err) {
  console.error("Failed:", err.message);
}
