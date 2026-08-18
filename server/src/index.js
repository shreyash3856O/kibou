import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath as _fileURLToPath } from 'node:url';
const _envDir = path.dirname(_fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(_envDir, '../.env') });
import apiRouter from './routes.js';
import { setupSocketIO } from './socket.js';
import { initializeDatabase } from './db.js';

// dotenv loaded above with explicit path

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_DIST = path.join(__dirname, '../../client/dist');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend clients
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// API Routes
app.use('/api', apiRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    platform: 'Seeker',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Serve frontend static build if it exists (Production Ready)
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
  console.log(`📦 Serving production client assets from: ${CLIENT_DIST}`);
}

// Setup WebSocket Server
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 30000,
  pingInterval: 15000
});

setupSocketIO(io);

// Initialize database and start server
async function startServer() {
  await initializeDatabase();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`=========================================`);
    console.log(`🌿 Seeker Platform listening on port ${PORT}`);
    console.log(`🔒 Encryption: AES-256-CBC`);
    console.log(`🛡️ Real-Time Crisis Detection: Active`);
    console.log(`🩺 Counselor Login: counselor@school.edu / AdminPass123!`);
    console.log(`=========================================`);
  });
}

startServer();
