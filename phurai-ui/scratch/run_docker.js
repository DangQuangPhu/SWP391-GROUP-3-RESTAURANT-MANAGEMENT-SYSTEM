import { execSync } from 'child_process';

try {
  console.log("Running 'docker ps'...");
  const output = execSync('docker ps', {
    encoding: 'utf8',
    env: {
      ...process.env,
      DOCKER_HOST: 'unix:///Users/phu/.docker/run/docker.sock'
    }
  });
  console.log("Output:\n", output);
} catch (error) {
  console.error("Exec failed:", error.message);
}
