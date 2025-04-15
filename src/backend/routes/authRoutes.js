const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');

// Register a new user
router.post('/register', authController.register);

// Login user
router.post('/login', authController.login);

// Get current user profile - protected route
router.get('/me', auth, authController.getCurrentUser);

// Update user profile - protected route
router.put('/me', auth, authController.updateUserProfile);

module.exports = router; 