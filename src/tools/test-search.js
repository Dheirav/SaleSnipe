/**
 * Backend Search API Test Tool
 * This script helps test the backend search API directly to identify any issues
 */

const axios = require('axios');

// API endpoint configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:3000/api';
const SEARCH_ENDPOINT = `${API_BASE_URL}/products/search`;

// Default search query if none provided
const DEFAULT_QUERY = 'laptop';

// Get query from command line args or use default
const searchQuery = process.argv[2] || DEFAULT_QUERY;

console.log('========================================');
console.log('Backend Search API Test');
console.log('========================================');
console.log(`Testing endpoint: ${SEARCH_ENDPOINT}`);
console.log(`Search query: "${searchQuery}"`);
console.log('----------------------------------------');

// Run the test
async function testSearch() {
  try {
    console.log('Sending request...');
    const startTime = Date.now();
    
    const response = await axios.get(SEARCH_ENDPOINT, {
      params: { query: searchQuery },
      timeout: 15000 // 15 second timeout
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`Request complete in ${duration}ms`);
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);
    
    // Check if products array exists
    if (response.data && Array.isArray(response.data.products)) {
      console.log(`Found ${response.data.products.length} products`);
      
      // Display info about the first few products
      if (response.data.products.length > 0) {
        console.log('\nFirst 3 products:');
        response.data.products.slice(0, 3).forEach((product, index) => {
          console.log(`\n[${index + 1}] ${product.title || 'Unnamed Product'}`);
          console.log(`  ID: ${product._id}`);
          console.log(`  Price: ${product.currentPrice} ${product.currency || 'USD'}`);
          console.log(`  Source: ${product.source || 'Unknown'}`);
        });
      }
    } else {
      console.log('Unexpected response format. Response data:');
      console.log(JSON.stringify(response.data, null, 2));
    }
    
    console.log('\nTest complete. ✅');
    
  } catch (error) {
    console.error('\n❌ Error occurred while testing search:');
    
    if (error.response) {
      // The request was made and the server responded with a status code
      console.error(`Server returned status ${error.response.status}`);
      console.error('Response data:', error.response.data);
      console.error('Response headers:', error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received from server');
      console.error('Request details:', error.request._currentUrl || error.request);
    } else {
      // Something happened in setting up the request
      console.error('Error message:', error.message);
    }
    
    console.error('\nTest failed. ❌');
  }
}

// Run the test
testSearch();

// Usage instructions
console.log('\nUsage:');
console.log('  node test-search.js [query]');
console.log('Example:');
console.log('  node test-search.js "gaming laptop"'); 