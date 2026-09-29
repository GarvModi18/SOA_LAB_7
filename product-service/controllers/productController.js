const Product = require('../models/Product');

// @desc    Get all products
// @route   GET /products
// @access  Public
exports.getAllProducts = async (req, res, next) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      service: 'product-service',
      count: products.length,
      data: products
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single product by ID
// @route   GET /products/:id
// @access  Public
exports.getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        service: 'product-service',
        error: 'Not Found',
        message: `Product with ID '${req.params.id}' not found`
      });
    }
    res.status(200).json({
      success: true,
      service: 'product-service',
      data: product
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        service: 'product-service',
        error: 'Not Found',
        message: `Invalid Product ID format: '${req.params.id}'`
      });
    }
    next(error);
  }
};

// @desc    Create new product
// @route   POST /products
// @access  Public
exports.createProduct = async (req, res, next) => {
  try {
    const { name, category, price, stock, description } = req.body;
    const product = await Product.create({ name, category, price, stock, description });
    res.status(201).json({
      success: true,
      service: 'product-service',
      message: 'Product created successfully',
      data: product
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        service: 'product-service',
        error: 'Validation Error',
        message: messages.join(', ')
      });
    }
    next(error);
  }
};

// @desc    Update product
// @route   PUT /products/:id
// @access  Public
exports.updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!product) {
      return res.status(404).json({
        success: false,
        service: 'product-service',
        error: 'Not Found',
        message: `Product with ID '${req.params.id}' not found`
      });
    }
    res.status(200).json({
      success: true,
      service: 'product-service',
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        service: 'product-service',
        error: 'Not Found',
        message: `Invalid Product ID format: '${req.params.id}'`
      });
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        service: 'product-service',
        error: 'Validation Error',
        message: messages.join(', ')
      });
    }
    next(error);
  }
};

// @desc    Delete product
// @route   DELETE /products/:id
// @access  Public
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        service: 'product-service',
        error: 'Not Found',
        message: `Product with ID '${req.params.id}' not found`
      });
    }
    res.status(200).json({
      success: true,
      service: 'product-service',
      message: 'Product deleted successfully',
      data: { id: req.params.id }
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        service: 'product-service',
        error: 'Not Found',
        message: `Invalid Product ID format: '${req.params.id}'`
      });
    }
    next(error);
  }
};
