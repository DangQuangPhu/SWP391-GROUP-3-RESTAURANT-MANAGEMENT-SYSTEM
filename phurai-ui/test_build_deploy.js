import { execSync } from 'child_process';

const cwd = '/Volumes/Kingston/Github/SWP391-GROUP-3-RESTAURANT-MANAGEMENT-SYSTEM';

function run(cmd, dir = cwd) {
  console.log(`Running: ${cmd}`);
  try {
    execSync(cmd, { cwd: dir, stdio: 'inherit' });
    console.log("Success!\n");
  } catch (err) {
    console.error(`Command failed: ${cmd}`);
    process.exit(1);
  }
}

console.log("=== STEP 1: Building Docker Image ===");
run('docker build -t phurai-app-test ./phurai-ui');

console.log("=== STEP 2: Git Commit ===");
run('git commit -m "feat: staff dashboard table management, virtual walk-in slots, styling updates, and relaxed counter QR ordering constraint"');

console.log("=== STEP 3: Git Push ===");
run('git push');

console.log("=== ALL DEPLOYMENT STEPS COMPLETED SUCCESSFULLY! ===");
