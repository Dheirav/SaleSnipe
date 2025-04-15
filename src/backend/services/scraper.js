const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

class WebScraper {
  constructor() {
    this.browser = null;
  }

  async initialize() {
    console.log('Initializing web scraper...');
    if (!this.browser) {
      try {
        this.browser = await puppeteer.launch({
          headless: 'new',
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        console.log('Browser instance created successfully');
      } catch (error) {
        console.error('Failed to initialize browser:', error);
        throw error;
      }
    }
  }

  async close() {
    if (this.browser) {
      console.log('Closing browser instance...');
      await this.browser.close();
      this.browser = null;
      console.log('Browser instance closed successfully');
    }
  }

  async searchAmazon(productName) {
    console.log(`Searching Amazon for: ${productName}`);
    await this.initialize();
    const page = await this.browser.newPage();
    
    try {
      console.log('Navigating to Amazon search page...');
      await page.goto(`https://www.amazon.com/s?k=${encodeURIComponent(productName)}`, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });
      
      console.log('Waiting for search results...');
      await page.waitForSelector('.s-result-item', { timeout: 10000 });
      
      console.log('Extracting product data...');
      const html = await page.content();
      const $ = cheerio.load(html);
      
      const products = [];
      
      $('.s-result-item[data-component-type="s-search-result"]').each((i, element) => {
        if (i < 5) {
          const title = $(element).find('h2 span').text().trim();
          const priceWhole = $(element).find('.a-price-whole').first().text().trim();
          const priceFraction = $(element).find('.a-price-fraction').first().text().trim();
          const url = 'https://www.amazon.com' + $(element).find('h2 a').attr('href');
          const rating = parseFloat($(element).find('.a-icon-star-small .a-icon-alt').text());
          
          console.log(`Found product: ${title}`);
          
          if (title && (priceWhole || priceFraction)) {
            const price = parseFloat(`${priceWhole}.${priceFraction}`) || 0;
            products.push({
              title,
              currentPrice: price,
              url,
              rating,
              source: 'amazon',
              availability: true
            });
          }
        }
      });
      
      console.log(`Found ${products.length} products on Amazon`);
      return products;
    } catch (error) {
      console.error('Error scraping Amazon:', error);
      return [];
    } finally {
      console.log('Closing Amazon search page');
      await page.close();
    }
  }

  async searchEbay(productName) {
    console.log(`Searching eBay for: ${productName}`);
    await this.initialize();
    const page = await this.browser.newPage();
    
    try {
      console.log('Navigating to eBay search page...');
      await page.goto(`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(productName)}`, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });
      
      console.log('Waiting for search results...');
      await page.waitForSelector('.s-item', { timeout: 10000 });
      
      console.log('Extracting product data...');
      const html = await page.content();
      const $ = cheerio.load(html);
      
      const products = [];
      
      $('.s-item').each((i, element) => {
        if (i === 0) return;

        const title = $(element).find('.s-item__title').text().trim();
        const priceText = $(element).find('.s-item__price').text().trim();
        const url = $(element).find('.s-item__link').attr('href');
        
        if (
          !title || 
          !priceText || 
          !url ||
          title === 'Shop on eBay' ||
          title.toLowerCase().includes('shop on ebay') ||
          url.includes('itmmeta') ||
          url === 'https://www.ebay.com' ||
          priceText.includes('to')
        ) {
          console.log(`Skipping invalid entry: ${title}`);
          return;
        }

        const cleanPrice = priceText.replace(/[^0-9.]/g, '');
        const price = parseFloat(cleanPrice);

        if (isNaN(price) || price <= 0) {
          console.log(`Skipping entry with invalid price: ${title}`);
          return;
        }

        console.log(`Found valid product: ${title} at ${price}`);
        products.push({
          title,
          currentPrice: price,
          url,
          source: 'ebay',
          availability: true
        });

        if (products.length >= 5) return false;
      });
      
      console.log(`Found ${products.length} valid products on eBay`);
      return products;
    } catch (error) {
      console.error('Error scraping eBay:', error);
      return [];
    } finally {
      console.log('Closing eBay search page');
      await page.close();
    }
  }

  async searchProducts(productName) {
    console.log(`Starting product search for: ${productName}`);
    try {
      const [amazonProducts, ebayProducts] = await Promise.all([
        this.searchAmazon(productName),
        this.searchEbay(productName)
      ]);

      const totalProducts = amazonProducts.length + ebayProducts.length;
      console.log(`Search completed. Total products found: ${totalProducts}`);
      
      return [...amazonProducts, ...ebayProducts];
    } catch (error) {
      console.error('Error in product search:', error);
      return [];
    } finally {
      await this.close();
    }
  }
}

module.exports = new WebScraper(); 