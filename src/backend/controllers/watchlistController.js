const User = require('../models/User');
const Product = require('../models/Product');

// @desc    Get user's watchlist
// @route   GET /api/watchlist
// @access  Private
exports.getWatchlist = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate({
        path: 'watchlist.productId',
        select: 'title currentPrice url source currency rating imageUrl lastUpdated _id'
      });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Format the response to match the frontend's expected structure
    const items = user.watchlist.map(item => ({
      productId: item.productId._id,
      addedAt: item.addedAt,
      product: item.productId
    }));
    
    res.json({
      success: true,
      items: items,
      watchlist: user.watchlist // Keep for backward compatibility
    });
  } catch (error) {
    console.error('Error getting watchlist:', error);
    res.status(500).json({ 
      message: 'Server error getting watchlist',
      error: error.message 
    });
  }
};

// @desc    Add product to watchlist
// @route   POST /api/watchlist
// @access  Private
exports.addToWatchlist = async (req, res) => {
  try {
    const { productId } = req.body;
    
    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Get user
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Add to watchlist
    await user.addToWatchlist(productId);
    
    res.status(201).json({
      success: true,
      message: 'Product added to watchlist',
      watchlist: user.watchlist
    });
  } catch (error) {
    console.error('Error adding to watchlist:', error);
    res.status(500).json({ 
      message: 'Server error adding to watchlist',
      error: error.message 
    });
  }
};

// @desc    Remove product from watchlist
// @route   DELETE /api/watchlist/:productId
// @access  Private
exports.removeFromWatchlist = async (req, res) => {
  try {
    const { productId } = req.params;
    
    // Get user
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if product exists in watchlist
    const exists = user.watchlist.some(item => 
      item.productId.toString() === productId
    );
    
    if (!exists) {
      return res.status(404).json({ message: 'Product not found in watchlist' });
    }
    
    // Remove from watchlist
    await user.removeFromWatchlist(productId);
    
    res.json({
      success: true,
      message: 'Product removed from watchlist',
      watchlist: user.watchlist
    });
  } catch (error) {
    console.error('Error removing from watchlist:', error);
    res.status(500).json({ 
      message: 'Server error removing from watchlist',
      error: error.message 
    });
  }
};

// @desc    Get watchlist statistics
// @route   GET /api/watchlist/stats
// @access  Private
exports.getWatchlistStats = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate({
        path: 'watchlist.productId',
        select: 'currentPrice priceHistory pricePrediction'
      });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Calculate statistics
    const stats = {
      totalProducts: user.watchlist.length,
      totalValue: 0,
      averagePrice: 0,
      priceChanges: {
        increased: 0,
        decreased: 0,
        unchanged: 0
      },
      predictedSavings: 0
    };
    
    user.watchlist.forEach(item => {
      if (!item.productId) return; // Skip if product doesn't exist
      
      const product = item.productId;
      
      // Add to total value
      stats.totalValue += product.currentPrice;
      
      // Check price changes
      if (product.priceHistory && product.priceHistory.length > 1) {
        const latestPrice = product.currentPrice;
        const previousPrice = product.priceHistory[product.priceHistory.length - 2].price;
        
        if (latestPrice > previousPrice) {
          stats.priceChanges.increased++;
        } else if (latestPrice < previousPrice) {
          stats.priceChanges.decreased++;
        } else {
          stats.priceChanges.unchanged++;
        }
      }
      
      // Add predicted savings
      if (product.pricePrediction && product.pricePrediction.predictions && product.pricePrediction.predictions.length) {
        const lowestPredictedPrice = Math.min(
          ...product.pricePrediction.predictions.map(p => p.price)
        );
        
        if (lowestPredictedPrice < product.currentPrice) {
          stats.predictedSavings += (product.currentPrice - lowestPredictedPrice);
        }
      }
    });
    
    // Calculate average price
    if (stats.totalProducts > 0) {
      stats.averagePrice = stats.totalValue / stats.totalProducts;
    }
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error getting watchlist stats:', error);
    res.status(500).json({ 
      message: 'Server error getting watchlist stats',
      error: error.message 
    });
  }
};