const amazonScraper = require('./AmazonScraper');
const ebayScraper = require('./EbayScraper');

class ScraperService {
  constructor() {
    this.scrapers = [
      amazonScraper,
      ebayScraper
    ];
  }

  async searchAllProducts(query) {
    console.log(`Starting product search across all platforms for: ${query}`);
    
    try {
      // Run all scrapers in parallel
      const results = await Promise.all(
        this.scrapers.map(scraper => 
          scraper.searchProducts(query)
            .catch(error => {
              console.error(`Error in ${scraper.name} scraper:`, error);
              return [];
            })
        )
      );

      // Combine results from all scrapers
      const allProducts = results.flat();
      console.log(`Total products found across all platforms: ${allProducts.length}`);
      
      return allProducts;
    } catch (error) {
      console.error('Error in product search:', error);
      return [];
    } finally {
      // Ensure all scrapers are properly closed
      await Promise.all(
        this.scrapers.map(scraper => 
          scraper.close().catch(error => {
            console.error(`Error closing ${scraper.name} scraper:`, error);
          })
        )
      );
    }
  }

  // Method to add new scrapers dynamically
  addScraper(scraper) {
    if (typeof scraper.searchProducts !== 'function') {
      throw new Error('Invalid scraper: must implement searchProducts method');
    }
    this.scrapers.push(scraper);
  }
}

module.exports = new ScraperService(); 