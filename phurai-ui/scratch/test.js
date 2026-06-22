import fs from 'fs';
const code = fs.readFileSync('server/controllers/managerReservationController.js', 'utf8');
const match = code.match(/const testReservations = \[\s*([\s\S]*?)\s*\];/);
if (match) {
  const content = '[' + match[1] + ']';
  const array = eval(content);
  array.forEach((r, i) => console.log(i, 'table_id:', r.table_id, 'type:', typeof r.table_id, 'is null:', r.table_id === null));
}
