const express = require('express');
const router = express.Router();

// Load services with error handling
let pricePredictionService;
let sentimentAnalysisService;

try {
  pricePredictionService = require('../services/ai/pricePredictionService');
} catch (error) {
  console.error('Warning: Price prediction service could not be loaded:', error.message);
  // Create a fallback service that returns mock data
  pricePredictionService = {
    predictPrice: async (productId) => {
      return {
        productId,
        currentPrice: 100,
        currency: 'USD',
        predictions: Array.from({ length: 7 }, (_, i) => ({
          date: new Date(Date.now() + i * 86400000),
          price: 100 - (Math.random() * 5) + (i * 0.5),
          currency: 'USD'
        })),
        accuracy: 0.7
      };
    },
    getPriceInsights: async (productId) => {
      return {
        productId,
        statistics: {
          minPrice: 95,
          maxPrice: 105,
          avgPrice: 100,
          volatility: 2.5,
          trend: -1.2
        },
        predictions: Array.from({ length: 7 }, (_, i) => ({
          date: new Date(Date.now() + i * 86400000),
          price: 100 - (Math.random() * 5) + (i * 0.5),
          currency: 'USD'
        }))
      };
    }
  };
}

try {
  sentimentAnalysisService = require('../services/ai/sentimentAnalysisService');
} catch (error) {
  console.error('Warning: Sentiment analysis service could not be loaded:', error.message);
  // Create a fallback service
  sentimentAnalysisService = {
    analyzeProductReviews: async (productId) => {
      return {
        productId,
        metrics: {
          averageSentiment: 0.4,
          totalReviews: 5,
          sentimentDistribution: {
            positive: 3,
            neutral: 1,
            negative: 1
          }
        },
        keyPhrases: [
          { term: 'quality', score: 0.8 },
          { term: 'value', score: 0.6 }
        ],
        topics: [
          { topic: 'quality', count: 3 },
          { topic: 'price', count: 2 }
        ]
      };
    },
    getReviewInsights: async (productId) => {
      return {
        productId,
        metrics: {
          averageSentiment: 0.4,
          totalReviews: 5
        },
        trends: {
          sentiment: [
            { date: new Date(Date.now() - 30 * 86400000), sentiment: 0.2 },
            { date: new Date(), sentiment: 0.4 }
          ],
          volume: [
            { month: '2023-02', count: 2 },
            { month: '2023-03', count: 3 }
          ]
        }
      };
    }
  };
}

// Price prediction routes
router.get('/predictions/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const predictions = await pricePredictionService.predictPrice(productId);
    res.json(predictions);
  } catch (error) {
    console.error('Error getting price predictions:', error);
    
    // Return a user-friendly error message
    if (error.message && error.message.includes('Insufficient price history')) {
      return res.status(400).json({ 
        message: 'Not enough price history data to make predictions yet. Please check back later when more data is available.',
        error: 'insufficient_data'
      });
    }
    
    res.status(500).json({ 
      message: 'Unable to generate price predictions at this time',
      error: error.message 
    });
  }
});

router.get('/insights/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const insights = await pricePredictionService.getPriceInsights(productId);
    res.json(insights);
  } catch (error) {
    console.error('Error getting price insights:', error);
    
    if (error.message && error.message.includes('Insufficient price history')) {
      return res.status(400).json({ 
        message: 'Not enough price history data to provide insights yet. Please check back later when more data is available.',
        error: 'insufficient_data'
      });
    }
    
    res.status(500).json({ 
      message: 'Unable to generate price insights at this time',
      error: error.message 
    });
  }
});

router.post('/train/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const result = await pricePredictionService.trainModel(productId);
    res.json(result);
  } catch (error) {
    console.error('Error training price prediction model:', error);
    res.status(500).json({ 
      message: 'Error training price prediction model',
      error: error.message 
    });
  }
});

// Sentiment analysis routes
router.get('/sentiment/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const analysis = await sentimentAnalysisService.analyzeProductReviews(productId);
    res.json(analysis);
  } catch (error) {
    console.error('Error analyzing product reviews:', error);
    
    if (error.message && error.message.includes('No reviews found')) {
      return res.status(400).json({ 
        message: 'This product has no reviews to analyze yet',
        error: 'no_reviews'
      });
    }
    
    res.status(500).json({ 
      message: 'Unable to analyze product reviews at this time',
      error: error.message 
    });
  }
});

router.get('/reviews/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const insights = await sentimentAnalysisService.getReviewInsights(productId);
    res.json(insights);
  } catch (error) {
    console.error('Error getting review insights:', error);
    
    if (error.message && error.message.includes('No reviews found')) {
      return res.status(400).json({ 
        message: 'This product has no reviews to analyze yet',
        error: 'no_reviews'
      });
    }
    
    res.status(500).json({ 
      message: 'Unable to get review insights at this time',
      error: error.message 
    });
  }
});

module.exports = router; 