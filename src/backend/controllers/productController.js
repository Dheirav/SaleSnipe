const Product = require('../models/Product');
const scraperService = require('../services/scraperService');
const currencyService = require('../services/currencyService');

// Utility function for better logging
function logProductStatus(message, product = null, details = {}) {
  const timestamp = new Date().toISOString();
  const productInfo = product ? `[${product.title || 'Unknown'}]` : '';
  const detailsStr = Object.keys(details).length > 0 
    ? `\n  Details: ${JSON.stringify(details, null, 2)}` 
    : '';
  
  console.log(`[${timestamp}] ${message} ${productInfo}${detailsStr}`);
}

// Get supported currencies
exports.getSupportedCurrencies = async (req, res) => {
  try {
    const currencies = await currencyService.getSupportedCurrencies();
    res.json({
      supportedCurrencies: currencies,
      defaultCurrency: 'USD'
    });
  } catch (error) {
    console.error('Error fetching supported currencies:', error);
    res.status(500).json({ 
      message: 'Error fetching supported currencies',
      error: error.message
    });
  }
};

// Helper function to validate price changes
function isValidPriceChange(oldPrice, newPrice) {
  if (!oldPrice || !newPrice) return false;
  
  // Calculate percentage change
  const percentChange = Math.abs((newPrice - oldPrice) / oldPrice) * 100;
  
  // Reject changes greater than 50% (could be errors or extreme sales)
  return percentChange <= 50;
}

// Helper function to validate new product prices
function isValidNewProductPrice(price) {
  if (!price || price <= 0) return false;
  
  // Reject prices that are unreasonably high (likely errors)
  const maxReasonablePrice = 100000; // $100,000 as a reasonable upper limit
  return price <= maxReasonablePrice;
}

// Helper function to convert product prices
const convertProductPrices = async (product, targetCurrency) => {
  if (!targetCurrency || product.currency === targetCurrency) {
    return product;
  }

  try {
    // Convert current price
    const convertedPrice = await currencyService.convertPrice(
      product.currentPrice,
      product.currency,
      targetCurrency
    );

    // Convert price history
    const convertedHistory = await Promise.all(
      product.priceHistory.map(async (entry) => ({
        price: await currencyService.convertPrice(entry.price, entry.currency, targetCurrency),
        currency: targetCurrency,
        timestamp: entry.timestamp
      }))
    );

    // Convert predicted prices if they exist
    const convertedPredictions = product.predictedPrices ? 
      await Promise.all(
        product.predictedPrices.map(async (pred) => ({
          price: await currencyService.convertPrice(pred.price, pred.currency, targetCurrency),
          currency: targetCurrency,
          date: pred.date,
          confidence: pred.confidence
        }))
      ) : [];

    // Create a new object with converted prices
    return {
      ...product.toObject(),
      currentPrice: convertedPrice,
      currency: targetCurrency,
      imageUrl: product.imageUrl || '',
      priceHistory: convertedHistory,
      predictedPrices: convertedPredictions
    };
  } catch (error) {
    console.error('Error converting prices:', error);
    return product; // Return original product if conversion fails
  }
};

// Search for products
exports.searchProducts = async (req, res) => {
  try {
    const { query, currency } = req.query;
    
    if (!query) {
      return res.status(400).json({ 
        success: false,
        message: 'Query parameter is required',
        products: [] 
      });
    }
    
    // Decode the query parameter if it's URL encoded
    const decodedQuery = decodeURIComponent(query);
    
    logProductStatus(`Starting product search`, null, { query: decodedQuery, currency });
    
    // Validate currency if provided
    if (currency) {
      const supportedCurrencies = await currencyService.getSupportedCurrencies();
      if (!supportedCurrencies.includes(currency.toUpperCase())) {
        return res.status(400).json({ 
          success: false,
          message: 'Invalid currency',
          supportedCurrencies,
          products: [] 
        });
      }
    }

    try {
      // Step 1: Always attempt to scrape new products first
      logProductStatus('Starting web scraping for products...');
      const scrapedProducts = await scraperService.searchAllProducts(decodedQuery);
      logProductStatus(`Scraped ${scrapedProducts.length} products`);

      // Step 2: Process and save scraped products
      logProductStatus('Processing and saving scraped products...');
      const savedProducts = await Promise.all(
        scrapedProducts.map(async (product) => {
          try {
            // Find existing product by source and site-specific ID
            const existingProduct = await Product.findOne({
              source: product.source,
              siteProductId: product.siteProductId
            });
            
            if (existingProduct) {
              // Check for price changes
              if (existingProduct.currentPrice !== product.currentPrice) {
                const percentChange = Math.abs((product.currentPrice - existingProduct.currentPrice) / existingProduct.currentPrice) * 100;
                if (isValidPriceChange(existingProduct.currentPrice, product.currentPrice)) {
                  logProductStatus(`Updating price for existing product`, existingProduct, { 
                    oldPrice: existingProduct.currentPrice, 
                    newPrice: product.currentPrice,
                    percentChange: `${percentChange.toFixed(2)}%`
                  });
                  await existingProduct.addPriceToHistory(product.currentPrice, product.currency);
                  existingProduct.currentPrice = product.currentPrice;
                  existingProduct.currency = product.currency;
                  existingProduct.lastUpdated = new Date();
                  await existingProduct.save();
                }
              }
              return existingProduct;
            }
            
            // Validate initial price for new products
            if (!isValidNewProductPrice(product.currentPrice)) {
              logProductStatus(`Rejected new product with invalid price`, product, { 
                price: product.currentPrice
              });
              return null;
            }

            // Create and save new product
            logProductStatus(`Creating new product`, product);
            const newProduct = new Product({
              ...product,
              priceHistory: [{ price: product.currentPrice, currency: product.currency }],
              lastUpdated: new Date()
            });
            await newProduct.save();
            return newProduct;
          } catch (error) {
            logProductStatus(`Error processing product`, product, { error: error.message });
            return null;
          }
        })
      );

      const validSavedProducts = savedProducts.filter(product => product !== null);

      // Step 3: If no scraped products were found/saved, search the database
      if (validSavedProducts.length === 0) {
        logProductStatus('No new products found, searching database for matches...');
        
        // For database retrieval, use exact title match first
        const exactMatchProducts = await Product.find(
          { title: { $regex: new RegExp(`^${decodedQuery}$`, 'i') } },
          {
            title: 1,
            currentPrice: 1,
            currency: 1,
            url: 1,
            imageUrl: 1,
            source: 1,
            siteProductId: 1,
            rating: 1,
            priceHistory: 1,
            lastUpdated: 1
          }
        )
        .sort({ lastUpdated: -1 })
        .limit(20);
        
        if (exactMatchProducts.length > 0) {
          logProductStatus(`Found ${exactMatchProducts.length} exact matches in database`);
          
          // Convert prices if needed
          const processedProducts = currency
            ? await Promise.all(exactMatchProducts.map(product => convertProductPrices(product, currency)))
            : exactMatchProducts;
          
          return res.json({
            success: true,
            products: processedProducts,
            source: 'database-exact',
            query: decodedQuery,
            currency: currency || 'USD'
          });
        }
        
        // If no exact matches, try partial matches
        logProductStatus('No exact matches found, searching for partial matches...');
        const partialMatchProducts = await Product.find(
          { $text: { $search: decodedQuery } },
          {
            score: { $meta: 'textScore' },
            title: 1,
            currentPrice: 1,
            currency: 1,
            url: 1,
            imageUrl: 1,
            source: 1,
            siteProductId: 1,
            rating: 1,
            priceHistory: 1,
            lastUpdated: 1
          }
        )
        .sort({ score: { $meta: 'textScore' }, lastUpdated: -1 })
        .limit(20);
        
        if (partialMatchProducts.length > 0) {
          logProductStatus(`Found ${partialMatchProducts.length} partial matches in database`);
          
          // Convert prices if needed
          const processedProducts = currency
            ? await Promise.all(partialMatchProducts.map(product => convertProductPrices(product, currency)))
            : partialMatchProducts;
          
          return res.json({
            success: true,
            products: processedProducts,
            source: 'database-partial',
            query: decodedQuery,
            currency: currency || 'USD'
          });
        }
        
        // If still no matches, return empty result
        return res.json({
          success: true,
          products: [],
          source: 'none',
          query: decodedQuery,
          currency: currency || 'USD'
        });
      }
      
      // Return the freshly scraped products
      logProductStatus(`Returning ${validSavedProducts.length} freshly scraped products`);
      
      // Convert prices if needed
      const processedProducts = currency
        ? await Promise.all(validSavedProducts.map(product => convertProductPrices(product, currency)))
        : validSavedProducts;
      
      return res.json({
        success: true,
        products: processedProducts,
        source: 'scraper',
        query: decodedQuery,
        currency: currency || 'USD'
      });
    } catch (scraperError) {
      // If scraping fails, still try to search the database as a fallback
      logProductStatus(`Scraping failed: ${scraperError.message}, falling back to database search`);
      
      try {
        // Search the database as fallback
        const dbProducts = await Product.find(
          { $text: { $search: decodedQuery } },
          {
            score: { $meta: 'textScore' },
            title: 1,
            currentPrice: 1,
            currency: 1,
            url: 1,
            imageUrl: 1,
            source: 1,
            siteProductId: 1,
            rating: 1,
            priceHistory: 1,
            lastUpdated: 1
          }
        )
        .sort({ score: { $meta: 'textScore' }, lastUpdated: -1 })
        .limit(20);
        
        // Convert prices if needed
        const processedProducts = currency
          ? await Promise.all(dbProducts.map(product => convertProductPrices(product, currency)))
          : dbProducts;
        
        return res.json({
          success: true,
          products: processedProducts,
          source: 'database-fallback',
          query: decodedQuery,
          currency: currency || 'USD',
          notice: 'Live scraping failed, showing cached results'
        });
      } catch (dbError) {
        // Both scraping and database search failed
        logProductStatus(`Database search also failed: ${dbError.message}`);
        throw new Error(`Search failed: ${scraperError.message}; Database fallback failed: ${dbError.message}`);
      }
    }
  } catch (error) {
    console.error('Error searching products:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error searching products',
      error: error.message,
      products: []
    });
  }
};

// Get product by ID
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Convert price if currency is specified
    let productToReturn = product;
    if (req.query.currency) {
      productToReturn = await convertProductPrices(product, req.query.currency);
    }
    
    res.json({
      product: productToReturn,
      supportedCurrencies: await currencyService.getSupportedCurrencies()
    });
  } catch (error) {
    console.error('Error getting product:', error);
    res.status(500).json({ message: 'Error getting product', error: error.message });
  }
};

// Get all products
exports.getAllProducts = async (req, res) => {
  try {
    const { currency, limit = 20, page = 1 } = req.query;
    const skip = (page - 1) * limit;
    
    const products = await Product.find()
      .sort({ lastUpdated: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Convert prices if currency is specified
    let productsToReturn = products;
    if (currency) {
      productsToReturn = await Promise.all(
        products.map(product => convertProductPrices(product, currency))
      );
    }
    
    const total = await Product.countDocuments();
    
    res.json({
      products: productsToReturn,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      currency: currency || 'USD',
      supportedCurrencies: await currencyService.getSupportedCurrencies()
    });
  } catch (error) {
    console.error('Error getting all products:', error);
    res.status(500).json({ message: 'Error getting all products', error: error.message });
  }
};

// Update product price manually (for testing)
exports.updatePrice = async (req, res) => {
  console.log(`Updating price for product ID: ${req.params.id}`);
  try {
    const { price, currency } = req.body;
    console.log(`New price: ${price} ${currency || 'USD'}`);
    
    const product = await Product.findById(req.params.id);
    if (!product) {
      console.log(`Product not found with ID: ${req.params.id}`);
      return res.status(404).json({ message: 'Product not found' });
    }
    
    console.log(`Updating price for product: ${product.title}`);
    await product.addPriceToHistory(price, currency || product.currency);
    console.log('Price updated successfully');
    res.json({
      product,
      supportedCurrencies: await currencyService.getSupportedCurrencies()
    });
  } catch (error) {
    console.error(`Error updating price for product ${req.params.id}:`, error);
    res.status(500).json({ message: 'Error updating price', error: error.message });
  }
};

// Get price history for a product
exports.getPriceHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { currency } = req.query;
    
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    let priceHistory = product.priceHistory;
    
    // Convert currency if requested
    if (currency) {
      const supportedCurrencies = await currencyService.getSupportedCurrencies();
      if (!supportedCurrencies.includes(currency.toUpperCase())) {
        return res.status(400).json({ 
          message: 'Invalid currency',
          supportedCurrencies 
        });
      }
      
      priceHistory = await Promise.all(
        product.priceHistory.map(async (entry) => {
          if (entry.currency === currency.toUpperCase()) {
            return entry;
          }
          
          return {
            ...entry.toObject(),
            price: await currencyService.convertPrice(
              entry.price, 
              entry.currency, 
              currency.toUpperCase()
            ),
            currency: currency.toUpperCase()
          };
        })
      );
    }
    
    res.json({
      productId: id,
      title: product.title,
      currentPrice: product.currentPrice,
      currency: currency ? currency.toUpperCase() : product.currency,
      priceHistory
    });
  } catch (error) {
    console.error('Error getting price history:', error);
    res.status(500).json({ message: 'Error retrieving price history', error: error.message });
  }
};