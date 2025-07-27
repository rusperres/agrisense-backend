import { Pool } from 'pg';
import { DB_URL } from './env';

export const pool = new Pool({
  connectionString: DB_URL,
});

export const connectDB = async () => {
  try {
    const client = await pool.connect();
    console.log('PostgreSQL database connected successfully!');
    client.release();
  } catch (error) {
    console.error('Error connecting to PostgreSQL database:', error);
    process.exit(1);
  }
};