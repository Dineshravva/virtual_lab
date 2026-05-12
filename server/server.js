// Server entry point.
// Wires together Express (REST API), Socket.io (realtime), and MongoDB.

require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const experimentRoutes = require('./routes/experiments');
const assistantRoutes = require('./routes/assistant');
const setupSockets = require('./sockets/socketHandler');

const app = express();
const server = http.createServer(app);

// Allow the React dev server (and others) to call our API
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// REST API
app.use('/api/experiments', experimentRoutes);
app.use('/api/assistant', assistantRoutes);

// Health check
app.get('/', (req, res) => {
  res.send('VIRTUAL-LAB server is running');
});

// Socket.io with permissive CORS for development
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST']
  }
});

setupSockets(io);

const PORT = process.env.PORT || 5000;

// Connect to MongoDB then start the HTTP + WS server
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`[server] Listening on http://localhost:${PORT}`);
  });
});
