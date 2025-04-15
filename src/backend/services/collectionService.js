const ProductCollection = require('../models/ProductCollection');
const Product = require('../models/Product');
const scraperService = require('./scraperService');

/**
 * Service for managing product collections
 */
class CollectionService {
  /**
   * Update a product collection with fresh data
   * @param {string} collectionName - Name of the collection to update
   * @param {string} searchTerm - Search term to use for fetching products
   */
  async updateCollection(collectionName, searchTerm) {
    console.log(`Updating collection: ${collectionName} with search term: ${searchTerm}`);
    
    try {
      // Search for products using the scraper service
      const products = await scraperService.searchAllProducts(searchTerm);
      
      if (!products || products.length === 0) {
        console.log(`No products found for collection: ${collectionName}`);
        return false;
      }
      
      // Save products to database if they don't already exist
      const savedProductIds = [];
      
      for (const product of products) {
        // Check if product already exists in database
        let existingProduct = await Product.findOne({
          source: product.source,
          siteProductId: product.siteProductId
        });
        
        if (existingProduct) {
          // If product exists, update the price if it has changed
          if (existingProduct.currentPrice !== product.currentPrice) {
            await existingProduct.addPriceToHistory(product.currentPrice, product.currency);
          }
          savedProductIds.push(existingProduct._id);
        } else {
          // Create new product
          const newProduct = new Product(product);
          await newProduct.save();
          savedProductIds.push(newProduct._id);
        }
      }
      
      // Find or create the collection
      let collection = await ProductCollection.findOne({ name: collectionName });
      
      if (!collection) {
        collection = new ProductCollection({
          name: collectionName,
          description: `Collection of ${collectionName} products`,
          products: savedProductIds
        });
      } else {
        // Update existing collection
        collection.products = savedProductIds;
        collection.lastUpdated = new Date();
      }
      
      await collection.save();
      console.log(`Updated collection: ${collectionName} with ${savedProductIds.length} products`);
      
      return true;
    } catch (error) {
      console.error(`Error updating collection ${collectionName}:`, error);
      return false;
    }
  }
  
  /**
   * Get products for a specific collection
   * @param {string} collectionName - Name of the collection to retrieve
   * @param {number} limit - Maximum number of products to return
   */
  async getCollection(collectionName, limit = 10) {
    try {
      const collection = await ProductCollection.findOne({ name: collectionName })
        .populate({
          path: 'products',
          select: 'title currentPrice url source currency rating imageUrl lastUpdated _id priceHistory originalPrice'
        });
      
      if (!collection) {
        console.log(`Collection not found: ${collectionName}`);
        return [];
      }
      
      // Limit the number of products returned
      const products = collection.products.slice(0, limit);
      
      return {
        products,
        lastUpdated: collection.lastUpdated
      };
    } catch (error) {
      console.error(`Error getting collection ${collectionName}:`, error);
      return {
        products: [],
        lastUpdated: null
      };
    }
  }
  
  /**
   * Get all available collections
   */
  async getAllCollections() {
    try {
      const collections = await ProductCollection.find()
        .select('name description lastUpdated')
        .sort('name');
      
      return collections;
    } catch (error) {
      console.error('Error getting all collections:', error);
      return [];
    }
  }
  
  /**
   * Check if a collection is stale and needs updating
   * @param {string} collectionName - Name of the collection to check
   * @param {number} maxAgeHours - Maximum age in hours before collection needs refresh
   */
  async isCollectionStale(collectionName, maxAgeHours = 12) {
    try {
      const collection = await ProductCollection.findOne({ name: collectionName });
      
      if (!collection) {
        // If collection doesn't exist, it's considered stale
        return true;
      }
      
      const lastUpdated = new Date(collection.lastUpdated);
      const now = new Date();
      const diffHours = (now - lastUpdated) / (1000 * 60 * 60);
      
      return diffHours > maxAgeHours;
    } catch (error) {
      console.error(`Error checking if collection ${collectionName} is stale:`, error);
      // Default to true if there's an error
      return true;
    }
  }
}

module.exports = new CollectionService(); 