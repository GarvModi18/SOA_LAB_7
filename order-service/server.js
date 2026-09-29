require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const orderRoutes = require('./routes/orderRoutes');
const { USER_SERVICE_URL, PRODUCT_SERVICE_URL } = require('./services/apiClient');

const app = express();
const PORT = process.env.ORDER_SERVICE_PORT || process.env.PORT || 3003;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017/campusconnect_orders';

// Middleware
app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'order-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    dependencies: {
      userService: USER_SERVICE_URL,
      productService: PRODUCT_SERVICE_URL
    }
  });
});

// Root Info
app.get('/', (req, res) => {
  res.json({
    service: 'Order Microservice - CampusConnect',
    port: PORT,
    database: 'campusconnect_orders',
    dependencies: {
      userServiceUrl: USER_SERVICE_URL,
      productServiceUrl: PRODUCT_SERVICE_URL
    },
    endpoints: {
      getAll: `GET /orders`,
      getById: `GET /orders/:id`,
      create: `POST /orders`,
      updateStatus: `PUT /orders/:id/status`,
      delete: `DELETE /orders/:id`,
      health: `GET /health`
    }
  });
});

// Routes
app.use('/orders', orderRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    service: 'order-service',
    status: 404,
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Order-Service Error]:', err);
  res.status(500).json({
    service: 'order-service',
    status: 500,
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred in Order Service'
  });
});

// Database Connection & Server Startup
const startServer = async () => {
  try {
    console.log(`Connecting Order Service to MongoDB at: ${MONGO_URI}...`);
    await mongoose.connect(MONGO_URI);
    console.log('✅ Order Service connected to MongoDB (campusconnect_orders)');

    app.listen(PORT, () => {
      console.log(`🚀 [Order Service] running on port ${PORT}`);
      console.log(`📡 Endpoints active at http://localhost:${PORT}/orders`);
      console.log(`🔗 Connected dependencies:`);
      console.log(`   - User Service: ${USER_SERVICE_URL}`);
      console.log(`   - Product Service: ${PRODUCT_SERVICE_URL}`);
    });
  } catch (error) {
    console.error('❌ Order Service failed to connect to MongoDB:', error.message);
    app.listen(PORT, () => {
      console.log(`⚠️ [Order Service] running in degraded mode on port ${PORT} (No DB connection)`);
    });
  }
};

startServer();
