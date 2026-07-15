import sql from 'mssql';
import dotenv from 'dotenv';
import { io } from 'socket.io-client';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const dbConfig = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_DATABASE || 'RestaurantDB',
  port: Number(process.env.DB_PORT) || 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

async function simulate() {
  let pool;
  try {
    console.log('Connecting to database...');
    pool = await sql.connect(dbConfig);
    
    // 1. Generate random ratings
    const food = Math.floor(Math.random() * 2) + 4; // 4 or 5
    const service = Math.floor(Math.random() * 2) + 4; // 4 or 5
    const ambiance = Math.floor(Math.random() * 2) + 4; // 4 or 5
    const comments = [
      "Excellent food and top-tier service!",
      "Really enjoyed the ambiance and the prompt staff.",
      "Fantastic dining experience, will come back again!",
      "The dishes were served hot and delicious."
    ];
    const comment = comments[Math.floor(Math.random() * comments.length)];

    // 2. Find the latest order to link to, or use null
    const orderRes = await pool.request().query('SELECT TOP 1 order_id, customer_id FROM dbo.Orders ORDER BY order_id DESC');
    const orderId = orderRes.recordset.length > 0 ? orderRes.recordset[0].order_id : null;
    const customerId = orderRes.recordset.length > 0 ? orderRes.recordset[0].customer_id : null;

    // Check if a review already exists for this order. If so, delete it first to avoid unique constraint violations
    if (orderId) {
      await pool.request()
        .input('orderId', sql.Int, orderId)
        .query('DELETE FROM dbo.CustomerReviews WHERE order_id = @orderId');
    }

    console.log(`Inserting review for Order #${orderId || 'N/A'} (Food: ${food}, Service: ${service}, Ambiance: ${ambiance})...`);
    
    const insertRes = await pool.request()
      .input('customerId', sql.Int, customerId)
      .input('orderId', sql.Int, orderId)
      .input('food', sql.TinyInt, food)
      .input('service', sql.TinyInt, service)
      .input('ambiance', sql.TinyInt, ambiance)
      .input('comment', sql.NVarChar(1000), comment)
      .query(`
        INSERT INTO dbo.CustomerReviews (customer_id, order_id, food_rating, service_rating, ambiance_rating, comment, is_visible, created_at)
        VALUES (@customerId, @orderId, @food, @service, @ambiance, @comment, 1, SYSDATETIME());
        SELECT @@IDENTITY as id;
      `);

    const newReviewId = insertRes.recordset[0].id;
    console.log(`✅ Review inserted into database with ID: ${newReviewId}`);

    // 3. Connect to the local Socket.IO server and emit the event
    console.log('Connecting to Socket.io server to notify portals...');
    const socket = io('http://localhost:5001');

    socket.on('connect', () => {
      console.log('Connected to socket server. Emitting review:created...');
      socket.emit('review:created', {
        review_id: newReviewId,
        order_id: orderId,
        customer_id: customerId,
        food_rating: food,
        service_rating: service,
        ambiance_rating: ambiance,
        overall_rating: Math.round((food + service + ambiance) / 3),
        comment: comment,
        created_at: new Date()
      });

      console.log('Real-time event emitted! Closing socket connection...');
      setTimeout(() => {
        socket.disconnect();
        pool.close();
        console.log('Done!');
        process.exit(0);
      }, 1000);
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection failed:', err.message);
      pool.close();
      process.exit(1);
    });

  } catch (error) {
    console.error('Error during simulation:', error);
    if (pool) pool.close();
    process.exit(1);
  }
}

simulate();
