import { getRawPool } from './server/db.js';
async function run() {
  const pool = await getRawPool();
  const images = [
    '/menu/yellowtail-jalapeno.jpg',
    '/menu/lychee-martini.jpg',
    '/menu/bento-chocolate-cake.jpg',
    '/menu/black-cod-miso.jpg'
  ];
  for (const img of images) {
    await pool.query(`UPDATE dbo.DishImages SET image_url = NULL WHERE image_url = '${img}'`);
    await pool.query(`UPDATE dbo.Dishes SET image_url = NULL WHERE image_url = '${img}'`);
  }
  console.log('Removed 404 images');
  process.exit(0);
}
run();
