const collectionService = require('../services/collectionService');

// @desc    Get products from a specific collection
// @route   GET /api/collections/:name
// @access  Public
exports.getCollection = async (req, res) => {
  try {
    const { name } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    
    // Check if collection needs updating
    const isStale = await collectionService.isCollectionStale(name);
    
    // If collection is stale, update it in the background
    if (isStale) {
      // Define search terms mapping
      const searchTerms = {
        'trending': 'trending',
        'discount-deals': 'discount deals',
        'new-arrivals': 'new release',
        'top-rated': 'best seller'
      };
      
      // Get the search term for this collection
      const searchTerm = searchTerms[name] || name;
      
      // Update in background to not delay response
      setTimeout(async () => {
        await collectionService.updateCollection(name, searchTerm);
      }, 0);
      
      console.log(`Collection ${name} is stale, updating in background`);
    }
    
    // Get current collection data
    const { products, lastUpdated } = await collectionService.getCollection(name, limit);
    
    res.json({
      success: true,
      collection: name,
      products,
      lastUpdated,
      isUpdating: isStale
    });
  } catch (error) {
    console.error(`Error getting collection ${req.params.name}:`, error);
    res.status(500).json({ 
      success: false,
      message: 'Error retrieving collection data',
      error: error.message 
    });
  }
};

// @desc    Get all available collections
// @route   GET /api/collections
// @access  Public
exports.getAllCollections = async (req, res) => {
  try {
    const collections = await collectionService.getAllCollections();
    
    res.json({
      success: true,
      collections
    });
  } catch (error) {
    console.error('Error getting all collections:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error retrieving collections',
      error: error.message 
    });
  }
};

// @desc    Force refresh a collection
// @route   POST /api/collections/:name/refresh
// @access  Private/Admin
exports.refreshCollection = async (req, res) => {
  try {
    const { name } = req.params;
    const { searchTerm } = req.body;
    
    if (!searchTerm) {
      return res.status(400).json({
        success: false,
        message: 'Search term is required'
      });
    }
    
    // Update collection
    const success = await collectionService.updateCollection(name, searchTerm);
    
    if (success) {
      res.json({
        success: true,
        message: `Collection ${name} refreshed successfully`
      });
    } else {
      res.status(400).json({
        success: false,
        message: `Failed to refresh collection ${name}`
      });
    }
  } catch (error) {
    console.error(`Error refreshing collection ${req.params.name}:`, error);
    res.status(500).json({ 
      success: false,
      message: 'Error refreshing collection',
      error: error.message 
    });
  }
}; 