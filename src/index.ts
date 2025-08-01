import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import express from 'express';
import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import authRoutes from './routes/auth.routes';
import productRoutes from './routes/product.routes';
import cartRoutes from './routes/cart.routes';
import marketPriceRoutes from './routes/marketPrice.routes';
import orderRoutes from './routes/orderRoutes'
import reviewRoutes from './routes/review.routes'

import { connectDB } from './config/db';
import { errorHandler } from './middlewares/error.middleware';
import { UserRole } from './types/enums';
import uploadRoutes from './routes/upload.routes';
// import { startJobScheduler } from './jobs/scheduler';
// import { runPriceScraperJob } from './jobs/priceScraper.job';



const app = express();
// const httpServer = http.createServer(app);

// Connect to Database
connectDB();

// --- Express Middleware ---
app.use(cors()); // Allow all origins for now, configure as needed
app.use(express.json());

// --- Express Routes ---
app.use('/auth', authRoutes);
app.use('/product', productRoutes);
app.use('/market-prices', marketPriceRoutes);
app.use('/cart', cartRoutes);
app.use('/order', orderRoutes);
app.use('/review', reviewRoutes);
app.use('/upload', uploadRoutes);


// --- Global Error Handler ---
app.use(errorHandler);


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});