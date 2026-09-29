const Order = require('../models/Order');
const { fetchUserById, fetchProductById, USER_SERVICE_URL, PRODUCT_SERVICE_URL } = require('../services/apiClient');

// @desc    Get all orders
// @route   GET /orders
// @access  Public
exports.getAllOrders = async (req, res, next) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      service: 'order-service',
      count: orders.length,
      data: orders
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single order by ID (with live resolution if requested)
// @route   GET /orders/:id
// @access  Public
exports.getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        service: 'order-service',
        error: 'Not Found',
        message: `Order with ID '${req.params.id}' not found`
      });
    }

    res.status(200).json({
      success: true,
      service: 'order-service',
      data: order
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        service: 'order-service',
        error: 'Not Found',
        message: `Invalid Order ID format: '${req.params.id}'`
      });
    }
    next(error);
  }
};

// @desc    Create new order with Inter-Service Validation (Order -> User Service & Order -> Product Service)
// @route   POST /orders
// @access  Public
exports.createOrder = async (req, res, next) => {
  try {
    const { userId, productId, quantity = 1, shippingAddress } = req.body;

    // Basic Input Validation
    if (!userId) {
      return res.status(400).json({
        success: false,
        service: 'order-service',
        error: 'Bad Request',
        message: 'userId is required to place an order'
      });
    }

    if (!productId) {
      return res.status(400).json({
        success: false,
        service: 'order-service',
        error: 'Bad Request',
        message: 'productId is required to place an order'
      });
    }

    const orderQty = parseInt(quantity, 10);
    if (isNaN(orderQty) || orderQty < 1) {
      return res.status(400).json({
        success: false,
        service: 'order-service',
        error: 'Bad Request',
        message: 'Quantity must be a positive integer >= 1'
      });
    }

    console.log(`[Order Service] 🔍 Step 1: Validating user '${userId}' with User Service (${USER_SERVICE_URL})...`);
    // 1. Inter-Service Call: Validate User
    const userResult = await fetchUserById(userId);
    if (!userResult.success) {
      console.warn(`[Order Service] ⚠️ User validation failed:`, userResult);
      return res.status(userResult.status || 500).json({
        success: false,
        service: 'order-service',
        error: userResult.error,
        message: userResult.message,
        dependency: userResult.dependency
      });
    }
    const user = userResult.data;
    console.log(`[Order Service] ✅ User validated successfully: ${user.name} (${user.email})`);

    console.log(`[Order Service] 🔍 Step 2: Validating product '${productId}' with Product Service (${PRODUCT_SERVICE_URL})...`);
    // 2. Inter-Service Call: Validate Product
    const productResult = await fetchProductById(productId);
    if (!productResult.success) {
      console.warn(`[Order Service] ⚠️ Product validation failed:`, productResult);
      return res.status(productResult.status || 500).json({
        success: false,
        service: 'order-service',
        error: productResult.error,
        message: productResult.message,
        dependency: productResult.dependency
      });
    }
    const product = productResult.data;
    console.log(`[Order Service] ✅ Product validated successfully: ${product.name} @ $${product.price}`);

    // Check inventory stock
    if (product.stock !== undefined && product.stock < orderQty) {
      return res.status(400).json({
        success: false,
        service: 'order-service',
        error: 'Insufficient Stock',
        message: `Requested quantity (${orderQty}) exceeds available stock (${product.stock}) for '${product.name}'`
      });
    }

    // 3. Compute Totals
    const unitPrice = product.price;
    const totalAmount = parseFloat((unitPrice * orderQty).toFixed(2));

    // 4. Create Order Record in Order DB
    const newOrder = await Order.create({
      userId: user._id || user.id || userId,
      productId: product._id || product.id || productId,
      quantity: orderQty,
      unitPrice,
      totalAmount,
      status: 'confirmed',
      shippingAddress: shippingAddress || `${user.department || 'Campus'} - Room / Drop point`,
      userSnapshot: {
        name: user.name,
        email: user.email,
        department: user.department
      },
      productSnapshot: {
        name: product.name,
        category: product.category,
        price: product.price
      }
    });

    console.log(`[Order Service] 🎉 Order created successfully with ID: ${newOrder._id}`);

    res.status(201).json({
      success: true,
      service: 'order-service',
      message: 'Order created and verified across microservices successfully',
      data: newOrder
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update order status
// @route   PUT /orders/:id/status
// @access  Public
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ['pending', 'confirmed', 'processing', 'completed', 'cancelled'];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        service: 'order-service',
        error: 'Bad Request',
        message: `Invalid status. Allowed values: ${allowedStatuses.join(', ')}`
      });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        service: 'order-service',
        error: 'Not Found',
        message: `Order with ID '${req.params.id}' not found`
      });
    }

    res.status(200).json({
      success: true,
      service: 'order-service',
      message: 'Order status updated successfully',
      data: order
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        service: 'order-service',
        error: 'Not Found',
        message: `Invalid Order ID format: '${req.params.id}'`
      });
    }
    next(error);
  }
};

// @desc    Delete / Cancel order
// @route   DELETE /orders/:id
// @access  Public
exports.deleteOrder = async (req, res, next) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        service: 'order-service',
        error: 'Not Found',
        message: `Order with ID '${req.params.id}' not found`
      });
    }
    res.status(200).json({
      success: true,
      service: 'order-service',
      message: 'Order deleted successfully',
      data: { id: req.params.id }
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        service: 'order-service',
        error: 'Not Found',
        message: `Invalid Order ID format: '${req.params.id}'`
      });
    }
    next(error);
  }
};
