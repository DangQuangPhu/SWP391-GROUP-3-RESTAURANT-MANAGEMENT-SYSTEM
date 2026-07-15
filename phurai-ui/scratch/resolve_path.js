import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sqlFile = path.resolve(__dirname, '../../database/System_Restaurant.sql');

console.log("Resolved path:", sqlFile);
console.log("Real path:", fs.realpathSync(sqlFile));
