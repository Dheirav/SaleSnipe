const cheerio = require('cheerio');
const BaseScraper = require('./BaseScraper');

class EbayScraper extends BaseScraper {
  constructor() {
    super();
    this.source = 'ebay';
    this.baseUrl = 'https://www.ebay.com';
    this.currency = 'USD';
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
    // Extract eBay item ID from URL
    // Example URLs:
    // https://www.ebay.com/itm/123456789012
    // https://www.ebay.com/itm/Product-Name/123456789012
    const matches = url.match(/\/itm\/(?:.*?\/)?(\d{12})/);
    return matches ? matches[1] : null;
  }

  isValidEbayProduct(title, url) {
    const invalidConditions = [
      !title,
      !url,
      title === 'Shop on eBay',
      title.toLowerCase().includes('shop on ebay'),
      url === this.baseUrl
    ];

    return !invalidConditions.some(condition => condition);
  }

  async extractProductsFromPage($) {
    const products = [];
    
    $('.s-item').each((i, element) => {
      // Skip first item as it's often the "Shop on eBay" card
      if (i === 0) return;

      try {
        const title = $(element).find('.s-item__title').text().trim();
        const priceText = $(element).find('.s-item__price').text().trim();
        const url = $(element).find('.s-item__link').attr('href');
        
        // Extract product ID from URL
        const siteProductId = this.extractProductId(url);
        if (!siteProductId) {
          console.log(`Skipping product with invalid product ID: ${title}`);
          return;
        }

        if (!this.isValidEbayProduct(title, url)) {
          console.log(`Skipping invalid eBay entry: ${title}`);
          return;
        }

        // Skip price ranges
        if (priceText.includes('to')) {
          console.log(`Skipping product with price range: ${title}`);
          return;
        }

        // Use the improved price extraction method
        const { price, currency } = this.extractPriceAndCurrency(priceText);
        
        // Skip if price is invalid
        if (!price || price <= 0) {
          console.log(`Skipping product with invalid price: ${title} - ${priceText}`);
          return;
        }

        // For Alienware searches, ensure the product title contains "Alienware"
        if (this.searchQuery && this.searchQuery.toLowerCase().includes('alienware') && 
            !title.toLowerCase().includes('alienware')) {
          console.log(`Skipping non-Alienware product for Alienware search: ${title}`);
          return;
        }
        
        // Check if the product title contains all words from the search query
        if (!this.containsAllSearchWords(title, this.searchQuery)) {
          console.log(`Skipping product that doesn't match search words: ${title}`);
          return;
        }

        // Extract image URL
        let imageUrl = '';
        const imgSelector = $(element).find('.s-item__image-img');
        if (imgSelector.length > 0) {
          imageUrl = imgSelector.attr('src') || '';
          
          // If the image is a placeholder or "no image available", try the data-src attribute
          if (imageUrl.includes('s-l140') || imageUrl.includes('placeholder') || imageUrl.includes('no-image')) {
            imageUrl = imgSelector.attr('data-src') || imageUrl;
          }
          
          // Check srcset for higher resolution images
          const srcset = imgSelector.attr('srcset');
          if (srcset) {
            const srcsetUrls = srcset.split(',').map(s => s.trim().split(' ')[0]);
            // Get the highest resolution image from srcset
            if (srcsetUrls.length > 0) {
              imageUrl = srcsetUrls[srcsetUrls.length - 1] || imageUrl;
            }
          }
        }
        
        // Extract rating and review count if available
        let rating = 0;
        let reviewCount = 0;
        
        // Try to find rating text (e.g., "4.5 out of 5 stars")
        const ratingText = $(element).find('.x-star-rating').text().trim();
        if (ratingText) {
          const ratingMatch = ratingText.match(/([0-9](\.[0-9])?) out of/);
          if (ratingMatch && ratingMatch[1]) {
            rating = parseFloat(ratingMatch[1]);
          }
        }
        
        // Try to find review count, which is often near the rating
        const reviewText = $(element).find('.s-item__reviews-count').text().trim();
        if (reviewText) {
          const reviewMatch = reviewText.match(/(\d+(?:,\d+)*)/);
          if (reviewMatch && reviewMatch[1]) {
            reviewCount = parseInt(reviewMatch[1].replace(/,/g, ''));
          }
        }

        const product = {
          title,
          currentPrice: price,
          currency,
          url,
          source: 'ebay',
          siteProductId,
          availability: true,
          imageUrl,
          rating,
          reviewCount
        };

        if (this.validateProduct(product)) {
          console.log(`Found valid product: ${title} (ID: ${siteProductId}) at $${price}`);
          products.push(product);
        }
      } catch (err) {
        console.error('Error processing eBay product:', err);
      }
    });

    return products;
  }

  async searchProducts(query) {
    try {
      await this.initialize();
      
      // Store the search query for later use in extractProductsFromPage
      this.searchQuery = query;
      
      // Refine the search query for better accuracy
      let refinedQuery = query;
      
      // If the query is specifically for Alienware, make it more precise
      if (query.toLowerCase().includes('alienware')) {
        // Remove any generic terms like "laptop" or "gaming" if they're part of the query
        // and focus on "Alienware" as the primary search term
        refinedQuery = 'Alienware ' + query.split(' ')
          .filter(word => !['laptop', 'gaming', 'computer', 'pc'].includes(word.toLowerCase()))
          .join(' ');
        
        console.log(`Refined Alienware search query: "${refinedQuery}"`);
      }
      
      const searchUrl = `${this.baseUrl}/sch/i.html?_nkw=${encodeURIComponent(refinedQuery)}`;
      await this.page.goto(searchUrl, { waitUntil: 'networkidle0' });
      
      // Wait for product results
      await this.waitForSelector('.s-item');
      
      const products = [];
      const productElements = await this.extractElements('.s-item');
      
      for (const element of productElements) {
        if (products.length >= this.maxProducts) break;
        
        try {
          const title = await this.page.evaluate(el => {
            const titleEl = el.querySelector('.s-item__title');
            return titleEl ? titleEl.textContent.trim() : '';
          }, element);
          
          const url = await this.page.evaluate(el => {
            const linkEl = el.querySelector('.s-item__link');
            return linkEl ? linkEl.getAttribute('href') : '';
          }, element);
          
          // Skip if title or URL is missing
          if (!title || !url) {
            console.log(`Skipping product with missing title or URL`);
            continue;
          }
          
          // Skip "Shop on eBay" entries
          if (title === 'Shop on eBay' || title.toLowerCase().includes('shop on ebay')) {
            console.log(`Skipping "Shop on eBay" entry`);
            continue;
          }
          
          // Extract product ID from URL
          const siteProductId = this.extractProductId(url);
          if (!siteProductId) {
            console.log(`Skipping product with invalid product ID: ${title}`);
            continue;
          }
          
          const priceText = await this.page.evaluate(el => {
            const priceEl = el.querySelector('.s-item__price');
            return priceEl ? priceEl.textContent.trim() : '';
          }, element);
          
          // Skip price ranges
          if (priceText.includes('to')) {
            console.log(`Skipping product with price range: ${title}`);
            continue;
          }
          
          const { price, currency } = this.extractPriceAndCurrency(priceText);
          
          // Skip if price is invalid
          if (!price || price <= 0) {
            console.log(`Skipping product with invalid price: ${title}`);
            continue;
          }
          
          const rating = await this.page.evaluate(el => {
            const ratingEl = el.querySelector('.s-item__seller-info-text .clipped');
            if (!ratingEl) return 0;
            const ratingText = ratingEl.textContent.trim();
            const match = ratingText.match(/(\d+(\.\d+)?)/);
            return match ? parseFloat(match[1]) : 0;
          }, element);
          
          const reviewCount = await this.page.evaluate(el => {
            const reviewEl = el.querySelector('.s-item__seller-info-text .clipped + span');
            if (!reviewEl) return 0;
            const reviewText = reviewEl.textContent.trim();
            const match = reviewText.match(/(\d+(?:,\d+)*)/);
            return match ? parseInt(match[1].replace(/,/g, '')) : 0;
          }, element);
          
          const imageUrl = await this.page.evaluate(el => {
            const imgEl = el.querySelector('.s-item__image-img');
            return imgEl ? imgEl.getAttribute('src') : '';
          }, element);
          
          products.push({
            title,
            url,
            currentPrice: price,
            currency,
            rating,
            reviewCount,
            imageUrl,
            source: this.source,
            siteProductId
          });
          
          console.log(`Found valid product: ${title} (ID: ${siteProductId}) at ${price} ${currency}`);
        } catch (error) {
          console.error('Error extracting product details:', error);
          continue;
        }
      }
      
      return products;
    } catch (error) {
      console.error('Error searching eBay products:', error);
      throw error;
    } finally {
      await this.close();
    }
  }

  async getProductDetails(url) {
    try {
      await this.initialize();
      await this.page.goto(url, { waitUntil: 'networkidle0' });
      
      // Wait for product title
      await this.waitForSelector('h1.x-item-title__mainTitle');
      
      const title = await this.extractText('h1.x-item-title__mainTitle');
      
      const priceText = await this.extractText('.x-price-primary span');
      console.log(`Extracted price text: "${priceText}"`);
      const { price, currency } = this.extractPriceAndCurrency(priceText);
      console.log(`Extracted price: ${price} ${currency}`);
      
      const description = await this.extractText('.x-item-description');
      
      const rating = await this.page.evaluate(() => {
        const ratingEl = document.querySelector('.x-seller-rating');
        if (!ratingEl) return 0;
        const ratingText = ratingEl.textContent.trim();
        const match = ratingText.match(/(\d+(\.\d+)?)/);
        return match ? parseFloat(match[1]) : 0;
      });
      
      const reviewCount = await this.page.evaluate(() => {
        const reviewEl = document.querySelector('.x-seller-rating + span');
        if (!reviewEl) return 0;
        const reviewText = reviewEl.textContent.trim();
        const match = reviewText.match(/(\d+(?:,\d+)*)/);
        return match ? parseInt(match[1].replace(/,/g, '')) : 0;
      });
      
      const imageUrl = await this.extractAttribute('.ux-image-carousel-item img', 'src');
      
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
      console.error('Error getting eBay product details:', error);
      throw error;
    } finally {
      await this.close();
    }
  }

  async extractReviews() {
    const reviews = [];
    try {
      // Click on "See all reviews" if available
      const seeAllReviewsButton = await this.page.$('.x-reviews-link');
      if (seeAllReviewsButton) {
        await seeAllReviewsButton.click();
        await this.page.waitForNavigation({ waitUntil: 'networkidle0' });
      }
      
      // Extract reviews from the first page
      const reviewElements = await this.page.$$('.x-review');
      
      for (const element of reviewElements) {
        try {
          const title = await this.page.evaluate(el => {
            const titleEl = el.querySelector('.x-review-title');
            return titleEl ? titleEl.textContent.trim() : '';
          }, element);
          
          const text = await this.page.evaluate(el => {
            const textEl = el.querySelector('.x-review-text');
            return textEl ? textEl.textContent.trim() : '';
          }, element);
          
          const rating = await this.page.evaluate(el => {
            const ratingEl = el.querySelector('.x-review-rating');
            if (!ratingEl) return 0;
            const ratingText = ratingEl.textContent.trim();
            const match = ratingText.match(/(\d+(\.\d+)?)/);
            return match ? parseFloat(match[1]) : 0;
          }, element);
          
          const date = await this.page.evaluate(el => {
            const dateEl = el.querySelector('.x-review-date');
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
          console.error('Error extracting review:', error);
          continue;
        }
      }
    } catch (error) {
      console.error('Error extracting reviews:', error);
    }
    
    return reviews;
  }
}

module.exports = EbayScraper; 