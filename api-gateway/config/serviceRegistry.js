require('dotenv').config();

/**
 * Service Registry Configuration (Service Discovery Layer)
 * 
 * Instead of hardcoding microservice endpoints, the API Gateway retrieves
 * target locations dynamically from environment variables or a configuration map.
 * This decouples routing logic from internal container networking topologies.
 */
const serviceRegistry = {
  port: parseInt(process.env.PORT || process.env.GATEWAY_PORT || '3000', 10),
  services: {
    user: {
      name: 'User Service',
      prefix: '/users',
      url: process.env.USER_SERVICE_URL || 'http://localhost:3001',
      timeoutMs: parseInt(process.env.USER_SERVICE_TIMEOUT_MS || '5000', 10)
    },
    product: {
      name: 'Product Service',
      prefix: '/products',
      url: process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002',
      timeoutMs: parseInt(process.env.PRODUCT_SERVICE_TIMEOUT_MS || '5000', 10)
    },
    order: {
      name: 'Order Service',
      prefix: '/orders',
      url: process.env.ORDER_SERVICE_URL || 'http://localhost:3003',
      timeoutMs: parseInt(process.env.ORDER_SERVICE_TIMEOUT_MS || '5000', 10)
    }
  }
};

module.exports = serviceRegistry;
