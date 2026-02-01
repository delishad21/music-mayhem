import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './routes/auth';
import songRoutes from './routes/songs';
import roomRoutes from './routes/rooms';
import { setupSocketHandlers } from './services/socketService';

dotenv.config();

const app = express();
const httpServer = createServer(app);
// Allow both localhost and network IP for development, plus ngrok/custom domains.
const allowedOriginsList = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  process.env.FRONTEND_URL || 'http://192.168.1.5:3000',
];

if (process.env.ALLOWED_ORIGINS) {
  process.env.ALLOWED_ORIGINS.split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
    .forEach(origin => allowedOriginsList.push(origin));
}

const allowedOrigins = new Set(allowedOriginsList);
const ngrokPattern = /^https?:\/\/([a-z0-9-]+\.)?ngrok(-free)?\.app$/i;
const ngrokIoPattern = /^https?:\/\/([a-z0-9-]+\.)?ngrok\.io$/i;
const musicgameDomainPattern = /^https?:\/\/musicgame\.delishad\.com$/i;

const isAllowedOrigin = (origin?: string | null) => {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  if (ngrokPattern.test(origin) || ngrokIoPattern.test(origin)) return true;
  if (musicgameDomainPattern.test(origin)) return true;
  return false;
};

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(cors({
  origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
  credentials: true,
}));
app.use(express.json());

// Serve audio files
const SONG_SERVICE_PATH = process.env.SONG_SERVICE_PATH || '/app/songs';
const audioDir = path.join(SONG_SERVICE_PATH, 'audio');
app.use('/audio', express.static(audioDir));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/songs', songRoutes);
app.use('/api/rooms', roomRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://admin:musicgame123@localhost:27017/music_game?authSource=admin';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  });

// Setup Socket.IO handlers
setupSocketHandlers(io);

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`🎵 Music Game Server running on port ${PORT}`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL}`);
});

export { io };
