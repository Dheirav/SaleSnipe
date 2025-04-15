const axios = require('axios');

class CurrencyService {
  constructor() {
    this.baseUrl = 'https://api.exchangerate-api.com/v4/latest';
    this.supportedCurrencies = [
      'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'INR', 'NZD', 
      'BRL', 'MXN', 'SGD', 'HKD', 'SEK', 'NOK', 'KRW', 'TRY', 'RUB', 'ZAR'
    ];
    this.cache = new Map();
    this.cacheExpiry = 3600000; // 1 hour in milliseconds
  }

  async getSupportedCurrencies() {
    return this.supportedCurrencies;
  }

  async getExchangeRate(fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) {
      return 1;
    }

    const cacheKey = `${fromCurrency}-${toCurrency}`;
    const cachedRate = this.getCachedRate(cacheKey);
    
    if (cachedRate) {
      return cachedRate;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/${fromCurrency}`);
      const rates = response.data.rates;
      
      // Cache all rates for this base currency
      Object.entries(rates).forEach(([currency, rate]) => {
        this.cacheRate(`${fromCurrency}-${currency}`, rate);
      });
      
      return rates[toCurrency];
    } catch (error) {
      console.error(`Error fetching exchange rate from ${fromCurrency} to ${toCurrency}:`, error);
      throw new Error(`Failed to get exchange rate: ${error.message}`);
    }
  }

  async convertPrice(price, fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) {
      return price;
    }

    const rate = await this.getExchangeRate(fromCurrency, toCurrency);
    return Math.round(price * rate * 100) / 100; // Round to 2 decimal places
  }

  // New method to validate prices across different currencies
  isPriceReasonable(price, currency) {
    // Define reasonable price ranges for different currencies
    const priceRanges = {
      USD: { min: 0.01, max: 1000000 },
      EUR: { min: 0.01, max: 900000 },
      GBP: { min: 0.01, max: 800000 },
      JPY: { min: 1, max: 150000000 },
      AUD: { min: 0.01, max: 1500000 },
      CAD: { min: 0.01, max: 1300000 },
      CHF: { min: 0.01, max: 900000 },
      CNY: { min: 0.01, max: 7000000 },
      INR: { min: 0.01, max: 83000000 },
      NZD: { min: 0.01, max: 1600000 },
      BRL: { min: 0.01, max: 5000000 },
      MXN: { min: 0.01, max: 17000000 },
      SGD: { min: 0.01, max: 1300000 },
      HKD: { min: 0.01, max: 7800000 },
      SEK: { min: 0.01, max: 10000000 },
      NOK: { min: 0.01, max: 10000000 },
      KRW: { min: 1, max: 1300000000 },
      TRY: { min: 0.01, max: 30000000 },
      RUB: { min: 0.01, max: 90000000 },
      ZAR: { min: 0.01, max: 15000000 }
    };

    const range = priceRanges[currency] || priceRanges.USD;
    return price >= range.min && price <= range.max;
  }

  async convertProductPrices(product, targetCurrency) {
    if (!product) return null;
    
    const convertedProduct = { ...product.toObject() };
    
    // Store original currency and price
    convertedProduct.originalCurrency = product.currency;
    convertedProduct.originalPrice = product.currentPrice;
    
    // Convert current price
    if (product.currency !== targetCurrency) {
      convertedProduct.currentPrice = await this.convertPrice(
        product.currentPrice, 
        product.currency, 
        targetCurrency
      );
      convertedProduct.currency = targetCurrency;
    }
    
    // Validate the converted price
    if (!this.isPriceReasonable(convertedProduct.currentPrice, targetCurrency)) {
      console.log(`Warning: Unreasonable price after conversion for product ${product.title}: ${convertedProduct.currentPrice} ${targetCurrency}`);
      // Keep the original price if the converted price is unreasonable
      convertedProduct.currentPrice = product.currentPrice;
      convertedProduct.currency = product.currency;
      convertedProduct.originalCurrency = null;
      convertedProduct.originalPrice = null;
    }
    
    // Convert price history
    if (product.priceHistory && product.priceHistory.length > 0) {
      convertedProduct.priceHistory = await Promise.all(
        product.priceHistory.map(async (entry) => {
          if (entry.currency === targetCurrency) {
            return entry;
          }
          
          const convertedPrice = await this.convertPrice(entry.price, entry.currency, targetCurrency);
          // Only convert if the price is reasonable
          if (this.isPriceReasonable(convertedPrice, targetCurrency)) {
            return {
              ...entry,
              price: convertedPrice,
              currency: targetCurrency,
              originalCurrency: entry.currency,
              originalPrice: entry.price
            };
          }
          // Keep original price if conversion results in unreasonable price
          return {
            ...entry,
            originalCurrency: null,
            originalPrice: null
          };
        })
      );
    }
    
    // Convert price predictions if they exist
    if (product.pricePrediction && product.pricePrediction.predictions) {
      convertedProduct.pricePrediction = {
        ...product.pricePrediction,
        predictions: await Promise.all(
          product.pricePrediction.predictions.map(async (pred) => {
            if (pred.currency === targetCurrency) {
              return pred;
            }
            
            const convertedPrice = await this.convertPrice(pred.price, pred.currency, targetCurrency);
            // Only convert if the price is reasonable
            if (this.isPriceReasonable(convertedPrice, targetCurrency)) {
              return {
                ...pred,
                price: convertedPrice,
                currency: targetCurrency,
                originalCurrency: pred.currency,
                originalPrice: pred.price
              };
            }
            // Keep original price if conversion results in unreasonable price
            return {
              ...pred,
              originalCurrency: null,
              originalPrice: null
            };
          })
        )
      };
    }
    
    return convertedProduct;
  }

  async convertMultipleProducts(products, targetCurrency) {
    if (!Array.isArray(products)) {
      return this.convertProductPrices(products, targetCurrency);
    }
    
    // Group products by source currency to minimize API calls
    const productsByCurrency = {};
    
    products.forEach(product => {
      const currency = product.currency || 'USD';
      if (!productsByCurrency[currency]) {
        productsByCurrency[currency] = [];
      }
      productsByCurrency[currency].push(product);
    });
    
    // Convert each group of products
    const convertedProducts = [];
    
    for (const [sourceCurrency, currencyProducts] of Object.entries(productsByCurrency)) {
      if (sourceCurrency === targetCurrency) {
        convertedProducts.push(...currencyProducts);
        continue;
      }
      
      // Get exchange rate once for all products with the same source currency
      const rate = await this.getExchangeRate(sourceCurrency, targetCurrency);
      
      // Convert all products with this source currency
      const convertedCurrencyProducts = currencyProducts.map(product => {
        const convertedProduct = { ...product.toObject() };
        
        // Convert current price
        convertedProduct.currentPrice = Math.round(product.currentPrice * rate * 100) / 100;
        convertedProduct.currency = targetCurrency;
        
        // Convert price history
        if (product.priceHistory && product.priceHistory.length > 0) {
          convertedProduct.priceHistory = product.priceHistory.map(entry => ({
            ...entry,
            price: Math.round(entry.price * rate * 100) / 100,
            currency: targetCurrency
          }));
        }
        
        // Convert price predictions if they exist
        if (product.pricePrediction && product.pricePrediction.predictions) {
          convertedProduct.pricePrediction = {
            ...product.pricePrediction,
            predictions: product.pricePrediction.predictions.map(pred => ({
              ...pred,
              price: Math.round(pred.price * rate * 100) / 100,
              currency: targetCurrency
            }))
          };
        }
        
        return convertedProduct;
      });
      
      convertedProducts.push(...convertedCurrencyProducts);
    }
    
    return convertedProducts;
  }

  // Cache management methods
  getCachedRate(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.cacheExpiry) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.rate;
  }

  cacheRate(key, rate) {
    this.cache.set(key, {
      rate,
      timestamp: Date.now()
    });
  }

  clearCache() {
    this.cache.clear();
  }
}

module.exports = new CurrencyService(); 