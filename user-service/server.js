require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const userRoutes = require('./routes/userRoutes');

const app = express();
const PORT = process.env.USER_SERVICE_PORT || process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017/campusconnect_users';

// Middleware
app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'user-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Root Info
app.get('/', (req, res) => {
  res.json({
    service: 'User Microservice - CampusConnect',
    port: PORT,
    database: 'campusconnect_users',
    endpoints: {
      getAll: `GET /users`,
      getById: `GET /users/:id`,
      create: `POST /users`,
      update: `PUT /users/:id`,
      delete: `DELETE /users/:id`,
      health: `GET /health`
    }
  });
});

// Routes
app.use('/users', userRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    service: 'user-service',
    status: 404,
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[User-Service Error]:', err);
  res.status(500).json({
    service: 'user-service',
    status: 500,
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred in User Service'
  });
});

// Database Connection & Server Startup
const startServer = async () => {
  try {
    console.log(`Connecting User Service to MongoDB at: ${MONGO_URI}...`);
    await mongoose.connect(MONGO_URI);
    console.log('✅ User Service connected to MongoDB (campusconnect_users)');

    app.listen(PORT, () => {
      console.log(`🚀 [User Service] running on port ${PORT}`);
      console.log(`📡 Endpoints active at http://localhost:${PORT}/users`);
    });
  } catch (error) {
    console.error('❌ User Service failed to connect to MongoDB:', error.message);
    // Still listen so health check can report db disconnected or retry
    app.listen(PORT, () => {
      console.log(`⚠️ [User Service] running in degraded mode on port ${PORT} (No DB connection)`);
    });
  }
};

startServer();
