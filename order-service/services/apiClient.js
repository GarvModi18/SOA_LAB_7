const axios = require('axios');

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:3001';
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://product-service:3002';
const REQUEST_TIMEOUT_MS = parseInt(process.env.SERVICE_TIMEOUT_MS || '4000', 10);

/**
 * Fetch User data from User Microservice
 * @param {string} userId 
 */
async function fetchUserById(userId) {
  const url = `${USER_SERVICE_URL}/users/${userId}`;
  try {
    const response = await axios.get(url, {
      timeout: REQUEST_TIMEOUT_MS,
      headers: { 'Accept': 'application/json' }
    });
    return {
      success: true,
      data: response.data.data || response.data
    };
  } catch (error) {
    if (error.response) {
      // Remote service responded with 4xx or 5xx
      if (error.response.status === 404) {
        return {
          success: false,
          status: 404,
          error: 'User Not Found',
          message: `User with ID '${userId}' was not found in User Service (${USER_SERVICE_URL})`
        };
      }
      return {
        success: false,
        status: error.response.status,
        error: 'User Service Error',
        message: error.response.data?.message || 'Error returned by User Service'
      };
    } else {
      // Network failure, connection refused, or timeout
      return {
        success: false,
        status: 503,
        error: 'Service Unavailable',
        message: `User Service is currently unreachable at ${USER_SERVICE_URL}. Verify user-service container is running.`,
        dependency: 'user-service',
        details: error.code || error.message
      };
    }
  }
}

/**
 * Fetch Product data from Product Microservice
 * @param {string} productId 
 */
async function fetchProductById(productId) {
  const url = `${PRODUCT_SERVICE_URL}/products/${productId}`;
  try {
    const response = await axios.get(url, {
      timeout: REQUEST_TIMEOUT_MS,
      headers: { 'Accept': 'application/json' }
    });
    return {
      success: true,
      data: response.data.data || response.data
    };
  } catch (error) {
    if (error.response) {
      if (error.response.status === 404) {
        return {
          success: false,
          status: 404,
          error: 'Product Not Found',
          message: `Product with ID '${productId}' was not found in Product Service (${PRODUCT_SERVICE_URL})`
        };
      }
      return {
        success: false,
        status: error.response.status,
        error: 'Product Service Error',
        message: error.response.data?.message || 'Error returned by Product Service'
      };
    } else {
      return {
        success: false,
        status: 503,
        error: 'Service Unavailable',
        message: `Product Service is currently unreachable at ${PRODUCT_SERVICE_URL}. Verify product-service container is running.`,
        dependency: 'product-service',
        details: error.code || error.message
      };
    }
  }
}

module.exports = {
  fetchUserById,
  fetchProductById,
  USER_SERVICE_URL,
  PRODUCT_SERVICE_URL
};
