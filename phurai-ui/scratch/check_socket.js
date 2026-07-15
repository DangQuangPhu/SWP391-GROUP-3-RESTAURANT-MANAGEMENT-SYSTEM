import fs from 'fs';

const paths = [
  '/var/run/docker.sock',
  '/Users/phu/.docker/run/docker.sock'
];

paths.forEach(p => {
  try {
    const stats = fs.statSync(p);
    console.log(`Path: ${p}`);
    console.log(`  Exists: true`);
    console.log(`  Mode: ${stats.mode}`);
    console.log(`  UID: ${stats.uid}`);
    console.log(`  GID: ${stats.gid}`);
  } catch (err) {
    console.log(`Path: ${p} -> Error: ${err.message}`);
  }
});
