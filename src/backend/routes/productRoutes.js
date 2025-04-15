const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// Get supported currencies
router.get('/currencies', productController.getSupportedCurrencies);

// Search products
router.get('/search', productController.searchProducts);

// Get product by ID
router.get('/:id', productController.getProductById);

// Get price history for a product
router.get('/:id/price-history', productController.getPriceHistory);

// Update product price (for testing)
router.post('/:id/update-price', productController.updatePrice);

module.exports = router; 