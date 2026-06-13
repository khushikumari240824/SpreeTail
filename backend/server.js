import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import db from './config/db.js';

// Import Routes (Placeholders)
import authRoutes from './routes/authRoutes.js';
import groupRoutes from './routes/groupRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import settlementRoutes from './routes/settlementRoutes.js';
import balanceRoutes from './routes/balanceRoutes.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

// CORS config
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(cors({
  origin: clientUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

// Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// REST Routes
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/balances', balanceRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// Socket.IO real-time communication
const io = new Server(server, {
  cors: {
    origin: clientUrl,
    credentials: true,
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Join expense-specific chat room
  socket.on('joinRoom', ({ expenseId }) => {
    socket.join(`expense_${expenseId}`);
    console.log(`User ${socket.id} joined room expense_${expenseId}`);
  });

  // Handle outgoing messages
  socket.on('chatMessage', async (data) => {
    const { expenseId, user, message } = data;
    try {
      // Save message to database
      const dbResult = await db.query(
        'INSERT INTO chat_messages (expense_id, user_id, message) VALUES ($1, $2, $3) RETURNING *',
        [expenseId, user.id, message]
      );
      const savedMsg = dbResult.rows[0];

      // Broadcast message to everyone in the room (including sender if using standard socket flow, or everyone else)
      io.to(`expense_${expenseId}`).emit('message', {
        id: savedMsg.id,
        expense_id: expenseId,
        user_id: user.id,
        user_name: user.name,
        message: savedMsg.message,
        created_at: savedMsg.created_at
      });
    } catch (err) {
      console.error('Error saving chat message to database:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;
db.initDb()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database, server not started:', err);
  });

