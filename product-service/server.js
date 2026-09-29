require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const productRoutes = require('./routes/productRoutes');

const app = express();
const PORT = process.env.PRODUCT_SERVICE_PORT || process.env.PORT || 3002;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017/campusconnect_products';

// Middleware
app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'product-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Root Info
app.get('/', (req, res) => {
  res.json({
    service: 'Product Microservice - CampusConnect',
    port: PORT,
    database: 'campusconnect_products',
    endpoints: {
      getAll: `GET /products`,
      getById: `GET /products/:id`,
      create: `POST /products`,
      update: `PUT /products/:id`,
      delete: `DELETE /products/:id`,
      health: `GET /health`
    }
  });
});

// Routes
app.use('/products', productRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    service: 'product-service',
    status: 404,
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Product-Service Error]:', err);
  res.status(500).json({
    service: 'product-service',
    status: 500,
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred in Product Service'
  });
});

// Database Connection & Server Startup
const startServer = async () => {
  try {
    console.log(`Connecting Product Service to MongoDB at: ${MONGO_URI}...`);
    await mongoose.connect(MONGO_URI);
    console.log('✅ Product Service connected to MongoDB (campusconnect_products)');

    app.listen(PORT, () => {
      console.log(`🚀 [Product Service] running on port ${PORT}`);
      console.log(`📡 Endpoints active at http://localhost:${PORT}/products`);
    });
  } catch (error) {
    console.error('❌ Product Service failed to connect to MongoDB:', error.message);
    app.listen(PORT, () => {
      console.log(`⚠️ [Product Service] running in degraded mode on port ${PORT} (No DB connection)`);
    });
  }
};

startServer();
