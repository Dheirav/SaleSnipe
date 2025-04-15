const puppeteer = require('puppeteer');

// Utility function for better logging
function logScraperStatus(message, details = {}) {
  const timestamp = new Date().toISOString();
  const detailsStr = Object.keys(details).length > 0 
    ? `\n  Details: ${JSON.stringify(details, null, 2)}` 
    : '';
  
  console.log(`[${timestamp}] [BaseScraper] ${message}${detailsStr}`);
}

class BaseScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.source = 'base';
    this.baseUrl = '';
    this.currency = 'USD';
    this.maxProducts = 20; // Maximum products to fetch across all pages
    this.maxPages = 3; // Maximum pages to scrape
    this.lastRequest = null;
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36 Edg/92.0.902.84'
    ];
  }

  async initialize(headless = false) {
    if (this.browser) {
      return;
    }

    try {
      logScraperStatus(`Initializing ${this.constructor.name} with headless=${headless}`);
      
      this.browser = await puppeteer.launch({
        headless: headless,
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox', 
          '--window-size=1280,800',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-web-security',
          '--disable-features=site-per-process',
          '--disable-blink-features=AutomationControlled',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--disable-notifications',
          '--disable-extensions',
          '--disable-popup-blocking',
          '--disable-infobars'
        ],
        defaultViewport: {
          width: 1280,
          height: 800
        },
        ignoreHTTPSErrors: true
      });
      
      this.page = await this.browser.newPage();
      
      // Set a reasonable viewport
      await this.page.setViewport({ width: 1280, height: 800 });
      
      // Add anti-detection measures
      await this.bypassAntiBot(this.page);
      
      // Set random user agent to avoid detection
      const userAgent = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
      await this.page.setUserAgent(userAgent);
      logScraperStatus(`Using user agent: ${userAgent}`);
      
      // Set extra headers to look more like a real browser
      await this.page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Connection': 'keep-alive',
        'DNT': '1',
        'Upgrade-Insecure-Requests': '1'
      });
      
      // Override navigator properties to avoid detection
      await this.page.evaluateOnNewDocument(() => {
        // Override navigator properties
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        
        // Add random mouse movements
        const originalQuerySelector = document.querySelector;
        document.querySelector = function() {
          const result = originalQuerySelector.apply(this, arguments);
          if (result) {
            // Simulate mouse movement
            const event = new MouseEvent('mousemove', {
              view: window,
              bubbles: true,
              cancelable: true,
              clientX: Math.random() * window.innerWidth,
              clientY: Math.random() * window.innerHeight
            });
            result.dispatchEvent(event);
          }
          return result;
        };
      });
      
      // Set longer timeouts for navigation
      this.page.setDefaultNavigationTimeout(60000);
      this.page.setDefaultTimeout(60000);
      
      // Set up request interception with smarter filtering
      await this.page.setRequestInterception(true);
      this.page.on('request', (request) => {
        const resourceType = request.resourceType();
        const url = request.url();
        
        // Block analytics, ads, and heavy media, but allow critical resources
        if (
          // Block tracking and advertising
          (url.includes('analytics') || url.includes('tracking') || url.includes('adservice') || url.includes('doubleclick')) ||
          // Block heavy resources like videos
          (resourceType === 'media') ||
          // Allow main content images but block unnecessary images
          (resourceType === 'image' && (url.includes('banner') || url.includes('advertisement')))
        ) {
          request.abort();
        } else {
          // Add slight delay between requests to appear more human-like
          request.continue();
        }
      });
      
      logScraperStatus(`${this.constructor.name} initialized successfully with headless=${headless}`);
    } catch (error) {
      logScraperStatus(`Error initializing ${this.constructor.name}`, { error: error.message });
      throw error;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      console.log(`${this.constructor.name} closed successfully`);
    }
  }

  async createPage() {
    await this.initialize();
    const page = await this.browser.newPage();
    
    // Add random delay between requests to avoid being blocked
    await page.setRequestInterception(true);
    page.on('request', async (request) => {
      const resourceType = request.resourceType();
      const url = request.url();
      
      // Be more selective about which resources to block
      // Allow main resources and scripts to load, but block less important ones
      if (
        // Block heavy media resources
        (resourceType === 'media') ||
        // Block tracking pixels and analytics
        (resourceType === 'image' && (url.includes('tracker') || url.includes('pixel') || url.includes('analytics'))) ||
        // Block unnecessary fonts
        (resourceType === 'font' && !url.includes('amazon')) ||
        // Block third-party ads
        (url.includes('ads') || url.includes('doubleclick') || url.includes('advertising'))
      ) {
        request.abort();
        return;
      }

      // Add rate limiting for requests
      if (this.lastRequest) {
        const timeSinceLastRequest = Date.now() - this.lastRequest;
        // Only add delay if requests are coming too quickly
        if (timeSinceLastRequest < 100) {
          await new Promise(resolve => setTimeout(resolve, 100 - timeSinceLastRequest));
        }
      }
      this.lastRequest = Date.now();
      request.continue();
    });

    // Set default timeout
    page.setDefaultTimeout(60000); // Increase to 60 seconds
    page.setDefaultNavigationTimeout(60000); 
    
    // Expose helper functions to the new page
    await this.exposeHelperFunctions(page);

    return page;
  }

  async searchProducts(query) {
    throw new Error('searchProducts method must be implemented by subclasses');
  }

  async getProductDetails(url) {
    throw new Error('getProductDetails method must be implemented by subclasses');
  }

  // Helper method to extract price and currency from text
  extractPriceAndCurrency(priceText, defaultCurrency = 'USD') {
    if (!priceText) {
      logScraperStatus(`Empty price text, returning default values`, { 
        price: 0, 
        currency: defaultCurrency 
      });
      return { price: 0, currency: defaultCurrency };
    }
    
    try {
      // Remove any whitespace
      priceText = priceText.trim();
      
      // Define common currency symbols and their codes
      const currencySymbols = {
        '$': 'USD',
        '€': 'EUR',
        '£': 'GBP',
        '¥': 'JPY',
        '₹': 'INR',
        'Rs.': 'INR',
        'Rs': 'INR',
        '₽': 'RUB',
        '₩': 'KRW',
        '₺': 'TRY',
        '₴': 'UAH',
        '₱': 'PHP',
        'AU$': 'AUD',
        'C$': 'CAD',
        'NZ$': 'NZD',
        'HK$': 'HKD',
        'S$': 'SGD',
        'kr': 'SEK',  // Also NOK, DKK
        'CHF': 'CHF',
        'R$': 'BRL',
        'R': 'ZAR',
        'Mex$': 'MXN',
        '₿': 'BTC'
      };
      
      // Default currency
      let currency = defaultCurrency;
      
      // Extract currency from the price text
      for (const [symbol, code] of Object.entries(currencySymbols)) {
        if (priceText.includes(symbol)) {
          currency = code;
          // Remove the currency symbol for cleaner processing
          priceText = priceText.replace(new RegExp(symbol.replace(/\$/g, '\\$'), 'g'), '');
          break;
        }
      }
      
      // Also check for currency codes in the text
      const currencyCodes = Object.values(currencySymbols);
      for (const code of currencyCodes) {
        if (priceText.includes(code)) {
          currency = code;
          // Remove the currency code for cleaner processing
          priceText = priceText.replace(new RegExp(code, 'g'), '');
          break;
        }
      }
      
      // Special case for Indian Rupees (₹) which might appear as "INR" or "RS" in text
      if (priceText.toLowerCase().includes('inr') || 
          priceText.toLowerCase().includes(' rs') || 
          priceText.toLowerCase().includes('rs ') || 
          priceText.toLowerCase().includes('rs.')) {
        currency = 'INR';
        priceText = priceText.replace(/inr|rs\.| rs|rs /gi, '');
      }
      
      // Remove any remaining non-numeric characters except dots and commas
      priceText = priceText.replace(/[^\d.,]/g, '');
      
      // Different price format handling strategies
      let price = 0;
      
      // 1. Check for common price formats
      
      // Handle US/UK format with comma as thousands separator (e.g., 1,234.56)
      if (priceText.includes(',') && priceText.includes('.') && 
          priceText.lastIndexOf(',') < priceText.lastIndexOf('.')) {
        price = parseFloat(priceText.replace(/,/g, ''));
      }
      // Handle European format with dot as thousands separator (e.g., 1.234,56)
      else if (priceText.includes(',') && priceText.includes('.') && 
               priceText.lastIndexOf('.') < priceText.lastIndexOf(',')) {
        price = parseFloat(priceText.replace(/\./g, '').replace(',', '.'));
      }
      // Handle format with only comma as decimal separator (e.g., 1234,56)
      else if (priceText.includes(',') && !priceText.includes('.')) {
        // Check if comma is likely a decimal separator (usually has 2 digits after it)
        const afterComma = priceText.split(',')[1];
        if (afterComma && afterComma.length <= 2) {
          price = parseFloat(priceText.replace(',', '.'));
        } else {
          // Comma is likely a thousands separator
          price = parseFloat(priceText.replace(/,/g, ''));
        }
      }
      // Handle format with only period as separator (could be decimal or thousands)
      else if (!priceText.includes(',') && priceText.includes('.')) {
        // If there are exactly 2 or 3 digits after the last period, it's likely a decimal
        const parts = priceText.split('.');
        const lastPart = parts[parts.length - 1];
        
        if (lastPart && lastPart.length <= 3) {
          // It's a decimal separator
          price = parseFloat(priceText);
        } else {
          // It's a thousands separator
          price = parseFloat(priceText.replace(/\./g, ''));
        }
      }
      // Handle format with no separators (e.g., 1234)
      else if (!priceText.includes(',') && !priceText.includes('.')) {
        price = parseInt(priceText, 10);
      }
      
      // 2. If the above strategies fail, try a more aggressive approach
      if (!price || isNaN(price)) {
        // Try to extract the first sequence of digits that could be a price
        const matches = priceText.match(/\d+/g);
        if (matches && matches.length > 0) {
          // Check if we have what looks like a price with cents
          if (matches.length >= 2 && matches[1].length <= 2) {
            price = parseFloat(`${matches[0]}.${matches[1]}`);
          } else {
            price = parseInt(matches[0], 10);
          }
        }
      }
      
      // 3. Special case for "free" items
      if ((!price || isNaN(price)) && priceText.toLowerCase().includes('free')) {
        price = 0;
      }
      
      // Validate the price is reasonable
      if (price > 1000000) { // More than a million units of currency is suspicious
        logScraperStatus(`Extremely high price detected, may be an error`, { 
          originalText: priceText,
          extractedPrice: price
        });
        
        // Try to adjust by dividing by 100 (sometimes happens with cents confusion)
        price = price / 100;
      }
      
      logScraperStatus(`Price extraction result`, { 
        originalText: priceText,
        extractedPrice: price,
        currency,
        defaultCurrency
      });
      
      return { 
        price: !isNaN(price) ? price : 0, 
        currency: currency || defaultCurrency 
      };
    } catch (error) {
      logScraperStatus(`Error extracting price`, { 
        priceText, 
        error: error.message 
      });
      return { price: 0, currency: defaultCurrency };
    }
  }

  // Helper method to wait for a selector
  async waitForSelector(selector, timeout = 5000) {
    try {
      await this.page.waitForSelector(selector, { timeout });
      return true;
    } catch (error) {
      logScraperStatus(`Selector not found within timeout`, { 
        selector, 
        timeout, 
        error: error.message 
      });
      return false;
    }
  }

  // Helper method to extract text from a selector
  async extractText(selector) {
    try {
      const element = await this.page.$(selector);
      if (!element) {
        logScraperStatus(`Element not found for selector`, { selector });
        return '';
      }
      
      const text = await this.page.evaluate(el => el.textContent.trim(), element);
      return text;
    } catch (error) {
      logScraperStatus(`Error extracting text from selector`, { 
        selector, 
        error: error.message 
      });
      return '';
    }
  }

  // Helper method to extract attribute from a selector
  async extractAttribute(selector, attribute) {
    try {
      const element = await this.page.$(selector);
      if (!element) return '';
      
      const value = await this.page.evaluate((el, attr) => el.getAttribute(attr), element, attribute);
      return value || '';
    } catch (error) {
      console.error(`Error extracting attribute "${attribute}" from selector "${selector}":`, error);
      return '';
    }
  }

  // Helper method to extract multiple elements
  async extractElements(selector) {
    try {
      return await this.page.$$(selector);
    } catch (error) {
      console.error(`Error extracting elements with selector "${selector}":`, error);
      return [];
    }
  }

  // Utility methods that can be used by specific scrapers
  formatPrice(price) {
    const cleanPrice = price.replace(/[^0-9.]/g, '');
    return parseFloat(cleanPrice);
  }

  isValidPrice(price) {
    return !isNaN(price) && price > 0 && price < 100000; // Add upper limit for sanity check
  }

  async navigateToPage(page, url, options = {}) {
    const defaultOptions = {
      waitUntil: 'domcontentloaded', // Changed from networkidle0 for faster response
      timeout: 60000 // Increased timeout to 60 seconds
    };

    const mergedOptions = { ...defaultOptions, ...options };
    
    try {
      logScraperStatus(`Navigating to: ${url}`, { options: mergedOptions });
      
      // First attempt with domcontentloaded
      await page.goto(url, mergedOptions);
      
      logScraperStatus(`Initial navigation to ${url} successful`);
      
      // Add small delay after navigation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Scroll down slightly to trigger any lazy loading
      await page.evaluate(() => {
        window.scrollBy(0, 200);
      });
      
      // Wait for network to be idle (with a shorter timeout)
      await page.waitForNetworkIdle({ timeout: 5000 }).catch((err) => {
        logScraperStatus(`Network didn't reach idle state, but continuing: ${err.message}`);
      });
      
      return true;
    } catch (error) {
      logScraperStatus(`Navigation error for ${url}: ${error.message}`);
      
      // Try to check if the page loaded partially despite the error
      try {
        const pageContent = await page.content();
        // Check if we have at least some content
        if (pageContent && pageContent.length > 1000 && pageContent.includes('<body')) {
          logScraperStatus(`Page partially loaded despite navigation error, continuing`);
          return true;
        }
      } catch (contentError) {
        logScraperStatus(`Failed to get page content: ${contentError.message}`);
      }
      
      // Try one more time with a different waitUntil strategy
      try {
        logScraperStatus(`Retrying navigation with 'load' strategy`);
        await page.goto(url, { 
          waitUntil: 'load',
          timeout: 40000 
        });
        logScraperStatus(`Retry navigation successful`);
        return true;
      } catch (retryError) {
        logScraperStatus(`Retry navigation also failed: ${retryError.message}`);
        throw error; // Throw the original error
      }
    }
  }

  validateProduct(product) {
    const { title, currentPrice, url, rating } = product;
    
    // Basic validation
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return false;
    }
    
    if (!this.isValidPrice(currentPrice)) {
      return false;
    }
    
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      return false;
    }
    
    // Rating validation (optional field)
    if (rating !== null && rating !== undefined) {
      if (typeof rating !== 'number' || rating < 0 || rating > 5) {
        return false;
      }
    }
    
    return true;
  }

  // Helper method to add random delay between actions
  async addRandomDelay(min = 1000, max = 3000) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // Helper method to check if a product title contains all words from the search query
  containsAllSearchWords(title, searchQuery) {
    if (!searchQuery || !title) return true;
    
    // Split the search query into words and filter out short words
    const searchWords = searchQuery.toLowerCase().split(' ')
      .filter(word => word.length > 2);
    
    // If no valid search words, return true
    if (searchWords.length === 0) return true;
    
    // Convert the title to lowercase
    const productTitle = title.toLowerCase();
    
    // For searches with special products, be more specific
    if (searchQuery.toLowerCase().includes('iphone') || 
        searchQuery.toLowerCase().includes('macbook') || 
        searchQuery.toLowerCase().includes('samsung') ||
        searchQuery.toLowerCase().includes('alienware') ||
        searchQuery.toLowerCase().includes('dell')) {
      
      // For these products, ensure the brand name is in the title
      const brandWords = ['iphone', 'macbook', 'samsung', 'alienware', 'dell']
        .filter(brand => searchQuery.toLowerCase().includes(brand));
      
      if (brandWords.length > 0) {
        const hasBrand = brandWords.some(brand => productTitle.includes(brand));
        if (!hasBrand) {
          logScraperStatus(`Product title doesn't contain any required brand name`, { 
            title, 
            searchQuery,
            brandWords
          });
          return false;
        }
      }
    }
    
    // For scraping, we'll be more permissive - if product contains ANY significant words from the query
    // This ensures we get more products from the scraper
    const matchingWords = searchWords.filter(word => productTitle.includes(word));
    
    // For more targeted searches, require more matching words
    const requiredMatches = searchWords.length >= 4 ? 2 : 1;
    
    if (matchingWords.length < requiredMatches) {
      logScraperStatus(`Product title doesn't match enough search words`, { 
        title, 
        searchQuery,
        matchingWords,
        requiredMatches
      });
      return false;
    }
    
    return true;
  }

  // New method to retry scraping with headless mode disabled if no products are found
  async retryWithoutHeadless(query) {
    try {
      logScraperStatus(`No products found in headless mode, retrying with non-headless mode`, { source: this.source, query });
      
      // Close the current browser
      await this.close();
      
      // Reinitialize with headless mode disabled
      await this.initialize(false);
      
      // Store the search query for later use
      this.searchQuery = query;
      
      // Refine the search query for better results
      const refinedQuery = this.refineSearchQuery ? this.refineSearchQuery(query) : query;
      const searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(refinedQuery)}`;
      
      logScraperStatus(`Starting search in non-headless mode`, { source: this.source, url: searchUrl });
      
      // Navigate to search page with random delay
      await this.navigateToPage(this.page, searchUrl);
      await this.addRandomDelay(2000, 4000);
      
      // Check for CAPTCHA and handle it manually
      const hasCaptcha = await this.page.evaluate(() => {
        return document.body.innerText.includes('CAPTCHA') || 
               document.body.innerText.includes('captcha') || 
               document.body.innerText.includes('Robot Check') ||
               document.body.innerText.includes('Enter the characters you see below') ||
               document.body.innerText.includes('human verification');
      });
      
      if (hasCaptcha) {
        logScraperStatus(`CAPTCHA detected in non-headless mode. Please solve it manually. Browser window will stay open for 2 minutes.`, { source: this.source });
        
        // Alert the user to solve the CAPTCHA
        await this.page.evaluate(() => {
          alert('CAPTCHA detected! Please solve it manually to continue scraping. Window will close in 2 minutes.');
        });
        
        // Wait for 2 minutes to allow manual CAPTCHA solving
        await this.page.waitForTimeout(120000);
        
        // Check if we're still on the CAPTCHA page
        const stillHasCaptcha = await this.page.evaluate(() => {
          return document.body.innerText.includes('CAPTCHA') || 
                 document.body.innerText.includes('captcha') || 
                 document.body.innerText.includes('Robot Check');
        });
        
        if (stillHasCaptcha) {
          logScraperStatus(`CAPTCHA not solved within timeout`, { source: this.source });
          return [];
        }
        
        logScraperStatus(`CAPTCHA appears to be solved, continuing`, { source: this.source });
      }
      
      // Simulate human behavior
      await this.simulateHumanBehavior();
      
      // Try to extract products
      let products = [];
      
      // If this scraper has an extractProductsFromPage method, use it
      if (typeof this.extractProductsFromPage === 'function') {
        products = await this.extractProductsFromPage(query);
      } 
      // Otherwise, if it has an original searchProducts method, use that (excluding initialization and cleanup)
      else if (typeof this.searchProductsOriginal === 'function') {
        products = await this.searchProductsOriginal(query);
      }
      
      logScraperStatus(`Retry with non-headless mode found ${products.length} products`, { source: this.source, query });
      
      return products;
    } catch (error) {
      logScraperStatus(`Error retrying without headless mode`, { error: error.message });
      return [];
    } finally {
      // Always close the browser to clean up resources
      await this.close();
    }
  }

  // Helper method to simulate human-like browsing behavior
  async simulateHumanBehavior() {
    // Default implementation if not overridden by subclasses
    try {
      // Simulate scrolling
      await this.page.evaluate(() => {
        window.scrollBy(0, 300);
        // Pause
        return new Promise(resolve => setTimeout(resolve, 800));
      });
      
      await this.page.evaluate(() => {
        window.scrollBy(0, 500);
        // Pause
        return new Promise(resolve => setTimeout(resolve, 1200));
      });
      
      // Scroll back up a bit
      await this.page.evaluate(() => {
        window.scrollBy(0, -200);
        return new Promise(resolve => setTimeout(resolve, 500));
      });
      
      // Random delay
      await this.addRandomDelay(1000, 3000);
    } catch (error) {
      logScraperStatus(`Error in simulateHumanBehavior`, { error: error.message });
    }
  }

  // Helper method to expose utility functions to the page context
  async exposeHelperFunctions(page) {
    try {
      // First check if the function already exists
      const extractPriceExists = await page.evaluate(() => {
        return typeof window.extractPrice === 'function';
      }).catch(() => false);
      
      if (!extractPriceExists) {
        // Expose generic price extraction function
        await page.exposeFunction('extractPrice', (priceText) => {
          if (!priceText) return null;
          
          // Remove all non-numeric characters except decimal points and commas
          let sanitized = priceText.replace(/[^\d.,]/g, '');
          
          // Handle comma as decimal separator in some regions
          if (sanitized.includes(',') && !sanitized.includes('.')) {
            sanitized = sanitized.replace(',', '.');
          }
          
          // Handle formats with both comma and period
          if (sanitized.includes(',') && sanitized.includes('.')) {
            // If comma is before period, it's likely a thousands separator
            if (sanitized.indexOf(',') < sanitized.indexOf('.')) {
              sanitized = sanitized.replace(/,/g, '');
            } else {
              // Period is thousands separator, comma is decimal
              sanitized = sanitized.replace(/\./g, '').replace(',', '.');
            }
          }
          
          // Convert to number
          const price = parseFloat(sanitized);
          return isNaN(price) ? null : price;
        });
        
        logScraperStatus('Exposed extractPrice helper function to page context');
      }
      
      // Add more utility functions as needed in a similar way
      
    } catch (error) {
      console.error('Error exposing helper functions:', error);
      // Continue execution even if this fails
    }
  }

  // Helper method to bypass anti-bot protection
  async bypassAntiBot(page) {
    try {
      // Override navigator properties to make detection harder
      await page.evaluateOnNewDocument(() => {
        // Overwrite the navigator properties to avoid detection
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });
        
        // Chrome
        window.chrome = {
          runtime: {},
        };
        
        // Notification permission
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );
        
        // Prevent fingerprinting by randomizing canvas
        const getImageData = CanvasRenderingContext2D.prototype.getImageData;
        CanvasRenderingContext2D.prototype.getImageData = function (x, y, w, h) {
          const imageData = getImageData.call(this, x, y, w, h);
          const data = imageData.data;
          // Add slight noise to prevent fingerprinting
          for (let i = 0; i < data.length; i += 4) {
            const noise = Math.random() * 2 - 1;
            data[i] = data[i] + noise;
            data[i+1] = data[i+1] + noise;
            data[i+2] = data[i+2] + noise;
          }
          return imageData;
        };
      });
      
      // Set extra headers that most normal browsers have
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'max-age=0',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      });
      
      logScraperStatus('Applied anti-bot bypass measures');
    } catch (error) {
      console.error('Error in bypassAntiBot:', error);
      // Continue execution even if this fails
    }
  }
}

module.exports = BaseScraper;
module.exports.logScraperStatus = logScraperStatus; 