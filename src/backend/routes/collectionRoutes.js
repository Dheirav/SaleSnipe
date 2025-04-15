const express = require('express');
const router = express.Router();
const collectionController = require('../controllers/collectionController');
const { protect, admin } = require('../middleware/authMiddleware');

// Get all collections
router.get('/', collectionController.getAllCollections);

// Get a specific collection
router.get('/:name', collectionController.getCollection);

// Force refresh a collection (admin only)
router.post('/:name/refresh', protect, admin, collectionController.refreshCollection);

module.exports = router; 