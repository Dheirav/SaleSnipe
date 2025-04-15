const tf = require('@tensorflow/tfjs-node');
const Product = require('../../models/Product');

class PricePredictionService {
  constructor() {
    this.model = null;
    this.isModelLoaded = false;
    this.sequenceLength = 30; // Number of days to use for prediction
    this.predictionDays = 7; // Number of days to predict ahead
  }

  async initialize() {
    try {
      // Create and compile the model
      this.model = tf.sequential({
        layers: [
          tf.layers.lstm({
            units: 50,
            returnSequences: true,
            inputShape: [this.sequenceLength, 1]
          }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.lstm({ units: 30, returnSequences: false }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({ units: this.predictionDays })
        ]
      });

      this.model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'meanSquaredError'
      });

      this.isModelLoaded = true;
      console.log('Price prediction model initialized successfully');
    } catch (error) {
      console.error('Error initializing price prediction model:', error);
      throw error;
    }
  }

  async prepareData(priceHistory) {
    try {
      // Sort price history by date
      const sortedHistory = priceHistory.sort((a, b) => a.date - b.date);
      
      // Extract prices and normalize them
      const prices = sortedHistory.map(entry => entry.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      
      // Normalize prices to [0, 1] range
      const normalizedPrices = prices.map(price => 
        (price - minPrice) / (maxPrice - minPrice)
      );

      // Create sequences for training
      const sequences = [];
      const targets = [];

      for (let i = 0; i < normalizedPrices.length - this.sequenceLength - this.predictionDays + 1; i++) {
        sequences.push(normalizedPrices.slice(i, i + this.sequenceLength));
        targets.push(normalizedPrices.slice(i + this.sequenceLength, i + this.sequenceLength + this.predictionDays));
      }

      return {
        sequences: tf.tensor3d(sequences, [sequences.length, this.sequenceLength, 1]),
        targets: tf.tensor2d(targets, [targets.length, this.predictionDays]),
        minPrice,
        maxPrice
      };
    } catch (error) {
      console.error('Error preparing data for price prediction:', error);
      throw error;
    }
  }

  async trainModel(productId) {
    try {
      if (!this.isModelLoaded) {
        await this.initialize();
      }

      // Get product price history
      const product = await Product.findById(productId);
      if (!product || !product.priceHistory || product.priceHistory.length < this.sequenceLength + this.predictionDays) {
        throw new Error('Insufficient price history data for training');
      }

      const { sequences, targets, minPrice, maxPrice } = await this.prepareData(product.priceHistory);

      // Train the model
      await this.model.fit(sequences, targets, {
        epochs: 100,
        batchSize: 32,
        validationSplit: 0.2,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            if (epoch % 10 === 0) {
              console.log(`Epoch ${epoch}: loss = ${logs.loss.toFixed(4)}`);
            }
          }
        }
      });

      // Save the model
      await this.model.save(`file://./models/price_prediction_${productId}`);

      return {
        message: 'Model trained successfully',
        productId,
        minPrice,
        maxPrice
      };
    } catch (error) {
      console.error('Error training price prediction model:', error);
      throw error;
    }
  }

  async predictPrice(productId) {
    try {
      if (!this.isModelLoaded) {
        await this.initialize();
      }

      // Get product price history
      const product = await Product.findById(productId);
      if (!product || !product.priceHistory || product.priceHistory.length < this.sequenceLength) {
        throw new Error('Insufficient price history data for prediction');
      }

      // Prepare the input sequence
      const recentPrices = product.priceHistory
        .sort((a, b) => a.date - b.date)
        .slice(-this.sequenceLength)
        .map(entry => entry.price);

      const minPrice = Math.min(...recentPrices);
      const maxPrice = Math.max(...recentPrices);

      // Normalize the input sequence
      const normalizedInput = recentPrices.map(price => 
        (price - minPrice) / (maxPrice - minPrice)
      );

      // Make prediction
      const inputTensor = tf.tensor3d([normalizedInput], [1, this.sequenceLength, 1]);
      const prediction = this.model.predict(inputTensor);
      const predictedPrices = await prediction.array();

      // Denormalize predictions
      const denormalizedPredictions = predictedPrices[0].map(price => 
        price * (maxPrice - minPrice) + minPrice
      );

      // Generate dates for predictions
      const lastDate = new Date(product.priceHistory[product.priceHistory.length - 1].date);
      const predictions = denormalizedPredictions.map((price, index) => {
        const date = new Date(lastDate);
        date.setDate(date.getDate() + index + 1);
        return {
          date,
          price: Math.round(price * 100) / 100 // Round to 2 decimal places
        };
      });

      return {
        productId,
        currentPrice: product.currentPrice,
        predictions
      };
    } catch (error) {
      console.error('Error making price prediction:', error);
      throw error;
    }
  }

  async getPriceInsights(productId) {
    try {
      const product = await Product.findById(productId);
      if (!product || !product.priceHistory || product.priceHistory.length < 2) {
        throw new Error('Insufficient price history data for insights');
      }

      const priceHistory = product.priceHistory.sort((a, b) => a.date - b.date);
      const prices = priceHistory.map(entry => entry.price);
      
      // Calculate basic statistics
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      
      // Calculate price volatility
      const priceChanges = prices.slice(1).map((price, i) => 
        ((price - prices[i]) / prices[i]) * 100
      );
      const volatility = Math.sqrt(
        priceChanges.reduce((sum, change) => sum + change * change, 0) / priceChanges.length
      );

      // Calculate price trend
      const recentPrices = prices.slice(-30); // Last 30 days
      const trend = recentPrices.length > 1 
        ? ((recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0]) * 100
        : 0;

      // Get price predictions
      const predictions = await this.predictPrice(productId);

      return {
        productId,
        currentPrice: product.currentPrice,
        statistics: {
          minPrice,
          maxPrice,
          avgPrice,
          volatility,
          trend
        },
        predictions: predictions.predictions
      };
    } catch (error) {
      console.error('Error getting price insights:', error);
      throw error;
    }
  }
}

module.exports = new PricePredictionService(); 