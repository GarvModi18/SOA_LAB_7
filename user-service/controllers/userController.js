const User = require('../models/User');

// @desc    Get all users
// @route   GET /users
// @access  Public
exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      service: 'user-service',
      count: users.length,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single user by ID
// @route   GET /users/:id
// @access  Public
exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        service: 'user-service',
        error: 'Not Found',
        message: `User with ID '${req.params.id}' not found`
      });
    }
    res.status(200).json({
      success: true,
      service: 'user-service',
      data: user
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        service: 'user-service',
        error: 'Not Found',
        message: `Invalid User ID format: '${req.params.id}'`
      });
    }
    next(error);
  }
};

// @desc    Create new user
// @route   POST /users
// @access  Public
exports.createUser = async (req, res, next) => {
  try {
    const { name, email, role, department, phone } = req.body;
    const user = await User.create({ name, email, role, department, phone });
    res.status(201).json({
      success: true,
      service: 'user-service',
      message: 'User created successfully',
      data: user
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        service: 'user-service',
        error: 'Duplicate Key Error',
        message: 'A user with this email already exists'
      });
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        service: 'user-service',
        error: 'Validation Error',
        message: messages.join(', ')
      });
    }
    next(error);
  }
};

// @desc    Update user
// @route   PUT /users/:id
// @access  Public
exports.updateUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        service: 'user-service',
        error: 'Not Found',
        message: `User with ID '${req.params.id}' not found`
      });
    }
    res.status(200).json({
      success: true,
      service: 'user-service',
      message: 'User updated successfully',
      data: user
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        service: 'user-service',
        error: 'Not Found',
        message: `Invalid User ID format: '${req.params.id}'`
      });
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        service: 'user-service',
        error: 'Validation Error',
        message: messages.join(', ')
      });
    }
    next(error);
  }
};

// @desc    Delete user
// @route   DELETE /users/:id
// @access  Public
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        service: 'user-service',
        error: 'Not Found',
        message: `User with ID '${req.params.id}' not found`
      });
    }
    res.status(200).json({
      success: true,
      service: 'user-service',
      message: 'User deleted successfully',
      data: { id: req.params.id }
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        service: 'user-service',
        error: 'Not Found',
        message: `Invalid User ID format: '${req.params.id}'`
      });
    }
    next(error);
  }
};
