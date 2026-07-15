import fs from 'fs';
import path from 'path';

const files = [
  './scratch/check_socket.js',
  './scratch/diagnose_db.js',
  './scratch/query_user.js',
  './scratch/run_docker.js',
  './scratch/test_db_verify.js',
  './scratch/resolve_path.js',
  './scratch/run_seed.js'
];

files.forEach(f => {
  try {
    if (fs.existsSync(f)) {
      fs.unlinkSync(f);
      console.log(`Deleted: ${f}`);
    }
  } catch (err) {
    console.error(`Failed to delete ${f}:`, err.message);
  }
});
