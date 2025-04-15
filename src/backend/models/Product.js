const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  date: {
    type: Date,
    default: Date.now
  },
  sentimentScore: {
    type: Number,
    default: 0
  },
  lengthScore: {
    type: Number,
    default: 0
  },
  overallScore: {
    type: Number,
    default: 0
  }
});

const priceHistorySchema = new mongoose.Schema({
  price: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    required: true,
    default: 'USD',
    uppercase: true
  },
  date: {
    type: Date,
    default: Date.now
  }
});

const productSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    index: true
  },
  currentPrice: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    required: true,
    default: 'USD',
    uppercase: true
  },
  url: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String,
    default: ''
  },
  source: {
    type: String,
    required: true
  },
  siteProductId: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    default: 0
  },
  priceHistory: [priceHistorySchema],
  reviews: [reviewSchema],
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  pricePrediction: {
    lastPrediction: Date,
    predictions: [{
      date: Date,
      price: Number,
      currency: {
        type: String,
        default: 'USD',
        uppercase: true
      }
    }],
    accuracy: Number
  },
  sentimentAnalysis: {
    averageSentiment: Number,
    averageOverallScore: Number,
    totalReviews: Number,
    sentimentDistribution: {
      positive: Number,
      neutral: Number,
      negative: Number
    },
    keyPhrases: [{
      term: String,
      score: Number
    }],
    topics: [{
      topic: String,
      count: Number
    }],
    lastUpdated: Date
  }
});

// Create compound index for source and siteProductId
productSchema.index({ source: 1, siteProductId: 1 }, { unique: true });

// Create text index for title
productSchema.index({ title: 'text' });

// Method to add a price to history
productSchema.methods.addPriceToHistory = async function(price, currency = this.currency) {
  this.priceHistory.push({
    price,
    currency,
    date: new Date()
  });
  this.currentPrice = price;
  this.currency = currency;
  this.lastUpdated = new Date();
  await this.save();
};

// Method to add a review
productSchema.methods.addReview = async function(review) {
  this.reviews.push({
    ...review,
    date: new Date()
  });
  await this.save();
};

// Method to update sentiment analysis
productSchema.methods.updateSentimentAnalysis = async function(analysis) {
  this.sentimentAnalysis = {
    ...analysis,
    lastUpdated: new Date()
  };
  await this.save();
};

// Method to update price predictions
productSchema.methods.updatePricePrediction = async function(predictions, accuracy, currency = this.currency) {
  this.pricePrediction = {
    lastPrediction: new Date(),
    predictions: predictions.map(pred => ({
      ...pred,
      currency
    })),
    accuracy
  };
  await this.save();
};

const Product = mongoose.model('Product', productSchema);

module.exports = Product; 