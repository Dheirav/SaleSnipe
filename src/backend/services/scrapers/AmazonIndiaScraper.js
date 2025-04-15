const BaseScraper = require('./BaseScraper');

// Import the logging function from BaseScraper instead of scraperService to avoid circular dependency
const { logScraperStatus } = require('./BaseScraper');

class AmazonIndiaScraper extends BaseScraper {
  constructor() {
    super();
    this.source = 'amazon_in';
    this.baseUrl = 'https://www.amazon.in';
  }

  // Add a method to refine search queries
  refineSearchQuery(query) {
    // For now, just return the original query
    // You can add more sophisticated refinement logic here if needed
    return query;
  }

  async simulateHumanBehavior() {
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
  }

  async randomDelay(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // Add a helper method to wait for content to load
  async waitForProductsToLoad(timeout = 10000) {
    logScraperStatus(`Waiting for products to load with ${timeout}ms timeout`);
    
    try {
      // Wait for any of the known product selectors to appear
      const selectors = [
        '.s-result-item[data-component-type="s-search-result"]',
        '.sg-col-20-of-24.s-result-item',
        '.s-asin'
      ];
      
      const selectorString = selectors.join(', ');
      
      // Wait for the selector with the specified timeout
      await this.page.waitForSelector(selectorString, { timeout });
      
      // Wait an additional second for more elements to load
      await this.randomDelay(1000, 2000);
      
      // Count how many product elements we found
      const count = await this.page.evaluate((selector) => {
        return document.querySelectorAll(selector).length;
      }, selectorString);
      
      logScraperStatus(`Found ${count} product elements after waiting`);
      return count > 0;
    } catch (error) {
      logScraperStatus(`Timeout waiting for products: ${error.message}`);
      return false;
    }
  }

  async searchProducts(query) {
    try {
      // Initialize with non-headless mode to better handle site structure and avoid detection
      await this.initialize(false);
      
      // Check if the function already exists in the page context
      const functionExists = await this.page.evaluate(() => {
        return typeof window.amazonInScraperExtractPrice === 'function';
      }).catch(() => false);
      
      // Only expose the function if it doesn't already exist
      if (!functionExists) {
        // IMPORTANT: Expose the extractPrice function to the page context
        await this.page.exposeFunction('amazonInScraperExtractPrice', (priceText) => {
          return this.extractPrice(priceText);
        });
      }
      
      // Refine search query for better results
      const refinedQuery = this.refineSearchQuery(query);
      
      // If query contains "Dell laptop", try analyzing a sample product first to understand the structure
      if (query.toLowerCase().includes('dell') && query.toLowerCase().includes('laptop')) {
        await this.analyzeSampleProduct();
      }
      
      // Use a more reliable URL structure for Amazon India
      const searchUrl = `${this.baseUrl}/s?k=${encodeURIComponent(refinedQuery)}&ref=nb_sb_noss`;
      
      logScraperStatus(`Starting Amazon India search`, { query: refinedQuery, url: searchUrl });
      
      // Configure page to better mimic a real browser
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
      
      // Set extra headers to make the request more authentic
      await this.page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-User': '?1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"'
      });
      
      // Increase navigation timeout
      this.page.setDefaultNavigationTimeout(60000); // 60 seconds
      
      // Navigate to search page with better error handling
      try {
        logScraperStatus(`Navigating to Amazon India search page`, { url: searchUrl });
        await this.page.goto(searchUrl, { 
          waitUntil: 'networkidle2', // Wait for network to be idle
          timeout: 60000 // 60 seconds timeout
        });
        logScraperStatus(`Successfully navigated to search page`);
      } catch (navError) {
        logScraperStatus(`Navigation error for ${searchUrl}: ${navError.message}`);
        
        // Check if page has at least some content despite the timeout
        const pageContent = await this.page.content().catch(() => '');
        if (pageContent && (pageContent.includes('amazon.in') || pageContent.includes('<body'))) {
          logScraperStatus(`Page loaded partially, continuing with extraction`);
        } else {
          throw new Error(`Failed to load Amazon India search page: ${navError.message}`);
        }
      }
      
      // Add a longer delay to allow page to fully load
      await this.randomDelay(5000, 8000);
      
      // Take a screenshot for debugging
      await this.page.screenshot({ path: 'amazon-india-search.png' });
      
      // Check for CAPTCHA or robot check
      const hasCaptcha = await this.page.evaluate(() => {
        return document.body.innerText.includes('CAPTCHA') || 
               document.body.innerText.includes('captcha') ||
               document.body.innerText.includes('Robot Check') ||
               document.body.innerText.includes('Enter the characters you see below') ||
               document.body.innerText.includes('Sorry, we just need to make sure you\'re not a robot');
      });
      
      if (hasCaptcha) {
        logScraperStatus(`CAPTCHA detected on Amazon India`, { url: searchUrl });
        
        // Take a screenshot of the CAPTCHA page for debugging
        await this.page.screenshot({ path: 'amazon-india-captcha.png' });
        
        // Only show alert in non-headless mode
        if (this.page.browser().isConnected()) {
          try {
            // Alert user to solve CAPTCHA
            await this.page.evaluate(() => {
              alert('CAPTCHA detected! Please solve it manually to continue scraping.');
            });
            
            logScraperStatus(`Waiting for 2 minutes for manual CAPTCHA solving...`);
            
            // Wait for manual intervention (2 minutes)
            await this.page.waitForTimeout(120000);
            
            // Take another screenshot after CAPTCHA handling
            await this.page.screenshot({ path: 'amazon-india-after-captcha.png' });
            
            // Check if CAPTCHA is still present
            const captchaStillPresent = await this.page.evaluate(() => {
              return document.body.innerText.includes('CAPTCHA') || 
                     document.body.innerText.includes('captcha') ||
                     document.body.innerText.includes('Robot Check');
            });
            
            if (captchaStillPresent) {
              logScraperStatus(`CAPTCHA not solved within timeout, aborting`);
              return [];
            } else {
              logScraperStatus(`CAPTCHA appears to have been solved, continuing`);
            }
          } catch (alertError) {
            logScraperStatus(`Error displaying CAPTCHA alert: ${alertError.message}`);
          }
        } else {
          logScraperStatus(`CAPTCHA detected in headless mode, cannot show alert for solving`);
          return [];
        }
      }
      
      // Wait for product results with multiple possible selectors (longer timeout)
      const productsLoaded = await this.waitForProductsToLoad(15000);
      
      if (!productsLoaded) {
        // If no products found with normal wait, try interacting with the page
        logScraperStatus('No products found with initial waiting, trying to trigger loading with scrolling');
        
        // Scroll down to trigger lazy loading
        await this.simulateHumanScrolling();
        
        // Wait again for products to appear
        const productsLoadedAfterScroll = await this.waitForProductsToLoad(10000);
        
        if (!productsLoadedAfterScroll) {
          // Check if no results message is displayed
          const noResults = await this.page.evaluate(() => {
            return document.body.innerText.includes('No results for') ||
                   document.body.innerText.includes('did not match any products') ||
                   document.body.innerText.includes('No se encontraron resultados');
          });
          
          if (noResults) {
            logScraperStatus(`No results found on Amazon India for: ${refinedQuery}`);
            return [];
          }
          
          // Try checking page content directly for product indications
          const pageContent = await this.page.content();
          if (!pageContent.includes('₹') || !pageContent.includes('product')) {
            logScraperStatus(`No recognizable product content found on Amazon India`, { query: refinedQuery });
            await this.page.screenshot({ path: 'amazon-india-no-results.png' });
        return [];
          }
          
          // Try one more time with a different approach - clicking on a filter
          try {
            const hasFilters = await this.page.evaluate(() => {
              // Try to find and click a Department filter or any other interactive element
              const filterElement = document.querySelector('.a-checkbox-label, .a-expander-prompt');
              if (filterElement) {
                filterElement.click();
                return true;
              }
              return false;
            });
            
            if (hasFilters) {
              logScraperStatus('Clicked on a filter to try triggering content load');
              await this.randomDelay(3000, 5000);
              await this.simulateHumanScrolling();
              await this.waitForProductsToLoad(10000);
            }
          } catch (filterError) {
            logScraperStatus(`Error trying to click filters: ${filterError.message}`);
          }
        }
      }
      
      // Simulate scrolling to load all products
      await this.simulateHumanScrolling();
      
      // Take a final screenshot before extraction
      await this.page.screenshot({ path: 'amazon-india-before-extraction.png' });
      
      // Extract products from the page
      const products = await this.extractProductsFromPage(query);
      
      logScraperStatus(`Found ${products.length} products on Amazon India`, { query: refinedQuery });
      return products;
    } catch (error) {
      logScraperStatus(`Error searching Amazon India: ${error.message}`, { 
        stack: error.stack 
      });
      return [];
    } finally {
      // Ensure browser is closed
      await this.close();
    }
  }

  async simulateHumanScrolling() {
    try {
      // Scroll down in multiple steps with random delays
      const scrollSteps = [300, 500, 700, 500, 300];
      
      for (const step of scrollSteps) {
        await this.page.evaluate((scrollAmount) => {
          window.scrollBy(0, scrollAmount);
        }, step);
        
        // Random delay between scrolls
        await this.randomDelay(800, 1500);
      }
      
      // Scroll back up a bit to mimic natural browsing
      await this.page.evaluate(() => {
        window.scrollBy(0, -400);
      });
      
      await this.randomDelay(1000, 2000);
    } catch (error) {
      logScraperStatus(`Error in simulateHumanScrolling: ${error.message}`);
      // Continue execution despite scrolling errors
    }
  }

  async extractProductsFromPage(query) {
    const products = [];
    
    try {
      // Log the start of extraction
      logScraperStatus('Starting product extraction from Amazon India page');
      
      // First check if the function already exists in the page context
      const functionExists = await this.page.evaluate(() => {
        return typeof window.amazonInScraperExtractPrice === 'function';
      }).catch(() => false);
      
      // Only expose the function if it doesn't already exist
      if (!functionExists) {
        // Expose the extraction function to the page context
        await this.page.exposeFunction('amazonInScraperExtractPrice', (priceText) => {
          return this.extractPrice(priceText);
        });
        
        // Also check if generic extractPrice exists
        const genericExists = await this.page.evaluate(() => {
          return typeof window.extractPrice === 'function';
        }).catch(() => false);
        
        if (!genericExists) {
          await this.page.exposeFunction('extractPrice', (priceText) => {
            return this.extractPrice(priceText);
          });
        }
      }
      
      // Take a screenshot of the page with products
      await this.page.screenshot({ path: 'amazon-india-products.png' });
      
      // Count products on the page before extraction
      const productCount = await this.page.evaluate(() => {
        const products = document.querySelectorAll('.s-result-item[data-component-type="s-search-result"]');
        return products.length;
      });
      
      logScraperStatus(`Found ${productCount} potential product elements on page`);
      
      // Extract products via evaluate to avoid element handle issues
      const extractedProducts = await this.page.evaluate(() => {
        const results = [];
        
        // Find all product elements with more flexible selectors
        const productElements = document.querySelectorAll('.s-result-item[data-component-type="s-search-result"], .sg-col-20-of-24.s-result-item, .s-asin');
        
        console.log(`Found ${productElements.length} potential products`);
        
        // Process only a limited number to avoid memory issues
        const maxProducts = Math.min(productElements.length, 20);
        
        for (let i = 0; i < maxProducts; i++) {
          try {
            const element = productElements[i];
            
            // Skip if element is hidden or not valid
            if (!element || !element.isConnected || 
                (element.offsetParent === null && element.style.display === 'none')) {
              console.log('Skipping invalid or hidden element');
              continue;
            }
            
          // Skip sponsored products
            if (element.innerText.includes('Sponsored') || 
                element.querySelector('.puis-sponsored-label-text') ||
                element.querySelector('.s-sponsored-label-info-icon')) {
              console.log('Skipping sponsored product');
              continue;
            }
            
            // Extract title
            let title = '';
            const titleSelectors = [
              'h2 a span',
              'h2 span',
              '.a-size-medium.a-color-base.a-text-normal',
              '.a-size-base-plus.a-color-base.a-text-normal',
              '.a-link-normal .a-text-normal',
              '.a-text-normal',
              '.a-size-mini a span',
              // Add more comprehensive selectors
              'h2',
              '.a-link-normal[href*="/dp/"] span',
              '.a-color-base.a-text-normal'
            ];
            
            for (const selector of titleSelectors) {
              const titleEl = element.querySelector(selector);
              if (titleEl) {
                title = titleEl.textContent.trim();
                if (title) {
                  console.log(`Found title: ${title}`);
                  break;
                }
              }
            }
            
            if (!title) {
              console.log(`No title found for element ${i}, trying innerText`);
              // Try getting any text as a fallback
              const elementText = element.innerText.trim();
              if (elementText) {
                // Try to extract what looks like a title - first few words
                const lines = elementText.split('\n').filter(line => line.trim());
                if (lines.length > 0) {
                  title = lines[0].trim();
                }
              }
              
              if (!title) {
                console.log('Still no title, skipping');
                continue;
              }
            }
            
            // Extract URL
            let url = '';
            const linkSelectors = [
              'h2 a',
              '.a-link-normal',
              '.a-text-normal',
              '.s-product-image-container a',
              // Add more comprehensive selectors
              'a[href*="/dp/"]',
              'a[href*="/gp/product/"]'
            ];
            
            for (const selector of linkSelectors) {
              const linkEl = element.querySelector(selector);
              if (linkEl && linkEl.href) {
                url = linkEl.href;
                console.log(`Found URL: ${url}`);
                
                // Remove query parameters from URL for cleaner product links
                if (url.includes('/dp/')) {
                  const dpMatch = url.match(/(\/dp\/[A-Z0-9]{10})/);
                  if (dpMatch) {
                    url = 'https://www.amazon.in' + dpMatch[1];
                  }
                }
                
                if (url) break;
              }
            }
            
            if (!url) {
              console.log('No URL found, skipping');
            continue;
          }
          
            // Extract product ID
            let productId = null;
            const idMatches = url.match(/\/dp\/([A-Z0-9]{10})/);
            if (idMatches && idMatches[1]) {
              productId = idMatches[1];
              console.log(`Found product ID: ${productId}`);
            } else {
              // Try alternative ID extraction
              const altIdMatch = element.getAttribute('data-asin');
              if (altIdMatch) {
                productId = altIdMatch;
                console.log(`Found product ID from data-asin: ${productId}`);
                // If we found ASIN but URL doesn't have it, fix the URL
                if (!url.includes('/dp/')) {
                  url = `https://www.amazon.in/dp/${productId}`;
                }
              } else {
                // Generate a unique ID if nothing else works
                productId = `amazon_in_${Date.now()}_${i}`;
                console.log(`Generated fallback ID: ${productId}`);
              }
            }
            
            // Extract price
            let price = 0;
            let currency = 'INR';
            let priceText = '';
            const priceSelectors = [
              '.a-price .a-offscreen',
              '.a-price-whole',
              '.a-price:not(.a-text-price) .a-offscreen',
              '.a-color-price',
              '.a-price .a-price-symbol + .a-price-whole',
              // Add more comprehensive selectors
              '.a-price',
              '.a-color-base.a-text-normal',
              '.a-price-whole'
            ];
            
            for (const selector of priceSelectors) {
              const priceEl = element.querySelector(selector);
              if (priceEl) {
                priceText = priceEl.textContent.trim();
                if (priceText) {
                  console.log(`Found price text: ${priceText}`);
                  
                  // Simple raw price extraction - no need for complex processing
                  // Just store the raw text and currency symbol
                  
                  // Check for common currency symbols
                  if (priceText.includes('₹')) {
                    currency = 'INR';
                    // Remove the currency symbol for cleaner display
                    priceText = priceText.replace(/₹/g, '').trim();
                  } else if (priceText.includes('$')) {
                    currency = 'USD';
                    priceText = priceText.replace(/\$/g, '').trim();
                  } else if (priceText.includes('€')) {
                    currency = 'EUR';
                    priceText = priceText.replace(/€/g, '').trim();
                  } else if (priceText.includes('£')) {
                    currency = 'GBP';
                    priceText = priceText.replace(/£/g, '').trim();
                  }
                  
                  // Remove commas and spaces
                  const cleanPrice = priceText.replace(/,|\s+/g, '');
                  price = parseFloat(cleanPrice);
                  
                  if (!isNaN(price) && price > 0) {
                    console.log(`Extracted price: ${price} ${currency}`);
                    break;
                  }
                }
              }
            }
            
            // If price is still 0, look for text with ₹ symbol
            if (!price || isNaN(price) || price <= 0) {
              console.log('No price found with selectors, looking for ₹ symbol in text');
              const priceMatch = element.innerText.match(/[₹$€£]\s*([\d,.]+)/);
              if (priceMatch && priceMatch[1]) {
                console.log(`Found price via regex: ${priceMatch[0]}`);
                
                // Determine currency from the match
                if (priceMatch[0].includes('₹')) currency = 'INR';
                else if (priceMatch[0].includes('$')) currency = 'USD';
                else if (priceMatch[0].includes('€')) currency = 'EUR';
                else if (priceMatch[0].includes('£')) currency = 'GBP';
                
                // Clean and parse the price
                const cleanPrice = priceMatch[1].replace(/,/g, '');
                price = parseFloat(cleanPrice);
                console.log(`Extracted price from text: ${price} ${currency}`);
              }
            }
            
            // For testing, allow products without prices to be included with a default price
            if (!price || isNaN(price) || price <= 0) {
              console.log('No valid price found, using default price');
              price = 0; // Include with zero price for debugging
            }
            
            // Extract rating
            let rating = null;
            const ratingTextMatch = element.innerText.match(/([0-9](\.[0-9])?) out of 5 stars/);
            if (ratingTextMatch && ratingTextMatch[1]) {
              rating = parseFloat(ratingTextMatch[1]);
              console.log(`Found rating: ${rating}`);
            }
            
            // Extract image URL
            let imageUrl = '';
            const imageSelectors = [
              '.s-image',
              'img.s-image',
              '.a-section.aok-relative img',
              '.a-link-normal img',
              'img[data-image-index]',
              'img[data-a-image-name]'
            ];
            
            for (const selector of imageSelectors) {
              const imgEl = element.querySelector(selector);
              if (imgEl && imgEl.src) {
                imageUrl = imgEl.src;
                
                // Check for srcset for higher quality images
                if (imgEl.srcset) {
                  const srcsetUrls = imgEl.srcset.split(',').map(s => s.trim().split(' ')[0]);
                  // Get the last URL which is typically the highest resolution
                  if (srcsetUrls.length > 0) {
                    imageUrl = srcsetUrls[srcsetUrls.length - 1] || imageUrl;
                  }
                }
                
                console.log(`Found image URL: ${imageUrl}`);
                break;
              }
            }
            
            // Add the product to results
            console.log(`Adding product to results: ${title}`);
            results.push({
              title,
              url,
              price,
              currency,
              rating,
              productId,
              imageUrl,
              reviews: [] // Initialize empty reviews array, will be populated later if needed
            });
          } catch (e) {
            console.error(`Error processing product: ${e.message}`);
          }
        }
        
        console.log(`Extracted ${results.length} products successfully`);
        return results;
      });
      
      logScraperStatus(`Extracted ${extractedProducts.length} products from page evaluation`);
      
      // Process the extracted products
      for (const item of extractedProducts) {
        try {
          // For debugging, include all products
          const matchesQuery = this.containsAllSearchWords(item.title, query);
          if (!matchesQuery) {
            logScraperStatus(`Product doesn't match search words (including anyway for debug)`, {
              title: item.title,
              query
            });
            // continue; // Commented out for debugging
          }
          
          // Create product object
          const product = {
            title: item.title,
            url: item.url,
            currentPrice: item.price,
            currency: item.currency,
            source: this.source,
            siteProductId: item.productId,
            rating: item.rating,
            imageUrl: item.imageUrl || '',
            reviews: item.reviews,
            lastUpdated: new Date()
          };
          
          products.push(product);
          
          logScraperStatus(`Added product from Amazon India`, {
            title: item.title,
            price: `${item.price} ${item.currency}`,
            rating: item.rating ? `${item.rating}/5` : 'N/A'
          });
        } catch (error) {
          logScraperStatus(`Error processing product from Amazon India`, { error: error.message });
          continue;
        }
      }
      
      return products;
    } catch (error) {
      logScraperStatus(`Error extracting products from Amazon India page: ${error.message}`, { 
        stack: error.stack 
      });
      return products; // Return any products found before the error
    }
  }

  async getProductDetails(url) {
    try {
      logScraperStatus(`Getting product details from Amazon India`, { url });
      
      // Initialize browser if needed
      if (!this.page) {
        await this.initialize(false);
      }
      
      // Check if the function already exists in the page context
      const functionExists = await this.page.evaluate(() => {
        return typeof window.amazonInScraperExtractPrice === 'function';
      }).catch(() => false);
      
      // Only expose the function if it doesn't already exist
      if (!functionExists) {
        // IMPORTANT: Expose the extractPrice function to the page context
        await this.page.exposeFunction('amazonInScraperExtractPrice', (priceText) => {
          return this.extractPrice(priceText);
        });
      }
      
      await this.navigateToPage(this.page, url);
      await this.randomDelay(2000, 4000);
      
      // Check for CAPTCHA
      const hasCaptcha = await this.page.evaluate(() => {
        return document.body.innerText.includes('CAPTCHA') || 
               document.body.innerText.includes('captcha') ||
               document.body.innerText.includes('Robot Check') ||
               document.body.innerText.includes('Enter the characters you see below');
      });
      
      if (hasCaptcha) {
        logScraperStatus(`CAPTCHA detected on Amazon India product page`, { url });
        await this.page.waitForTimeout(30000);
      }
      
      // Wait for product title
      const hasTitle = await this.waitForSelector('#productTitle', 10000);
      if (!hasTitle) {
        throw new Error('Product title not found');
      }
      
      // Extract product details
      const title = await this.extractText('#productTitle');
      
      // Extract price and currency using our new method
      const priceResult = await this.extractPriceFromPage(this.page);
      const price = priceResult.price || 0;
      const currency = priceResult.currency || 'INR';
      
      // Extract rating if available
      const ratingElement = await this.page.$('.a-icon-star-small .a-icon-alt');
      const rating = ratingElement ? 
        parseFloat(await this.extractText(ratingElement).match(/(\d+(\.\d+)?)/)[1]) : null;
      
      // Extract review count if available
      const reviewElement = await this.page.$('#acrCustomerReviewText');
      const reviewCount = reviewElement ? 
        parseInt(await this.extractText(reviewElement).replace(/[^0-9]/g, '')) : null;
      
      // Extract image URL if available
      const imageElement = await this.page.$('#landingImage');
      const imageUrl = imageElement ? 
        await this.extractAttribute(imageElement, 'img', 'src') : null;
      
      // Extract reviews
      const reviews = await this.extractReviews();
      
      // Create product object
      const product = {
        title,
        url,
        currentPrice: price,
        currency,
        source: this.source,
        siteProductId: this.extractProductId(url),
        rating,
        reviewCount,
        imageUrl,
        reviews,
        lastUpdated: new Date()
      };
      
      logScraperStatus(`Successfully retrieved product details from Amazon India`, {
        title,
        price: `${price} ${currency}`,
        rating: rating ? `${rating}/5` : 'N/A'
      });
      
      return product;
    } catch (error) {
      logScraperStatus(`Error getting product details from Amazon India`, { 
        url, 
        error: error.message 
      });
      throw error;
    }
  }

  extractProductId(url) {
    try {
      // Try various regex patterns to extract the Amazon ASIN (product ID)
      const patterns = [
        // Standard product URL format
        /\/dp\/([A-Z0-9]{10})(?:\/|\?|$)/,
        
        // Alternative URL patterns
        /\/gp\/product\/([A-Z0-9]{10})(?:\/|\?|$)/,
        /\/product\/([A-Z0-9]{10})(?:\/|\?|$)/,
        
        // Mobile site URL pattern
        /\/dp\/product\/([A-Z0-9]{10})(?:\/|\?|$)/,
        
        // URL with reference parameter
        /\?th=([A-Z0-9]{10})(?:&|$)/,
        
        // Direct ASIN pattern (rare)
        /\/([A-Z0-9]{10})(?:\/|\?|$)/
      ];
      
      // Try each pattern
      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }
      
      // Fall back to looking for any 10-character alphanumeric sequence
      // that might be an ASIN
      const genericMatch = url.match(/[A-Z0-9]{10}/);
      if (genericMatch) {
        return genericMatch[0];
      }
      
      // If no ASIN found, generate a unique ID based on the URL
      return `amazon_in_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    } catch (error) {
      console.error('Error extracting product ID:', error);
      return `amazon_in_${Date.now()}`;
    }
  }

  extractPrice(priceText) {
    try {
      if (!priceText) return { price: null, currency: null };
      
      // First try to identify the currency
      let currency = 'INR'; // Default for Amazon India
      let sanitizedText = priceText;
      
      // Check for ₹ symbol
      if (priceText.includes('₹')) {
        currency = 'INR';
        sanitizedText = priceText.replace(/₹/g, '');
      } else if (priceText.includes('$')) {
        currency = 'USD';
        sanitizedText = priceText.replace(/\$/g, '');
      } else if (priceText.includes('€')) {
        currency = 'EUR';
        sanitizedText = priceText.replace(/€/g, '');
      } else if (priceText.includes('£')) {
        currency = 'GBP';
        sanitizedText = priceText.replace(/£/g, '');
      }
      
      // Remove all non-numeric characters except for decimal points
      sanitizedText = sanitizedText.replace(/[^\d.]/g, '');
      
      // Convert to number
      const price = parseFloat(sanitizedText);
      
      return { 
        price: isNaN(price) ? null : price,
        currency 
      };
    } catch (error) {
      console.error('Error extracting price:', error);
      return { price: null, currency: null };
    }
  }

  async extractPriceFromPage(page) {
    try {
      // Check if the function already exists in the page context
      const functionExists = await page.evaluate(() => {
        return typeof window.amazonInScraperExtractPrice === 'function';
      }).catch(() => false);
      
      // Only expose the function if it doesn't already exist
      if (!functionExists) {
        // Expose the extractPrice function to this page context
        await page.exposeFunction('amazonInScraperExtractPrice', (priceText) => {
          return this.extractPrice(priceText);
        });
      }
      
      // Check if generic function exists
      const genericExists = await page.evaluate(() => {
        return typeof window.extractPrice === 'function';
      }).catch(() => false);
      
      // Only expose if it doesn't exist
      if (!genericExists) {
        await page.exposeFunction('extractPrice', (priceText) => {
          return this.extractPrice(priceText);
        });
      }
      
      await page.waitForFunction(() => document.querySelectorAll('#corePriceDisplay_desktop_feature_div, .a-price, #price').length > 0, { timeout: 5000 })
        .catch(() => console.log('Price elements not found'));

      // Extract price from the product page
      return await page.evaluate(() => {
        // Define the price selectors in order of priority
        const priceSelectors = [
          '#corePriceDisplay_desktop_feature_div .a-price-whole',
          '#corePriceDisplay_desktop_feature_div .a-offscreen',
          '.a-price:not(.a-text-price) .a-offscreen',
          '.priceToPay .a-offscreen',
          '.a-price .a-offscreen',
          '#price .a-price .a-offscreen',
          '#price_inside_buybox .a-offscreen',
          '#priceblock_ourprice',
          '#priceblock_dealprice',
          '.a-size-large.a-color-price'
        ];

        // Try each selector until we find a price
        for (const selector of priceSelectors) {
          const priceEl = document.querySelector(selector);
          if (priceEl) {
            const priceText = priceEl.textContent.trim();
            if (priceText) {
              // Simple price extraction with currency detection
              let currency = 'INR'; // Default for Amazon India
              let cleanText = priceText;
              
              // Detect currency symbol
              if (priceText.includes('₹')) {
                currency = 'INR';
                cleanText = priceText.replace(/₹/g, '').trim();
              } else if (priceText.includes('$')) {
                currency = 'USD';
                cleanText = priceText.replace(/\$/g, '').trim();
              } else if (priceText.includes('€')) {
                currency = 'EUR';
                cleanText = priceText.replace(/€/g, '').trim();
              } else if (priceText.includes('£')) {
                currency = 'GBP';
                cleanText = priceText.replace(/£/g, '').trim();
              }
              
              // Remove commas and spaces
              cleanText = cleanText.replace(/,|\s+/g, '');
              
              // Parse price
              const price = parseFloat(cleanText);
              if (!isNaN(price) && price > 0) {
                return { price, currency };
              }
            }
          }
        }

        // If no price found with selectors, try to find any element with currency symbols
        const allText = document.body.innerText;
        const priceMatch = allText.match(/[₹$€£]\s*([\d,.]+)/);
        if (priceMatch && priceMatch[0]) {
          // Determine currency from the match
          let currency = 'INR';
          if (priceMatch[0].includes('₹')) currency = 'INR';
          else if (priceMatch[0].includes('$')) currency = 'USD';
          else if (priceMatch[0].includes('€')) currency = 'EUR';
          else if (priceMatch[0].includes('£')) currency = 'GBP';
          
          // Clean and parse the price
          const cleanPrice = priceMatch[1].replace(/,/g, '');
          const price = parseFloat(cleanPrice);
          
          if (!isNaN(price) && price > 0) {
            return { price, currency };
          }
        }

        return { price: 0, currency: 'INR' };
      });
    } catch (error) {
      console.error('Error extracting price:', error);
      return { price: 0, currency: 'INR' };
    }
  }

  // Helper method to analyze product structure by directly accessing a product page
  async analyzeSampleProduct() {
    try {
      // Use a direct known Dell laptop URL to analyze the structure
      const sampleProductUrl = 'https://www.amazon.in/Dell-Generation-7420-Windows-D560676WIN9S/dp/B0BFWVX4ZZ/';
      
      logScraperStatus(`Analyzing sample product structure at ${sampleProductUrl}`);
      
      // Navigate to the product page
      await this.page.goto(sampleProductUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      // Take a screenshot of the product page
      await this.page.screenshot({ path: 'amazon-india-sample-product.png' });
      
      // Extract the structure
      const structure = await this.page.evaluate(() => {
        // Get all key selectors
        const selectors = {
          title: document.querySelector('#productTitle')?.textContent.trim(),
          price: {
            mainSelector: document.querySelector('.a-price')?.outerHTML,
            wholeSelector: document.querySelector('.a-price-whole')?.outerHTML,
            offscreenSelector: document.querySelector('.a-price .a-offscreen')?.outerHTML,
            rawText: document.querySelector('.a-price')?.textContent.trim()
          },
          rating: {
            selector: document.querySelector('.a-icon-star-small')?.outerHTML,
            text: document.querySelector('.a-icon-star-small')?.textContent.trim()
          },
          availability: document.querySelector('#availability')?.textContent.trim(),
          breadcrumbs: document.querySelector('#wayfinding-breadcrumbs_feature_div')?.textContent.trim()
        };
        
        return {
          selectors,
          pageTitle: document.title,
          bodyText: document.body.textContent.substring(0, 1000) // First 1000 chars
        };
      });
      
      logScraperStatus('Sample product structure analysis', { structure });
      return structure;
    } catch (error) {
      logScraperStatus(`Error analyzing sample product: ${error.message}`);
      return null;
    }
  }

  async extractReviews() {
    const reviews = [];
    try {
      // Look for reviews section on the page
      const reviewsSection = await this.page.$('#customerReviews');
      if (!reviewsSection) {
        logScraperStatus('No reviews section found on page');
        return reviews;
      }
      
      // Click on "See all reviews" link if available
      const seeAllReviewsLink = await this.page.$('#cr-pagination-link-top, .a-link-emphasis[href*="showAllReviews"], a[data-hook="see-all-reviews-link-foot"]');
      if (seeAllReviewsLink) {
        logScraperStatus('Clicking "See all reviews" link');
        await seeAllReviewsLink.click();
        await this.page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {
          logScraperStatus('Navigation timeout after clicking reviews link, continuing anyway');
        });
        await this.addRandomDelay(2000, 3000);
      }
      
      // Extract reviews from the page
      const reviewElements = await this.page.$$('#cm-cr-dp-review-list .a-section.review, .review-data .a-section.review, div[data-hook="review"]');
      
      logScraperStatus(`Found ${reviewElements.length} review elements`);
      
      // Process only the first few reviews to avoid timeout
      const maxReviews = Math.min(reviewElements.length, 5);
      
      for (let i = 0; i < maxReviews; i++) {
        const element = reviewElements[i];
        
        try {
          const title = await this.page.evaluate(el => {
            const titleEl = el.querySelector('.review-title, .a-size-base.review-title, [data-hook="review-title"]');
            return titleEl ? titleEl.textContent.trim() : '';
          }, element);
          
          const text = await this.page.evaluate(el => {
            const textEl = el.querySelector('.review-text, .review-text-content span, [data-hook="review-body"]');
            return textEl ? textEl.textContent.trim() : '';
          }, element);
          
          const rating = await this.page.evaluate(el => {
            const ratingEl = el.querySelector('.review-rating, [data-hook="review-star-rating"] .a-icon-alt');
            if (!ratingEl) return 0;
            
            const ratingText = ratingEl.textContent.trim();
            const match = ratingText.match(/(\d+(\.\d+)?)/);
            return match ? parseFloat(match[1]) : 0;
          }, element);
          
          const date = await this.page.evaluate(el => {
            const dateEl = el.querySelector('.review-date, [data-hook="review-date"]');
            return dateEl ? dateEl.textContent.trim() : '';
          }, element);
          
          if (title && text && rating > 0) {
            reviews.push({
              title,
              text,
              rating,
              date
            });
            
            logScraperStatus(`Extracted review: "${title.substring(0, 30)}..."`);
          }
        } catch (error) {
          logScraperStatus(`Error extracting individual review: ${error.message}`);
          continue;
        }
      }
      
      logScraperStatus(`Successfully extracted ${reviews.length} reviews`);
    } catch (error) {
      logScraperStatus(`Error extracting reviews: ${error.message}`);
    }
    
    return reviews;
  }
}

module.exports = AmazonIndiaScraper; 