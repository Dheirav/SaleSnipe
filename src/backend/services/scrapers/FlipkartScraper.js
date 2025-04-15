const BaseScraper = require('./BaseScraper');

// Import the logging function from BaseScraper instead of scraperService to avoid circular dependency
const { logScraperStatus } = require('./BaseScraper');

class FlipkartScraper extends BaseScraper {
  constructor() {
    super();
    this.source = 'flipkart';
    this.baseUrl = 'https://www.flipkart.com';
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
    await this.randomDelay(1000, 3000);
  }

  async randomDelay(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  async searchProducts(query) {
    try {
      await this.initialize(false); // Initialize with non-headless mode to avoid detection
      
      // Refine search query for better results
      const refinedQuery = this.refineSearchQuery(query);
      const searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(refinedQuery)}`;
      
      logScraperStatus(`Starting Flipkart search`, { query: refinedQuery, url: searchUrl });
      
      // Navigate to search page with random delay
      await this.navigateToPage(this.page, searchUrl);
      await this.randomDelay(2000, 4000);
      
      // Take a screenshot for debugging
      await this.page.screenshot({ path: 'flipkart-search.png' });
      
      // Check for CAPTCHA
      const hasCaptcha = await this.page.evaluate(() => {
        return document.body.innerText.includes('CAPTCHA') || 
               document.body.innerText.includes('captcha') ||
               document.body.innerText.includes('Robot Check');
      });
      
      if (hasCaptcha) {
        logScraperStatus(`CAPTCHA detected on Flipkart`, { url: searchUrl });
        // Alert user and wait for manual intervention
        await this.page.evaluate(() => {
          alert('CAPTCHA detected! Please solve it manually to continue scraping.');
        });
        await this.page.waitForTimeout(60000);
        await this.page.screenshot({ path: 'flipkart-after-captcha.png' });
      }
      
      // Detect if no results found
      const noResults = await this.page.evaluate(() => {
        return document.body.innerText.includes('No Results Found') ||
               document.body.innerText.includes('No Matching Products');
      });
      
      if (noResults) {
        logScraperStatus(`No results found on Flipkart for query: ${refinedQuery}`);
        return [];
      }
      
      // Wait for product results - try multiple selectors
      let hasResults = false;
      const resultSelectors = [
        '._1AtVbE ._13oc-S', // Grid view items
        '._1YokD2 ._3Mn1Gg', // List view items
        '.s1Q9rs',           // Product titles
        '._4ddWXP',          // Product cards
        '._1MEUF9',          // Results section
        '._1xHGtK._373qXS',  // Alternative product cards
        '._2kHMtA'           // Yet another product container
      ];
      
      for (const selector of resultSelectors) {
        hasResults = await this.waitForSelector(selector, 5000);
        if (hasResults) {
          logScraperStatus(`Found results with selector: ${selector}`);
          break;
        }
      }
      
      if (!hasResults) {
        logScraperStatus(`No results elements found on Flipkart`, { query: refinedQuery });
        
        // Try searching directly using page content
        const pageContent = await this.page.content();
        if (pageContent.includes('₹') && (pageContent.includes('Add to cart') || pageContent.includes('BUY NOW'))) {
          logScraperStatus(`Page contains prices and buy buttons, proceeding with extraction`);
        } else {
          await this.page.screenshot({ path: 'flipkart-no-results.png' });
          return [];
        }
      }
      
      // Simulate human behavior - scroll to load lazy content
      await this.simulateHumanScrolling();
      
      // Extract products from the page
      const products = await this.extractProductsFromPage(query);
      
      logScraperStatus(`Found ${products.length} products on Flipkart`, { query: refinedQuery });
      return products;
    } catch (error) {
      logScraperStatus(`Error searching Flipkart`, { error: error.message });
      return [];
    } finally {
      // Ensure browser is closed
      await this.close();
    }
  }

  async simulateHumanScrolling() {
    try {
      // Scroll down in multiple steps
      for (let i = 0; i < 5; i++) {
        await this.page.evaluate((scrollStep) => {
          window.scrollBy(0, scrollStep);
        }, 800);
        await this.randomDelay(300, 1000);
      }
      
      // Scroll back up a bit
      await this.page.evaluate(() => {
        window.scrollBy(0, -500);
      });
      
      await this.randomDelay(1000, 2000);
    } catch (error) {
      logScraperStatus(`Error in simulateHumanScrolling: ${error.message}`);
    }
  }

  async extractProductsFromPage(query) {
    const products = [];
    
    try {
      // Try different approaches to find products
      
      // Approach 1: Use page.evaluate to extract products using various selectors
      const extractedProducts = await this.page.evaluate(() => {
        const results = [];
        
        // Define all possible product container selectors
        const containerSelectors = [
          '._1AtVbE ._13oc-S',    // Common grid view items
          '._1YokD2 ._3Mn1Gg ._1xHGtK', // List view items
          '._2kHMtA',             // Product containers
          '._4ddWXP',             // Product cards
          '._1xHGtK._373qXS',     // Alternative product cards
        ];
        
        // Try each selector
        let productElements = [];
        for (const selector of containerSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            console.log(`Found ${elements.length} products with selector: ${selector}`);
            productElements = Array.from(elements);
            break;
          }
        }
        
        // If no elements found with container selectors, try product title selectors
        if (productElements.length === 0) {
          const titleSelectors = [
            '.s1Q9rs',            // Common product titles
            '._4rR01T',           // Alternative product titles
            '.IRpwTa',            // Yet another title format
          ];
          
          for (const selector of titleSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              console.log(`Found ${elements.length} products with title selector: ${selector}`);
              // Get parent elements to capture the whole product card
              productElements = Array.from(elements).map(el => el.closest('._1AtVbE') || el.closest('._2kHMtA') || el.parentElement.parentElement);
              break;
            }
          }
        }
        
        // Process product elements
        productElements.forEach(element => {
          try {
            // Extract title
            let title = '';
            const titleSelectors = ['.s1Q9rs', '._4rR01T', '.IRpwTa', '._2mylT6', 'a[title]', '.B_NuCI'];
            
            for (const selector of titleSelectors) {
              const titleEl = element.querySelector(selector);
              if (titleEl) {
                title = titleEl.innerText.trim() || titleEl.getAttribute('title');
                if (title) break;
              }
            }
            
            if (!title) return; // Skip if no title found
            
            // Extract price
            let price = 0;
            let priceText = '';
            const priceSelectors = ['._30jeq3', '._1_WHN1', '.a-price-whole', '._2kHMtA ._30jeq3'];
            
            for (const selector of priceSelectors) {
              const priceEl = element.querySelector(selector);
              if (priceEl) {
                priceText = priceEl.innerText.trim();
                if (priceText) break;
              }
            }
            
            if (priceText) {
              // Extract numeric price
              const priceMatch = priceText.match(/[₹₨]?[\d,]+/);
              if (priceMatch) {
                price = parseFloat(priceMatch[0].replace(/[₹₨,]/g, ''));
              }
            }
            
            if (!price) return; // Skip if no price found
            
            // Extract URL
            let url = '';
            const linkSelectors = ['a[href]', 'a.s1Q9rs', 'a._1fQZEK', '._2kHMtA a'];
            
            for (const selector of linkSelectors) {
              const linkEl = element.querySelector(selector);
              if (linkEl && linkEl.getAttribute('href')) {
                url = linkEl.getAttribute('href');
                if (!url.startsWith('http')) {
                  url = 'https://www.flipkart.com' + url;
                }
                if (url) break;
              }
            }
            
            if (!url) return; // Skip if no URL found
            
            // Extract image URL
            let imageUrl = '';
            const imageSelectors = ['img', 'img._396cs4', 'img._2r_T1I', '._3exPp9 img', '._2kHMtA img'];
            
            for (const selector of imageSelectors) {
              const imgEl = element.querySelector(selector);
              if (imgEl) {
                // Try to get image from srcset first for higher quality
                const srcset = imgEl.getAttribute('srcset');
                if (srcset) {
                  const srcsetUrls = srcset.split(',').map(s => s.trim().split(' ')[0]);
                  // Get the last URL which is typically the highest resolution
                  if (srcsetUrls.length > 0) {
                    imageUrl = srcsetUrls[srcsetUrls.length - 1];
                  }
                }
                
                // If no srcset or failed to parse, fall back to src
                if (!imageUrl) {
                  imageUrl = imgEl.getAttribute('src');
                }
                
                if (imageUrl) break;
              }
            }
            
            // Extract product ID from URL
            let productId = '';
            const idMatch = url.match(/pid=([^&]+)/);
            if (idMatch && idMatch[1]) {
              productId = idMatch[1];
            } else {
              // Alternative ID extraction from URL
              const parts = url.split('/');
              if (parts.length > 0) {
                productId = parts[parts.length - 1].split('?')[0];
              }
            }
            
            if (!productId) return; // Skip if no ID found
            
            // Extract rating if available
            let rating = 0;
            const ratingSelectors = ['._3LWZlK', '._1lRcqv ._3LWZlK'];
            
            for (const selector of ratingSelectors) {
              const ratingEl = element.querySelector(selector);
              if (ratingEl) {
                const ratingText = ratingEl.innerText.trim();
                if (ratingText) {
                  rating = parseFloat(ratingText);
                  break;
                }
              }
            }
            
            results.push({
              title,
              price,
              url,
              imageUrl,
              productId,
              rating
            });
          } catch (error) {
            console.error('Error processing product element:', error);
          }
        });
        
        return results;
      });
      
      // Process the extracted products
      extractedProducts.forEach(item => {
        if (item.title && item.price > 0 && item.url) {
          products.push({
            title: item.title,
            currentPrice: item.price,
            currency: 'INR',  // Flipkart uses Indian Rupees
            url: item.url,
            source: this.source,
            siteProductId: item.productId,
            imageUrl: item.imageUrl || '',
            rating: item.rating || 0
          });
        }
      });
      
      // If we got some products, return them
      if (products.length > 0) {
        logScraperStatus(`Extracted ${products.length} products from Flipkart page`, { query });
        return products;
      }
      
      // If first approach failed, try reading the page content and parsing with cheerio
      const html = await this.page.content();
      const $ = cheerio.load(html);
      
      // Try different product selectors with cheerio
      const productSelectors = [
        '._1AtVbE ._13oc-S div[data-id]',
        '._1YokD2 ._3Mn1Gg div[data-id]',
        '._4ddWXP',
        '._2kHMtA'
      ];
      
      for (const selector of productSelectors) {
        $(selector).each((i, element) => {
          try {
            // Extract title
            let title = '';
            $('.s1Q9rs, ._4rR01T, .IRpwTa, ._2mylT6', element).each((i, el) => {
              title = $(el).text().trim() || $(el).attr('title');
              if (title) return false; // break
            });
            
            if (!title) return; // Skip if no title found
            
            // Extract price
            let price = 0;
            $('._30jeq3, ._1_WHN1', element).each((i, el) => {
              const priceText = $(el).text().trim();
              if (priceText) {
                const priceMatch = priceText.match(/[₹₨]?[\d,]+/);
                if (priceMatch) {
                  price = parseFloat(priceMatch[0].replace(/[₹₨,]/g, ''));
                  return false; // break
                }
              }
            });
            
            if (!price || price <= 0) return; // Skip if invalid price
            
            // Extract URL
            let url = '';
            $('a', element).each((i, el) => {
              url = $(el).attr('href');
              if (url) {
                if (!url.startsWith('http')) {
                  url = 'https://www.flipkart.com' + url;
                }
                return false; // break
              }
            });
            
            if (!url) return; // Skip if no URL
            
            // Extract product ID
            let productId = '';
            const idMatch = url.match(/pid=([^&]+)/);
            if (idMatch && idMatch[1]) {
              productId = idMatch[1];
            } else {
              const parts = url.split('/');
              if (parts.length > 0) {
                productId = parts[parts.length - 1].split('?')[0];
              }
            }
            
            if (!productId) return; // Skip if no ID
            
            // Extract image URL
            let imageUrl = '';
            $('img', element).each((i, el) => {
              imageUrl = $(el).attr('src');
              
              // Check for data-src if src is not available or contains placeholder
              if (!imageUrl || imageUrl.includes('placeholder')) {
                imageUrl = $(el).attr('data-src');
              }
              
              if (imageUrl) return false; // break
            });
            
            // Extract rating if available
            let rating = 0;
            $('._3LWZlK', element).each((i, el) => {
              const ratingText = $(el).text().trim();
              if (ratingText) {
                rating = parseFloat(ratingText);
                return false; // break
              }
            });
            
            // Add to products array
            products.push({
              title,
              currentPrice: price,
              currency: 'INR',
              url,
              source: this.source,
              siteProductId: productId,
              imageUrl: imageUrl || '',
              rating: rating || 0
            });
          } catch (error) {
            logScraperStatus(`Error extracting product with cheerio: ${error.message}`);
          }
        });
        
        if (products.length > 0) {
          logScraperStatus(`Extracted ${products.length} products using cheerio with selector: ${selector}`);
          break;
        }
      }
    } catch (error) {
      logScraperStatus(`Error extracting products from Flipkart page: ${error.message}`);
    }
    
    return products;
  }

  async getProductDetails(url) {
    try {
      await this.initialize();
      await this.navigateToPage(this.page, url);
      
      // Wait for product title
      await this.waitForSelector('.B_NuCI');
      
      // Extract product details
      const title = await this.extractText('.B_NuCI');
      const priceText = await this.extractText('._30jeq3._16Jk6d');
      const { price, currency } = this.extractPriceAndCurrency(priceText, 'INR');
      
      // Extract rating if available
      const ratingText = await this.extractText('._2d4LTz');
      const rating = ratingText ? parseFloat(ratingText) : null;
      
      // Extract review count if available
      const reviewCountText = await this.extractText('._2_R_DZ');
      let reviewCount = 0;
      if (reviewCountText) {
        const match = reviewCountText.match(/(\d+(?:,\d+)*)/);
        if (match) {
          reviewCount = parseInt(match[1].replace(/,/g, ''));
        }
      }
      
      // Extract image URL
      const imageUrl = await this.extractAttribute('._396cs4', 'src');
      
      // Extract reviews
      const reviews = await this.extractReviews();
      
      return {
        title,
        url,
        price,
        currency,
        rating,
        reviewCount,
        imageUrl,
        reviews,
        source: this.source
      };
    } catch (error) {
      console.error('Error getting Flipkart product details:', error);
      throw error;
    } finally {
      await this.close();
    }
  }
  
  async extractReviews() {
    const reviews = [];
    try {
      // Check if we're on a product page
      const isProductPage = await this.page.evaluate(() => {
        return document.querySelector('.B_NuCI') !== null;
      });
      
      if (!isProductPage) {
        logScraperStatus('Not on a product page, cannot extract reviews');
        return reviews;
      }
      
      // Look for "All reviews" link and click it
      const viewAllReviewsLink = await this.page.$('._3UAT2v ._1EPkIx a, .JOpGWq a');
      if (viewAllReviewsLink) {
        logScraperStatus('Clicking "View all reviews" link');
        await viewAllReviewsLink.click();
        await this.page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {
          logScraperStatus('Navigation timeout after clicking reviews link, continuing anyway');
        });
        await this.randomDelay(1500, 2500);
      } else {
        logScraperStatus('No "View all reviews" link found');
      }
      
      // Extract reviews
      const reviewElements = await this.page.$$('._27M-vq, .t-ZTKy');
      
      logScraperStatus(`Found ${reviewElements.length} review elements`);
      
      // Process only a limited number of reviews to avoid timeout
      const maxReviews = Math.min(reviewElements.length, 5);
      
      for (let i = 0; i < maxReviews; i++) {
        const element = reviewElements[i];
        
        try {
          const title = await this.page.evaluate(el => {
            const titleEl = el.querySelector('._2-N8zT, .t-ZTKy strong');
            return titleEl ? titleEl.textContent.trim() : 'Review';
          }, element);
          
          const text = await this.page.evaluate(el => {
            const textEl = el.querySelector('._6K-7Co, .t-ZTKy div');
            return textEl ? textEl.textContent.trim() : '';
          }, element);
          
          const rating = await this.page.evaluate(el => {
            const ratingEl = el.querySelector('._3LWZlK, ._1BLPMq');
            if (!ratingEl) return 0;
            
            const ratingText = ratingEl.textContent.trim();
            return parseFloat(ratingText) || 0;
          }, element);
          
          const date = await this.page.evaluate(el => {
            const dateEl = el.querySelector('._2sc7ZR, ._3LYOAd');
            return dateEl ? dateEl.textContent.trim() : '';
          }, element);
          
          if (text && rating > 0) {
            reviews.push({
              title,
              text,
              rating,
              date
            });
            
            logScraperStatus(`Extracted review: "${title}"`, {
              text: text.substring(0, 30) + '...',
              rating
            });
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

  extractProductId(url) {
    try {
      const match = url.match(/\/p\/([^\/]+)/);
      return match ? match[1] : null;
    } catch (error) {
      return null;
    }
  }
}

module.exports = FlipkartScraper; 