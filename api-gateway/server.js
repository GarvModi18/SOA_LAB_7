require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const serviceRegistry = require('./config/serviceRegistry');

const app = express();
const PORT = serviceRegistry.port;

// Global CORS Middleware
app.use(cors());

// Request Logging Middleware for API Gateway
app.use((req, res, next) => {
  const start = Date.now();
  
  // Identify matching target service for logging
  let targetService = 'API Gateway';
  if (req.path.startsWith('/users')) targetService = 'User Service';
  else if (req.path.startsWith('/products')) targetService = 'Product Service';
  else if (req.path.startsWith('/orders')) targetService = 'Order Service';

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logColor = res.statusCode >= 500 ? '\x1b[31m' : res.statusCode >= 400 ? '\x1b[33m' : '\x1b[32m';
    console.log(
      `[Gateway Log] ${new Date().toISOString()} | ${req.method.padEnd(6)} ${req.originalUrl.padEnd(20)} | Target: ${targetService.padEnd(16)} | Status: ${logColor}${res.statusCode}\x1b[0m | Duration: ${duration}ms`
    );
  });

  next();
});

// ==============================================================================
// 1. Gateway Health Check & Service Registry Metadata
// ==============================================================================
app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'api-gateway',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`,
    version: '1.0.0',
    gatewayPort: PORT,
    serviceRegistry: {
      userService: serviceRegistry.services.user.url,
      productService: serviceRegistry.services.product.url,
      orderService: serviceRegistry.services.order.url
    }
  });
});

// Gateway Root Documentation
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Welcome to CampusConnect API Gateway (Lab 7)',
    architecture: 'Microservices with API Gateway & Config-based Service Discovery',
    author: 'Garv Modi',
    healthCheck: 'GET /health',
    routes: {
      users: {
        prefix: '/users',
        targetService: serviceRegistry.services.user.name,
        targetUrl: serviceRegistry.services.user.url,
        examples: ['GET /users', 'GET /users/:id', 'POST /users', 'PUT /users/:id', 'DELETE /users/:id']
      },
      products: {
        prefix: '/products',
        targetService: serviceRegistry.services.product.name,
        targetUrl: serviceRegistry.services.product.url,
        examples: ['GET /products', 'GET /products/:id', 'POST /products', 'PUT /products/:id', 'DELETE /products/:id']
      },
      orders: {
        prefix: '/orders',
        targetService: serviceRegistry.services.order.name,
        targetUrl: serviceRegistry.services.order.url,
        examples: ['POST /orders', 'GET /orders', 'GET /orders/:id', 'PUT /orders/:id/status', 'DELETE /orders/:id']
      }
    }
  });
});

// ==============================================================================
// 2. Reverse Proxy Helper Factory with Centralized 502/503 Error Handling
// ==============================================================================
const createServiceProxy = (serviceConfig) => {
  return createProxyMiddleware({
    target: serviceConfig.url,
    changeOrigin: true,
    pathFilter: serviceConfig.prefix,
    timeout: serviceConfig.timeoutMs || 5000,
    proxyTimeout: serviceConfig.timeoutMs || 5000,
    on: {
      proxyReq: (proxyReq, req, res) => {
        // Attach forward headers
        proxyReq.setHeader('X-Forwarded-By', 'CampusConnect-API-Gateway');
      },
      error: (err, req, res) => {
        console.error(`[Gateway Proxy Error] Target: ${serviceConfig.name} (${serviceConfig.url}) -> ${err.message}`);
        
        // Return clear 502 Bad Gateway / 503 Service Unavailable error response
        const statusCode = err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' ? 503 : 502;
        
        if (!res.headersSent) {
          res.status(statusCode).json({
            gateway: 'CampusConnect-API-Gateway',
            status: statusCode,
            error: statusCode === 503 ? 'Service Unavailable' : 'Bad Gateway',
            message: `Target service '${serviceConfig.name}' is currently unreachable or unresponsive.`,
            targetService: serviceConfig.name,
            targetUrl: serviceConfig.url,
            attemptedPath: req.originalUrl,
            method: req.method,
            details: err.code || err.message,
            timestamp: new Date().toISOString()
          });
        }
      }
    }
  });
};

// ==============================================================================
// 3. Dynamic Route Registration using Service Discovery Configuration
// ==============================================================================
// Route /users to User Service
app.use(createServiceProxy(serviceRegistry.services.user));

// Route /products to Product Service
app.use(createServiceProxy(serviceRegistry.services.product));

// Route /orders to Order Service
app.use(createServiceProxy(serviceRegistry.services.order));

// ==============================================================================
// 4. Fallback 404 & Centralized Global Error Handler
// ==============================================================================
app.use((req, res) => {
  res.status(404).json({
    gateway: 'CampusConnect-API-Gateway',
    status: 404,
    error: 'Route Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}. Valid prefixes are /users, /products, /orders, /health.`,
    timestamp: new Date().toISOString()
  });
});

app.use((err, req, res, next) => {
  console.error('[Gateway Internal Error]:', err);
  res.status(500).json({
    gateway: 'CampusConnect-API-Gateway',
    status: 500,
    error: 'Internal Gateway Error',
    message: err.message || 'An unexpected error occurred within the API Gateway',
    timestamp: new Date().toISOString()
  });
});

// ==============================================================================
// 5. Server Startup
// ==============================================================================
app.listen(PORT, () => {
  console.log('================================================================');
  console.log(`🚀 [API Gateway] running on port ${PORT}`);
  console.log(`🌐 Public Gateway Entry Point: http://localhost:${PORT}`);
  console.log(`🩺 Health check active at http://localhost:${PORT}/health`);
  console.log('📋 Dynamic Service Routing Table:');
  console.log(`   - /users/*    -> ${serviceRegistry.services.user.url} (${serviceRegistry.services.user.name})`);
  console.log(`   - /products/* -> ${serviceRegistry.services.product.url} (${serviceRegistry.services.product.name})`);
  console.log(`   - /orders/*   -> ${serviceRegistry.services.order.url} (${serviceRegistry.services.order.name})`);
  console.log('================================================================');
});
