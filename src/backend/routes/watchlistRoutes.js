const express = require('express');
const router = express.Router();
const watchlistController = require('../controllers/watchlistController');
const auth = require('../middleware/auth');

// All routes require authentication
router.use(auth);

// Get user's watchlist
router.get('/', watchlistController.getWatchlist);

// Add product to watchlist
router.post('/', watchlistController.addToWatchlist);

// Remove product from watchlist
router.delete('/:productId', watchlistController.removeFromWatchlist);

// Get watchlist statistics
router.get('/stats', watchlistController.getWatchlistStats);

module.exports = router; 