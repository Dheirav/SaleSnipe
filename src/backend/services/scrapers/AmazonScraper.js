const cheerio = require('cheerio');
const BaseScraper = require('./BaseScraper');
const puppeteer = require('puppeteer');

// Utility function for better logging
function logScraperStatus(message, details = {}) {
  const timestamp = new Date().toISOString();
  const detailsStr = Object.keys(details).length > 0 
    ? `\n  Details: ${JSON.stringify(details, null, 2)}` 
    : '';
  
  console.log(`[${timestamp}] [AmazonScraper] ${message}${detailsStr}`);
}

class AmazonScraper extends BaseScraper {
  constructor() {
    super();
    this.source = 'amazon';
    this.baseUrl = 'https://www.amazon.com';
    this.currency = 'USD';
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
    ];
    this.proxyList = []; // Add proxy list if needed
  }

  // Add method to refine search queries
  refineSearchQuery(query) {
    // If the query is specifically for Alienware, make it more precise
    if (query.toLowerCase().includes('alienware')) {
      // Remove any generic terms like "laptop" or "gaming" if they're part of the query
      // and focus on "Alienware" as the primary search term
      return 'Alienware ' + query.split(' ')
        .filter(word => !['laptop', 'gaming', 'computer', 'pc'].includes(word.toLowerCase()))
        .join(' ');
    }
    // For now, just return the original query for other searches
    return query;
  }

  extractProductId(url) {
    try {
      // Handle different URL formats
      const patterns = [
        /\/dp\/([A-Z0-9]{10})(?:\/|\?|$)/,
        /\/product\/([A-Z0-9]{10})(?:\/|\?|$)/,
        /\/gp\/product\/([A-Z0-9]{10})(?:\/|\?|$)/,
        /\?th=([A-Z0-9]{10})(?:&|$)/,
        /\/([A-Z0-9]{10})(?:\/|\?|$)/
      ];

      for (const pattern of patterns) {
        const matches = url.match(pattern);
        if (matches && matches[1]) {
          return matches[1];
        }
      }

      // If no pattern matches, try to find any 10-character alphanumeric sequence
      const genericMatch = url.match(/[A-Z0-9]{10}/);
      return genericMatch ? genericMatch[0] : null;
    } catch (err) {
      console.error('Error extracting product ID:', err);
      return null;
    }
  }

  extractRating(element, $) {
    try {
      // Try multiple possible rating selectors
      const ratingSelectors = [
        '.a-icon-star-small .a-icon-alt',
        '.a-icon-star .a-icon-alt',
        '[class*="a-icon-star"] .a-icon-alt',
        '.a-star-small-4-5 .a-icon-alt',
        '.a-star-small-4 .a-icon-alt',
        '.a-star-small-3-5 .a-icon-alt',
        '.a-star-small-3 .a-icon-alt',
        '.a-star-small-2-5 .a-icon-alt',
        '.a-star-small-2 .a-icon-alt',
        '.a-star-small-1-5 .a-icon-alt',
        '.a-star-small-1 .a-icon-alt',
        '.a-star-small-0-5 .a-icon-alt',
        '.a-icon-star .a-icon-alt',
        '.a-icon-star-half .a-icon-alt',
        '.a-icon-star-empty .a-icon-alt',
        '.a-icon-star-small .a-icon-alt',
        '.a-icon-star-small-half .a-icon-alt',
        '.a-icon-star-small-empty .a-icon-alt',
        '.a-icon-star-medium .a-icon-alt',
        '.a-icon-star-medium-half .a-icon-alt',
        '.a-icon-star-medium-empty .a-icon-alt',
        '.a-icon-star-large .a-icon-alt',
        '.a-icon-star-large-half .a-icon-alt',
        '.a-icon-star-large-empty .a-icon-alt'
      ];
      
      let ratingText = '';
      for (const selector of ratingSelectors) {
        ratingText = $(element).find(selector).first().text().trim();
        if (ratingText) break;
      }
      
      if (!ratingText) {
        // Try finding any text that contains "out of 5"
        ratingText = $(element).find('*').filter(function() {
          return $(this).text().match(/\d(\.\d)?\s*out of\s*5/);
        }).first().text().trim();
      }
      
      if (!ratingText) {
        // Try finding any text that contains a star rating
        ratingText = $(element).find('*').filter(function() {
          return $(this).text().match(/\d(\.\d)?\s*stars?/i);
        }).first().text().trim();
      }
      
      if (!ratingText) return null;
      
      // Extract the numeric rating value
      const ratingMatch = ratingText.match(/([0-9.]+)/);
      if (ratingMatch) {
        const rating = parseFloat(ratingMatch[1]);
        return !isNaN(rating) && rating >= 0 && rating <= 5 ? rating : null;
      }
    } catch (err) {
      console.log('Error extracting rating:', err.message);
    }
    return null;
  }

  async extractProductsFromPage($) {
    const products = [];
    
    // Try different selectors for product items
    const productSelectors = [
      '.s-result-item',
      '[data-component-type="s-search-result"]',
      '.s-search-result',
      '.s-result-list .s-result-item'
    ];
    
    let productElements = [];
    for (const selector of productSelectors) {
      productElements = $(selector);
      if (productElements.length > 0) {
        console.log(`Found ${productElements.length} products with selector: ${selector}`);
        break;
      }
    }
    
    if (productElements.length === 0) {
      console.log('No product elements found with any selector');
      return products;
    }
    
    productElements.each((i, element) => {
      try {
        // Skip sponsored products
        if ($(element).find('.puis-label-popover-default').length > 0 || 
            $(element).find('.s-sponsored-label').length > 0 ||
            $(element).find('.s-sponsored-label-info-icon').length > 0) {
          console.log('Skipping sponsored product');
          return;
        }
        
        // Try different selectors for title
        let title = '';
        const titleSelectors = [
          'h2 a span',
          'h2 span',
          '.a-size-medium',
          '.a-size-base-plus',
          '.a-text-normal'
        ];
        
        for (const selector of titleSelectors) {
          title = $(element).find(selector).first().text().trim();
          if (title) break;
        }
        
        if (!title) {
          console.log('Skipping product with missing title');
          return;
        }
        
        
        // Check if the product title contains all words from the search query
        if (!this.containsAllSearchWords(title, this.searchQuery)) {
          console.log(`Skipping product that doesn't match search words: ${title}`);
          return;
        }
        
        // Extract image URL
        let imageUrl = '';
        const imageSelectors = [
          'img.s-image',
          '.s-image',
          '.a-link-normal img',
          '.a-section img'
        ];
        
        for (const selector of imageSelectors) {
          const img = $(element).find(selector).first();
          if (img.length > 0) {
            imageUrl = img.attr('src') || '';
            // If srcset is available, try to get the larger image
            const srcset = img.attr('srcset');
            if (srcset) {
              const srcsetUrls = srcset.split(',').map(s => s.trim().split(' ')[0]);
              // Get the last URL which is typically the highest resolution
              if (srcsetUrls.length > 0) {
                imageUrl = srcsetUrls[srcsetUrls.length - 1] || imageUrl;
              }
            }
            if (imageUrl) break;
          }
        }
        
        // Try different selectors for price
        let price = 0;
        let currency = this.currency;
        
        // First try the structured price format
        const priceElement = $(element).find('.a-price:not(.a-text-price)').first();
        if (priceElement.length > 0) {
          const priceWhole = priceElement.find('.a-price-whole').first().text().trim();
          const priceFraction = priceElement.find('.a-price-fraction').first().text().trim() || '00';
          price = parseFloat(`${priceWhole || '0'}.${priceFraction}`);
        } else {
          // Try alternative price selectors
          const altPriceSelectors = [
            '[data-a-color="base"] .a-offscreen',
            '.a-price .a-offscreen',
            '.a-color-price',
            '.a-text-price'
          ];
          
          for (const selector of altPriceSelectors) {
            const priceText = $(element).find(selector).first().text().trim();
            if (priceText) {
              const { price: extractedPrice, currency: extractedCurrency } = this.extractPriceAndCurrency(priceText);
              if (extractedPrice > 0) {
                price = extractedPrice;
                currency = extractedCurrency || this.currency;
                break;
              }
            }
          }
        }
        
        // Skip if price is invalid
        if (!price || price <= 0) {
          console.log(`Skipping product with invalid price: ${title}`);
          return;
        }
        
        // Extract URL and ensure it's absolute
        let url = '';
        const urlSelectors = [
          'h2 a',
          '.a-link-normal',
          'a.a-link-normal'
        ];
        
        for (const selector of urlSelectors) {
          url = $(element).find(selector).first().attr('href');
          if (url) break;
        }
        
        if (!url) {
          console.log('Skipping product with missing URL');
          return;
        }
        
        // Convert relative URLs to absolute
        if (!url.startsWith('http')) {
          if (url.startsWith('/')) {
            url = this.baseUrl + url;
          } else {
            url = `${this.baseUrl}/${url}`;
          }
        }

        // Extract rating
        const rating = this.extractRating(element, $);
        
        // Extract product ID from URL
        const siteProductId = this.extractProductId(url);
        if (!siteProductId) {
          console.log(`Skipping product with invalid product ID: ${title}`);
          return;
        }

        // Extract review count
        let reviewCount = 0;
        const reviewSelectors = [
          '.a-size-small .a-link-normal',
          '.a-size-base .a-link-normal',
          '.a-size-small .a-text-normal'
        ];
        
        for (const selector of reviewSelectors) {
          const reviewText = $(element).find(selector).first().text().trim();
          if (reviewText) {
            const match = reviewText.match(/(\d+(?:,\d+)*)/);
            if (match) {
              reviewCount = parseInt(match[1].replace(/,/g, ''));
              break;
            }
          }
        }
        
        // Add the product to the results array
        const productId = this.extractProductId(url);
        if (productId) {
          products.push({
            title,
            currentPrice: price,
            currency,
            url: this.baseUrl + url,
            source: this.source,
            siteProductId: productId,
            imageUrl: imageUrl || '',
            rating: this.extractRating(element, $)
          });
        }
        
        console.log(`Found valid product: ${title} (ID: ${siteProductId}) at ${price} ${currency}`);
      } catch (error) {
        console.error('Error processing Amazon product:', error);
      }
    });

    return products;
  }

  async setupPage(page) {
    // Set a random user agent
    const userAgent = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    await page.setUserAgent(userAgent);

    // Set additional headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Connection': 'keep-alive',
      'DNT': '1'
    });

    // Set viewport
    await page.setViewport({
      width: 1920,
      height: 1080
    });
  }

  async searchProducts(query) {
    try {
      // Initialize browser with non-headless mode for better results
      await this.initialize(false);
      
      // Store the search query for later use
      this.searchQuery = query;
      
      // Refine the search query for better results
      const refinedQuery = this.refineSearchQuery ? this.refineSearchQuery(query) : query;
      const searchUrl = `${this.baseUrl}/s?k=${encodeURIComponent(refinedQuery)}`;
      
      logScraperStatus(`Searching Amazon for: ${refinedQuery}`, { url: searchUrl });
      
      // Navigate to search page with random delay
      await this.navigateToPage(this.page, searchUrl);
      
      // Add random delay to simulate human behavior
      await this.addRandomDelay(2000, 4000);
      
      // Take a screenshot for debugging (optional)
      await this.page.screenshot({ path: 'amazon-search-result.png' });
      
      // Check for CAPTCHA and wait for manual solution if needed
      const hasCaptcha = await this.page.evaluate(() => {
        return document.body.innerText.includes('CAPTCHA') || 
               document.body.innerText.includes('captcha') || 
               document.body.innerText.includes('Robot Check') ||
               document.body.innerText.includes('type the characters you see');
      });
      
      if (hasCaptcha) {
        logScraperStatus(`CAPTCHA detected on Amazon. Waiting for manual solution...`);
        // Alert the user to manually solve the CAPTCHA
        await this.page.evaluate(() => {
          alert('CAPTCHA detected! Please solve it manually within 2 minutes.');
        });
        
        // Wait for manual intervention
        await this.page.waitForTimeout(120000);
        
        // Check if CAPTCHA was solved
        const stillHasCaptcha = await this.page.evaluate(() => {
          return document.body.innerText.includes('CAPTCHA') || 
                 document.body.innerText.includes('captcha') || 
                 document.body.innerText.includes('Robot Check');
        });
        
        if (stillHasCaptcha) {
          logScraperStatus(`CAPTCHA not solved in time. Aborting search.`);
          return [];
        }
      }
      
      // Extract products using different methods for reliability
      const products = await this.extractProductsUsingMultipleMethods(refinedQuery);
      
      logScraperStatus(`Found ${products.length} products on Amazon`);
      
      return products;
    } catch (error) {
      logScraperStatus(`Error searching Amazon products`, { error: error.message });
      return [];
    } finally {
      // Ensure browser is closed to free resources
      await this.close();
    }
  }

  async extractProductsUsingMultipleMethods(query) {
    const products = [];
    
    try {
      // Method 1: Using cheerio with page content
      const html = await this.page.content();
      const $ = cheerio.load(html);
      
      logScraperStatus(`Extracting products using cheerio...`);
      
      // Try different selectors for product containers
      const productSelectors = [
        '.s-result-item[data-component-type="s-search-result"]',
        '.s-search-result',
        '.sg-col-4-of-12',
        '.sg-col-4-of-16',
        '.sg-col-4-of-20'
      ];
      
      let productElements = [];
      let usedSelector = '';
      
      // Try each selector until we find products
      for (const selector of productSelectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          productElements = elements;
          usedSelector = selector;
          logScraperStatus(`Found ${elements.length} products with selector: ${selector}`);
          break;
        }
      }
      
      // Process each product element
      productElements.each((i, element) => {
        try {
          // Skip sponsored products
          const isSponsored = $(element).find('.puis-label-popover-default').length > 0 || 
                             $(element).find('.s-sponsored-label').length > 0 ||
                             $(element).find('.s-sponsored-label-info-icon').length > 0;
          
          if (isSponsored) {
            logScraperStatus(`Skipping sponsored product`);
            return;
          }
          
          // Extract title using multiple selectors
          let title = '';
          const titleSelectors = [
            'h2 a span',
            'h2 span',
            '.a-size-medium',
            '.a-size-base-plus',
            '.a-text-normal',
            '.a-link-normal .a-text-normal'
          ];
          
          for (const selector of titleSelectors) {
            title = $(element).find(selector).first().text().trim();
            if (title) break;
          }
          
          if (!title) {
            logScraperStatus(`Skipping product with missing title`);
            return;
          }
          
          // Extract price using multiple selectors
          let price = 0;
          const priceSelectors = [
            '.a-price .a-offscreen',
            '.a-price',
            '.a-color-base',
            '.a-price-whole'
          ];
          
          let priceText = '';
          for (const selector of priceSelectors) {
            priceText = $(element).find(selector).first().text().trim();
            if (priceText) break;
          }
          
          if (priceText) {
            // Clean up price text (remove currency symbols and commas)
            const cleanPrice = priceText.replace(/[^0-9,.]/g, '').replace(/,/g, '');
            price = parseFloat(cleanPrice) || 0;
          }
          
          if (!price) {
            logScraperStatus(`Skipping product with missing price`);
            return;
          }
          
          // Extract URL
          let url = '';
          const linkSelector = 'h2 a, .a-link-normal';
          const linkElement = $(element).find(linkSelector).first();
          
          if (linkElement.length > 0) {
            url = linkElement.attr('href');
            if (url && !url.startsWith('http')) {
              url = `${this.baseUrl}${url}`;
            }
          }
          
          if (!url) {
            logScraperStatus(`Skipping product with missing URL`);
            return;
          }
          
          // Extract rating (if available)
          let rating = 0;
          const ratingText = $(element).find('.a-icon-star-small .a-icon-alt, .a-icon-star .a-icon-alt').first().text().trim();
          if (ratingText) {
            const ratingMatch = ratingText.match(/([0-9.]+)/);
            if (ratingMatch) {
              rating = parseFloat(ratingMatch[1]);
            }
          }
          
          // Extract image URL (if needed)
          let imageUrl = '';
          const imageElement = $(element).find('img').first();
          if (imageElement.length > 0) {
            imageUrl = imageElement.attr('src') || '';
          }
          
          // Generate a unique product ID
          const productId = url.split('/').pop().split('?')[0] || `amazon-${Math.random().toString(36).substring(2, 10)}`;
          
          // Create product object
          const product = {
            title,
            currentPrice: price,
            originalPrice: 0, // Could extract this if available
            url,
            imageUrl,
            rating,
            source: 'amazon',
            siteProductId: productId,
            currency: 'USD',
            availability: true,
            lastUpdated: new Date()
          };
          
          products.push(product);
          logScraperStatus(`Added product: ${title}`);
          
          // Limit the number of products
          if (products.length >= this.maxProducts) {
            return false; // Stop .each() iteration
          }
        } catch (error) {
          logScraperStatus(`Error extracting product details`, { error: error.message });
        }
      });
      
      // If we didn't find any products using cheerio, try direct DOM extraction
      if (products.length === 0) {
        logScraperStatus(`No products found using cheerio, trying direct DOM extraction`);
        
        const directProducts = await this.page.evaluate(() => {
          const results = [];
          const productElements = document.querySelectorAll('.s-result-item[data-component-type="s-search-result"], .s-search-result');
          
          productElements.forEach(element => {
            try {
              // Skip sponsored
              if (element.querySelector('.puis-label-popover-default, .s-sponsored-label')) {
                return;
              }
              
              // Get title
              const titleElement = element.querySelector('h2 a span, h2 span, .a-size-medium, .a-text-normal');
              if (!titleElement) return;
              
              const title = titleElement.textContent.trim();
              if (!title) return;
              
              // Get price
              const priceElement = element.querySelector('.a-price .a-offscreen, .a-price, .a-color-base');
              if (!priceElement) return;
              
              let priceText = priceElement.textContent.trim();
              if (!priceText) return;
              
              // Clean price
              const cleanPrice = priceText.replace(/[^0-9,.]/g, '').replace(/,/g, '');
              const price = parseFloat(cleanPrice);
              if (!price) return;
              
              // Get URL
              const linkElement = element.querySelector('h2 a, .a-link-normal');
              if (!linkElement) return;
              
              let url = linkElement.getAttribute('href');
              if (!url) return;
              
              // Make URL absolute
              if (!url.startsWith('http')) {
                url = 'https://www.amazon.com' + url;
              }
              
              // Get image
              const imageElement = element.querySelector('img');
              const imageUrl = imageElement ? imageElement.getAttribute('src') : '';
              
              // Get rating
              let rating = 0;
              const ratingElement = element.querySelector('.a-icon-star-small .a-icon-alt, .a-icon-star .a-icon-alt');
              if (ratingElement) {
                const ratingText = ratingElement.textContent.trim();
                const ratingMatch = ratingText.match(/([0-9.]+)/);
                if (ratingMatch) {
                  rating = parseFloat(ratingMatch[1]);
                }
              }
              
              // Add to results
              results.push({
                title,
                currentPrice: price,
                url,
                imageUrl,
                rating,
                siteProductId: url.split('/').pop().split('?')[0] || `amazon-${Math.random().toString(36).substring(2, 10)}`,
                currency: 'USD'
              });
            } catch (e) {
              // Skip this product on error
            }
          });
          
          return results;
        });
        
        // Add direct extraction products
        directProducts.forEach(product => {
          products.push({
            ...product,
            source: 'amazon',
            availability: true,
            lastUpdated: new Date()
          });
          logScraperStatus(`Added product (direct extraction): ${product.title}`);
        });
      }
    } catch (error) {
      logScraperStatus(`Error in product extraction`, { error: error.message });
    }
    
    return products;
  }

  async getProductDetails(url) {
    try {
      await this.initialize();
      await this.page.goto(url, { waitUntil: 'networkidle0' });
      
      // Wait for product title
      await this.waitForSelector('#productTitle');
      
      const title = await this.extractText('#productTitle');
      
      // Try multiple selectors for price
      let priceText = '';
      const priceSelectors = [
        '.a-price .a-offscreen',
        '.a-price-whole',
        '.a-price-fraction',
        '.a-color-price',
        '.a-text-price'
      ];
      
      for (const selector of priceSelectors) {
        priceText = await this.extractText(selector);
        if (priceText) {
          logScraperStatus(`Found price with selector`, { 
            selector, 
            priceText 
          });
          break;
        }
      }
      
      // Try to extract price from structured format if available
      let price = 0;
      let currency = this.currency;
      
      // Check if we have a structured price format (whole + fraction)
      const wholePriceEl = await this.page.evaluate(() => {
        const wholeEl = document.querySelector('.a-price-whole');
        return wholeEl ? wholeEl.textContent.trim() : null;
      });
      
      const fractionPriceEl = await this.page.evaluate(() => {
        const fractionEl = document.querySelector('.a-price-fraction');
        return fractionEl ? fractionEl.textContent.trim() : null;
      });
      
      if (wholePriceEl) {
        // We have a structured price format
        const wholePrice = wholePriceEl.replace(/,/g, '');
        const fractionPrice = fractionPriceEl || '00';
        price = parseFloat(`${wholePrice}.${fractionPrice}`);
        
        // Extract currency from the price element
        const currencyEl = await this.page.evaluate(() => {
          const priceEl = document.querySelector('.a-price');
          return priceEl ? priceEl.getAttribute('data-a-currency-code') : null;
        });
        
        if (currencyEl) {
          currency = currencyEl;
        }
        
        logScraperStatus(`Extracted structured price`, { 
          price, 
          currency, 
          wholePrice, 
          fractionPrice 
        });
      } else {
        // Use the standard price extraction method
        const extracted = this.extractPriceAndCurrency(priceText);
        price = extracted.price;
        currency = extracted.currency;
        logScraperStatus(`Extracted price from text`, { 
          priceText, 
          price, 
          currency 
        });
      }
      
      const description = await this.extractText('#productDescription');
      
      const rating = await this.page.evaluate(() => {
        const ratingEl = document.querySelector('#acrPopover');
        if (!ratingEl) return 0;
        const ratingText = ratingEl.title.trim();
        const match = ratingText.match(/(\d+(\.\d+)?)/);
        return match ? parseFloat(match[1]) : 0;
      });
      
      const reviewCount = await this.page.evaluate(() => {
        const reviewEl = document.querySelector('#acrCustomerReviewText');
        if (!reviewEl) return 0;
        const reviewText = reviewEl.textContent.trim();
        const match = reviewText.match(/(\d+(?:,\d+)*)/);
        return match ? parseInt(match[1].replace(/,/g, '')) : 0;
      });
      
      const imageUrl = await this.extractAttribute('#landingImage', 'src');
      
      // Extract reviews
      const reviews = await this.extractReviews();
      
      return {
        title,
        url,
        price,
        currency,
        description,
        rating,
        reviewCount,
        imageUrl,
        reviews,
        source: this.source
      };
    } catch (error) {
      logScraperStatus(`Error getting Amazon product details`, { error: error.message });
      throw error;
    } finally {
      await this.close();
    }
  }

  async extractReviews() {
    const reviews = [];
    try {
      // Click on "See all reviews" if available
      const seeAllReviewsButton = await this.page.$('#cr-pagination-link-top');
      if (seeAllReviewsButton) {
        await seeAllReviewsButton.click();
        await this.page.waitForNavigation({ waitUntil: 'networkidle0' });
      }
      
      // Extract reviews from the first page
      const reviewElements = await this.page.$$('#cm-cr-dp-review-list div.review');
      
      for (const element of reviewElements) {
        try {
          const title = await this.page.evaluate(el => {
            const titleEl = el.querySelector('.review-title');
            return titleEl ? titleEl.textContent.trim() : '';
          }, element);
          
          const text = await this.page.evaluate(el => {
            const textEl = el.querySelector('.review-text');
            return textEl ? textEl.textContent.trim() : '';
          }, element);
          
          const rating = await this.page.evaluate(el => {
            const ratingEl = el.querySelector('.review-rating');
            if (!ratingEl) return 0;
            const ratingText = ratingEl.textContent.trim();
            const match = ratingText.match(/(\d+(\.\d+)?)/);
            return match ? parseFloat(match[1]) : 0;
          }, element);
          
          const date = await this.page.evaluate(el => {
            const dateEl = el.querySelector('.review-date');
            return dateEl ? dateEl.textContent.trim() : '';
          }, element);
          
          if (title && text && rating > 0) {
            reviews.push({
              title,
              text,
              rating,
              date
            });
          }
        } catch (error) {
          logScraperStatus(`Error extracting review`, { error: error.message });
          continue;
        }
      }
    } catch (error) {
      logScraperStatus(`Error extracting reviews`, { error: error.message });
    }
    
    return reviews;
  }

  async initialize(headless = true) {
    if (this.browser) return;

    try {
      logScraperStatus(`Initializing Amazon scraper in ${headless ? 'headless' : 'non-headless'} mode`);
      
      // Use non-headless mode for Amazon to bypass bot detection
      this.browser = await puppeteer.launch({
        headless: headless, // Run in non-headless mode
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-site-isolation-trials',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920,1080',
          '--disable-blink-features=AutomationControlled', // Important for avoiding detection
          '--disable-notifications',
          '--disable-extensions',
          '--disable-popup-blocking',
          '--disable-infobars',
          '--disable-save-password-bubble',
          '--disable-translate',
          '--disable-zero-browsers-open-for-tests',
          '--no-first-run',
          '--no-default-browser-check',
          '--password-store=basic',
          '--use-mock-keychain',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-breakpad',
          '--disable-component-extensions-with-background-pages',
          '--disable-features=TranslateUI,BlinkGenPropertyTrees',
          '--disable-ipc-flooding-protection',
          '--disable-renderer-backgrounding',
          '--enable-features=NetworkService,NetworkServiceInProcess',
          '--metrics-recording-only',
          '--mute-audio'
        ],
        defaultViewport: {
          width: 1920,
          height: 1080
        },
        ignoreHTTPSErrors: true
      });
      
      this.page = await this.browser.newPage();
      
      // Set a random user agent
      const userAgent = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
      await this.page.setUserAgent(userAgent);
      logScraperStatus(`Using user agent`, { userAgent });
      
      // Set additional headers to appear more like a real browser
      await this.page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Connection': 'keep-alive',
        'DNT': '1',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
      });
      
      // Add random mouse movements and scrolling to appear more human-like
      await this.page.evaluateOnNewDocument(() => {
        // Override navigator properties to avoid detection
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
        Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
        Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
        
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
        
        // Override the permissions API
        const originalPermissionsQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalPermissionsQuery(parameters)
        );
      });
      
      // Add random delays between actions
      this.page.setDefaultNavigationTimeout(120000); // Increase timeout to 2 minutes
      this.page.setDefaultTimeout(120000);
      
      // Set up request interception to block unnecessary resources
      await this.page.setRequestInterception(true);
      this.page.on('request', (request) => {
        const resourceType = request.resourceType();
        // Block unnecessary resources to speed up page loading
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          request.abort();
        } else {
          request.continue();
        }
      });
      
      logScraperStatus(`${this.constructor.name} initialized successfully in ${headless ? 'headless' : 'non-headless'} mode`);
    } catch (error) {
      logScraperStatus(`Error initializing ${this.constructor.name}`, { error: error.message });
      throw error;
    }
  }

  async checkForCaptcha() {
    return await this.page.evaluate(() => {
      const pageText = document.body.innerText.toLowerCase();
      return pageText.includes('enter the characters you see below') ||
             pageText.includes('type the characters you see in this image') ||
             pageText.includes('sorry, we just need to make sure you') ||
             pageText.includes('to discuss automated access to amazon data please contact') ||
             pageText.includes('solve this puzzle to protect your account') ||
             pageText.includes('captcha') ||
             pageText.includes('verify you are a human') ||
             pageText.includes('unusual traffic') ||
             pageText.includes('robot check');
    });
  }

  async simulateHumanScrolling() {
    // Add random scrolling to appear more human-like
    await this.page.evaluate(() => {
      // Scroll down in increments
      const scrollSteps = Math.floor(Math.random() * 5) + 3;
      for (let i = 0; i < scrollSteps; i++) {
        const scrollAmount = Math.floor(Math.random() * 300) + 100;
        window.scrollBy(0, scrollAmount);
      }
      
      // Sometimes scroll back up a bit
      if (Math.random() > 0.7) {
        window.scrollBy(0, -Math.floor(Math.random() * 200));
      }
    });
    
    // Add random delay
    await this.addRandomDelay(2000, 5000);
  }
}

module.exports = AmazonScraper; 