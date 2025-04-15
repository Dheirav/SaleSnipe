const BaseScraper = require('./scrapers/BaseScraper');
const AmazonScraper = require('./scrapers/AmazonScraper');
const EbayScraper = require('./scrapers/EbayScraper');
const FlipkartScraper = require('./scrapers/FlipkartScraper');
const AmazonIndiaScraper = require('./scrapers/AmazonIndiaScraper');

// Utility function for better logging
function logScraperStatus(message, details = {}) {
  const timestamp = new Date().toISOString();
  const detailsStr = Object.keys(details).length > 0 
    ? `\n  Details: ${JSON.stringify(details, null, 2)}` 
    : '';
  
  console.log(`[${timestamp}] [ScraperService] ${message}${detailsStr}`);
}

// Export the logging function first to avoid circular dependencies
module.exports.logScraperStatus = logScraperStatus;

class ScraperService {
  constructor() {
    this.scrapers = [
      new AmazonScraper(),
      new EbayScraper(),
      new FlipkartScraper(),
      new AmazonIndiaScraper()
      // Add more scrapers as needed
    ];
  }

  async searchAllProducts(query) {
    logScraperStatus(`Starting product search`, { query });
    
    const results = [];
    const errors = [];
    
    // Run all scrapers in parallel
    const scraperPromises = this.scrapers.map(async (scraper) => {
      try {
        logScraperStatus(`Using ${scraper.constructor.name} to search`, { query });
        
        // Always use non-headless mode for better results
        try {
          // Force close any existing browser instances first
          await scraper.close().catch(() => {});
          
          // Run the search with non-headless mode
          const products = await scraper.searchProducts(query);
          
          logScraperStatus(`Found ${products.length} products with ${scraper.constructor.name}`, { 
            count: products.length,
            source: scraper.source
          });
          
          return products;
        } catch (searchError) {
          logScraperStatus(`Error searching with ${scraper.constructor.name}`, { 
            error: searchError.message,
            source: scraper.source
          });
          
          // If first attempt fails, try one more time after a short delay
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          logScraperStatus(`Retrying search with ${scraper.constructor.name}`, { 
            query,
            source: scraper.source
          });
          
          // Force close any existing browser instances
          await scraper.close().catch(() => {});
          
          // Try once more
          const retryProducts = await scraper.searchProducts(query);
          
          logScraperStatus(`Retry found ${retryProducts.length} products with ${scraper.constructor.name}`, { 
            count: retryProducts.length,
            source: scraper.source
          });
          
          return retryProducts;
        }
      } catch (error) {
        logScraperStatus(`Error with ${scraper.constructor.name}`, { 
          error: error.message,
          source: scraper.source
        });
        errors.push({
          scraper: scraper.constructor.name,
          error: error.message
        });
        return [];
      }
    });
    
    // Wait for all scrapers to complete
    const scraperResults = await Promise.all(scraperPromises);
    
    // Combine results from all scrapers
    scraperResults.forEach(products => {
      results.push(...products);
    });
    
    logScraperStatus(`Search completed`, { 
      totalProducts: results.length,
      errors: errors.length > 0 ? errors : 'None'
    });
    
    return results;
  }

  async getProductDetails(url, source) {
    logScraperStatus(`Getting product details`, { url, source });
    
    // Find the appropriate scraper
    const scraper = this.scrapers.find(s => s.source === source);
    if (!scraper) {
      logScraperStatus(`No scraper found for source`, { source });
      throw new Error(`No scraper found for source: ${source}`);
    }
    
    try {
      const product = await scraper.getProductDetails(url);
      logScraperStatus(`Successfully retrieved product details`, { 
        title: product.title,
        source: product.source,
        price: product.currentPrice,
        currency: product.currency
      });
      return product;
    } catch (error) {
      logScraperStatus(`Error getting product details`, { 
        url, 
        source, 
        error: error.message 
      });
      throw error;
    }
  }

  async updateProductPrice(productId) {
    try {
      // Find the product in the database
      const Product = require('../models/Product');
      const product = await Product.findById(productId);
      
      if (!product) {
        logScraperStatus(`Product not found for updating`, { productId });
        return {
          success: false,
          message: 'Product not found'
        };
      }

      logScraperStatus(`Updating price for product`, { 
        productId, 
        title: product.title,
        source: product.source,
        url: product.url
      });
      
      try {
        // Get the latest product details by searching for the product title
        // Instead of searching for "pricedrop", use the product's actual title
        const searchTerm = product.title;
        const searchResults = await this.searchAllProducts(searchTerm);
        
        // Try to find the exact product in the search results
        const updatedProductData = searchResults.find(result => 
          result.source === product.source && 
          (
            result.siteProductId === product.siteProductId ||
            result.url === product.url
          )
        );
        
        // If found, update the price
        if (updatedProductData && updatedProductData.currentPrice > 0) {
          // Check if price has changed
          const priceChanged = product.currentPrice !== updatedProductData.currentPrice;
          
          if (priceChanged) {
            logScraperStatus(`Price changed for product`, {
              productId: product._id,
              oldPrice: `${product.currency} ${product.currentPrice}`,
              newPrice: `${updatedProductData.currency} ${updatedProductData.currentPrice}`,
              percentChange: `${((updatedProductData.currentPrice - product.currentPrice) / product.currentPrice * 100).toFixed(2)}%`
            });
            
            // Update price history
            await product.addPriceToHistory(updatedProductData.currentPrice, updatedProductData.currency);
            
            return {
              success: true,
              priceChanged: true,
              oldPrice: product.currentPrice,
              newPrice: updatedProductData.currentPrice
            };
          } else {
            logScraperStatus(`Price unchanged for product`, {
              productId: product._id,
              price: `${product.currency} ${product.currentPrice}`
            });
            
            // Update lastUpdated timestamp
            product.lastUpdated = new Date();
            await product.save();
            
            return {
              success: true,
              priceChanged: false,
              price: product.currentPrice
            };
          }
        } else {
          // If not found in search, try to fetch directly using the URL
          logScraperStatus(`Product not found in search results, trying direct URL fetch`, {
            productId: product._id,
            url: product.url
          });
          
          try {
            const directData = await this.getProductDetails(product.url, product.source);
            
            if (directData && directData.currentPrice > 0) {
              const priceChanged = product.currentPrice !== directData.currentPrice;
              
              if (priceChanged) {
                logScraperStatus(`Price changed (direct fetch) for product`, {
                  productId: product._id,
                  oldPrice: `${product.currency} ${product.currentPrice}`,
                  newPrice: `${directData.currency} ${directData.currentPrice}`,
                  percentChange: `${((directData.currentPrice - product.currentPrice) / product.currentPrice * 100).toFixed(2)}%`
                });
                
                // Update price history
                await product.addPriceToHistory(directData.currentPrice, directData.currency);
                
                return {
                  success: true,
                  priceChanged: true,
                  oldPrice: product.currentPrice,
                  newPrice: directData.currentPrice
                };
              } else {
                logScraperStatus(`Price unchanged (direct fetch) for product`, {
                  productId: product._id,
                  price: `${product.currency} ${product.currentPrice}`
                });
                
                // Update lastUpdated timestamp
                product.lastUpdated = new Date();
                await product.save();
                
                return {
                  success: true,
                  priceChanged: false,
                  price: product.currentPrice
                };
              }
            } else {
              logScraperStatus(`Failed to get valid price from direct fetch`, {
                productId: product._id
              });
              
              return {
                success: false,
                message: 'Could not get valid price'
              };
            }
          } catch (directError) {
            logScraperStatus(`Error in direct fetch for product`, {
              productId: product._id,
              error: directError.message
            });
            
            return {
              success: false,
              message: directError.message
            };
          }
        }
      } catch (searchError) {
        logScraperStatus(`Error searching for product`, {
          productId: product._id,
          error: searchError.message
        });
        
        return {
          success: false,
          message: searchError.message
        };
      }
    } catch (error) {
      logScraperStatus(`Error updating product price`, {
        productId,
        error: error.message
      });
      
      return {
        success: false,
        message: error.message
      };
    }
  }
}

// Export the service instance
const scraperServiceInstance = new ScraperService();
module.exports = scraperServiceInstance; 