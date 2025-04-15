const cron = require('node-cron');
const Product = require('../models/Product');
const scraperService = require('./scraperService');
const notificationService = require('./notificationService');
const pricePredictionService = require('./ai/pricePredictionService');
const sentimentAnalysisService = require('./ai/sentimentAnalysisService');
const collectionService = require('./collectionService');

// Store active jobs
const activeJobs = {};

/**
 * Initialize all cron jobs
 */
exports.initializeJobs = () => {
  console.log('Initializing scheduled tasks...');
  
  // Update product prices - every 4 hours
  activeJobs.priceUpdates = cron.schedule('0 */4 * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running scheduled price updates`);
    try {
      await exports.updateProductPrices();
    } catch (error) {
      console.error('Error in scheduled price update job:', error);
    }
  });
  
  // Check price alerts - every hour
  activeJobs.alertChecks = cron.schedule('0 * * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running scheduled alert checks`);
    try {
      await notificationService.checkPriceAlerts();
    } catch (error) {
      console.error('Error in scheduled alert check job:', error);
    }
  });
  
  // Update price predictions - once per day at 2 AM
  activeJobs.pricePredictions = cron.schedule('0 2 * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running scheduled price prediction updates`);
    try {
      await exports.updatePricePredictions();
    } catch (error) {
      console.error('Error in scheduled price prediction job:', error);
    }
  });
  
  // Update sentiment analysis - once per week on Sunday at 3 AM
  activeJobs.sentimentAnalysis = cron.schedule('0 3 * * 0', async () => {
    console.log(`[${new Date().toISOString()}] Running scheduled sentiment analysis updates`);
    try {
      await exports.updateSentimentAnalysis();
    } catch (error) {
      console.error('Error in scheduled sentiment analysis job:', error);
    }
  });
  
  // Update product collections - every 12 hours
  activeJobs.collectionUpdates = cron.schedule('0 */12 * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running scheduled product collection updates`);
    try {
      await exports.updateProductCollections();
    } catch (error) {
      console.error('Error in scheduled collection update job:', error);
    }
  });
  
  console.log('All scheduled tasks initialized successfully');
};

/**
 * Stop all cron jobs
 */
exports.stopAllJobs = () => {
  console.log('Stopping all scheduled tasks...');
  
  Object.keys(activeJobs).forEach(key => {
    if (activeJobs[key]) {
      activeJobs[key].stop();
      console.log(`Stopped job: ${key}`);
    }
  });
  
  console.log('All scheduled tasks stopped');
};

/**
 * Update prices for all products in the database
 */
exports.updateProductPrices = async () => {
  try {
    console.log('Starting price update for all products...');
    
    // Get all products
    const products = await Product.find({}).select('_id url source siteProductId');
    console.log(`Found ${products.length} products to update`);
    
    const results = {
      total: products.length,
      successful: 0,
      failed: 0,
      unchanged: 0,
      changed: 0
    };
    
    for (const product of products) {
      try {
        console.log(`Updating price for product ${product._id} from ${product.source}`);
        
        // Get latest price from scraper
        const updatedData = await scraperService.updateProductPrice(product._id);
        
        if (updatedData.success) {
          results.successful++;
          
          if (updatedData.priceChanged) {
            results.changed++;
          } else {
            results.unchanged++;
          }
        } else {
          results.failed++;
        }
      } catch (error) {
        console.error(`Error updating product ${product._id}:`, error);
        results.failed++;
      }
      
      // Implement a delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('Price update job completed');
    console.log('Results:', results);
    
    return results;
  } catch (error) {
    console.error('Error in updateProductPrices task:', error);
    throw error;
  }
};

/**
 * Update price predictions for all products
 */
exports.updatePricePredictions = async () => {
  try {
    console.log('Starting price prediction updates...');
    
    // Get products with sufficient price history (at least 5 price points)
    const products = await Product.find({
      'priceHistory.5': { $exists: true }
    }).select('_id');
    
    console.log(`Found ${products.length} products with sufficient history for predictions`);
    
    const results = {
      total: products.length,
      successful: 0,
      failed: 0
    };
    
    for (const product of products) {
      try {
        console.log(`Updating price prediction for product ${product._id}`);
        await pricePredictionService.trainAndPredict(product._id);
        results.successful++;
      } catch (error) {
        console.error(`Error updating prediction for product ${product._id}:`, error);
        results.failed++;
      }
    }
    
    console.log('Price prediction update job completed');
    console.log('Results:', results);
    
    return results;
  } catch (error) {
    console.error('Error in updatePricePredictions task:', error);
    throw error;
  }
};

/**
 * Update sentiment analysis for all products with reviews
 */
exports.updateSentimentAnalysis = async () => {
  try {
    console.log('Starting sentiment analysis updates...');
    
    // Get products with reviews
    const products = await Product.find({
      'reviews.0': { $exists: true }
    }).select('_id');
    
    console.log(`Found ${products.length} products with reviews for sentiment analysis`);
    
    const results = {
      total: products.length,
      successful: 0,
      failed: 0
    };
    
    for (const product of products) {
      try {
        console.log(`Updating sentiment analysis for product ${product._id}`);
        await sentimentAnalysisService.analyzeProductReviews(product._id);
        results.successful++;
      } catch (error) {
        console.error(`Error updating sentiment analysis for product ${product._id}:`, error);
        results.failed++;
      }
    }
    
    console.log('Sentiment analysis update job completed');
    console.log('Results:', results);
    
    return results;
  } catch (error) {
    console.error('Error in updateSentimentAnalysis task:', error);
    throw error;
  }
};

/**
 * Update all product collections
 */
exports.updateProductCollections = async () => {
  try {
    console.log('Starting update for all product collections...');
    
    // Define collections to update with their search terms
    const collections = [
      { name: 'trending', searchTerm: 'trending' },
      { name: 'discount-deals', searchTerm: 'discount deals' },
      { name: 'new-arrivals', searchTerm: 'new release' },
      { name: 'top-rated', searchTerm: 'best seller' }
    ];
    
    const results = {
      total: collections.length,
      successful: 0,
      failed: 0
    };
    
    // Update each collection
    for (const collection of collections) {
      try {
        console.log(`Updating collection: ${collection.name}`);
        const success = await collectionService.updateCollection(collection.name, collection.searchTerm);
        
        if (success) {
          results.successful++;
        } else {
          results.failed++;
        }
        
        // Add delay between collections to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error) {
        console.error(`Error updating collection ${collection.name}:`, error);
        results.failed++;
      }
    }
    
    console.log('Product collections update job completed');
    console.log('Results:', results);
    
    return results;
  } catch (error) {
    console.error('Error in updateProductCollections task:', error);
    throw error;
  }
}; 