const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');
const auth = require('../middleware/auth');

// All routes require authentication
router.use(auth);

// Create a new price alert
router.post('/', alertController.createAlert);

// Get all alerts for user
router.get('/', alertController.getAlerts);

// Update alert
router.put('/:id', alertController.updateAlert);

// Delete alert
router.delete('/:id', alertController.deleteAlert);

module.exports = router; 