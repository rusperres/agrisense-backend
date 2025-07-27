import express from 'express';
import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import authRoutes from './routes/auth.routes';
import messageRoutes from './routes/message.routes';
import { connectDB } from './config/db';
import { errorHandler } from './middlewares/error.middleware';
import { UserRole } from './types/enums';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') }); // Adjust path as needed relative to your project root

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Connect to Database
connectDB();

// --- Express Middleware ---
app.use(cors()); // Allow all origins for now, configure as needed
app.use(express.json());

// --- Express Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/product', messageRoutes);
app.use('/api/cart', messageRoutes);
app.use('/api/order', messageRoutes);
app.use('/api/review', messageRoutes);
app.use('/api/cropModeration', messageRoutes);
app.use('/api/farmerModeration', messageRoutes);
app.use('/api/reportModeration', messageRoutes);
app.use('/api/message', messageRoutes);
app.use('/api/admin', messageRoutes);


// --- Global Error Handler ---
app.use(errorHandler);

// --- WebSocket Setup ---
interface JwtPayload {
  id: string;
  role: UserRole;
  phone: string;
  email: string | null;
  name?: string;
}

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*", // Allow all origins for WebSocket connections, configure as needed
    methods: ["GET", "POST"]
  },
});

// Store connected users by their ID (a user might have multiple connections/devices)
const connectedUsers = new Map<string, Set<string>>(); // userId -> Set of socket.id's

// Middleware for Socket.IO authentication
io.use(async (socket: Socket, next) => {
  const token = socket.handshake.auth.token; // Client sends token in 'auth' object

  if (!token) {
    return next(new Error('Authentication token missing.'));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
    // Attach user info to the socket for later use
    (socket as any).userId = payload.id;
    (socket as any).userRole = payload.role;
    (socket as any).userName = payload.name; // If name is in JWT

    next(); // Authentication successful
  } catch (error) {
    console.error('Socket.IO authentication error:', error);
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new Error('Invalid or expired token.'));
    }
    next(new Error('Authentication failed.'));
  }
});

// WebSocket connection events
io.on('connection', (socket: Socket) => {
  const userId = (socket as any).userId;
  const socketId = socket.id;

  if (!connectedUsers.has(userId)) {
    connectedUsers.set(userId, new Set());
  }
  connectedUsers.get(userId)!.add(socketId);

  console.log(`User ${userId} connected with socket ID: ${socketId}. Total sockets for user: ${connectedUsers.get(userId)!.size}`);

  // Emit an event back to the connecting client (optional, for confirmation)
  socket.emit('connected', { message: 'Successfully connected to WebSocket!', userId: userId });

  // Example: Client sends a 'ping' and server responds 'pong'
  socket.on('ping', () => {
    socket.emit('pong', 'pong from server');
  });

  // Handle client disconnect
  socket.on('disconnect', () => {
    if (connectedUsers.has(userId)) {
      connectedUsers.get(userId)!.delete(socketId);
      if (connectedUsers.get(userId)!.size === 0) {
        connectedUsers.delete(userId); // Remove user from map if no active sockets
        console.log(`User ${userId} has no active sockets left.`);
        // Optional: Emit 'userOffline' event here
        io.emit('userOffline', { userId: userId });
      } else {
        console.log(`User ${userId} disconnected socket ID: ${socketId}. Remaining sockets: ${connectedUsers.get(userId)!.size}`);
      }
    } else {
      console.log(`Unknown socket disconnected: ${socketId}`);
    }
  });

  // You can add more socket.on() listeners here for client-initiated WS events
  // For messaging, sending a message is usually done via REST POST first.
  // Real-time updates (new message, read, typing) are typically server-emitted.
});


// Export the `io` instance so it can be used by other parts of your application (e.g., services)
export { io, connectedUsers };

// Start the HTTP server (which Socket.IO is attached to)
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});