import { execSync } from 'child_process';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function run(cmd) {
  console.log(`\n> Executing: ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch (err) {
    console.error(`\n[ERROR] Command failed: ${cmd}`);
    process.exit(1);
  }
}

rl.question('Enter commit message (default: "deploy: updates"): ', (message) => {
  const msg = message.trim() || 'deploy: updates';
  
  console.log('\n=== 1. STAGING CHANGES ===');
  run('git add -A');
  
  console.log('\n=== 2. COMMITTING CHANGES ===');
  run(`git commit -m "${msg}"`);
  
  console.log('\n=== 3. PUSHING TO GITHUB (Triggers GitHub Actions Docker build) ===');
  run('git push');
  
  console.log('\n=============================================================');
  console.log('✅ Push complete! GitHub Actions will now automatically build the Docker image.');
  console.log('=============================================================');
  
  rl.close();
});
