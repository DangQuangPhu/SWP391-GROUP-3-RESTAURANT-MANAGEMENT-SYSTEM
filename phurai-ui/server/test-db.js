import pool from './db.js';
pool.query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users'`)
  .then(res => {
    console.log(res[0] ? res[0].map(r => r.COLUMN_NAME) : res.recordset.map(r => r.COLUMN_NAME));
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
