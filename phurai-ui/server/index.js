import express from 'express';
import cors from 'cors';
import './config.js';
import authRoutes from './routes/auth.js';

const app = express();
const port = process.env.PORT || 5000;

const allowedOrigins = (process.env.APP_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.use('/api', authRoutes);

app.listen(port, () => {
  console.log(`Backend server listening on http://localhost:${port}`);
});
