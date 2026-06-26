import fs from 'fs';

const files = [
  '/Users/phu/Documents/GitHub/SWP391-GROUP-3-RESTAURANT-MANAGEMENT-SYSTEM/phurai-ui/src/features/manager-dashboard/data/managerDashboardMockData.js',
  '/Users/phu/Documents/GitHub/SWP391-GROUP-3-RESTAURANT-MANAGEMENT-SYSTEM/phurai-ui/src/features/staff-dashboard/data/staffDashboardMockData.js'
];

for (const file of files) {
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
    console.log(`Deleted ${file}`);
  }
}
