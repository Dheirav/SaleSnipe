#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const chalk = require('chalk') || { green: x => x, red: x => x, yellow: x => x, blue: x => x, cyan: x => x };

const API_URL = 'http://localhost:3000/api';

// Test database connection directly
async function testDatabaseConnection() {
  console.log(chalk.cyan('Testing direct MongoDB connection...'));

  try {
    const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sale-snipe';
    console.log(`Database URI: ${dbUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
    
    await mongoose.connect(dbUri);
    console.log(chalk.green('✓ MongoDB connection successful'));
    console.log(`  Database Name: ${chalk.blue(mongoose.connection.name)}`);
    console.log(`  Host: ${chalk.blue(mongoose.connection.host)}`);
    
    // List collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`  Collections: ${collections.length ? chalk.blue(collections.map(c => c.name).join(', ')) : chalk.yellow('No collections found')}`);
    
    // Close connection
    await mongoose.connection.close();
    console.log(chalk.green('✓ MongoDB connection closed properly'));
    return true;
  } catch (error) {
    console.log(chalk.red('✗ MongoDB connection failed'));
    console.log(`  Error: ${error.message}`);
    return false;
  }
}

// Test backend API connection
async function testApiConnection() {
  console.log(chalk.cyan('\nTesting Backend API connection...'));

  try {
    console.log(`API URL: ${API_URL}/health`);
    const response = await axios.get(`${API_URL}/health`, { timeout: 5000 });
    
    console.log(chalk.green('✓ Backend API is responding'));
    console.log(`  Status: ${chalk.blue(response.data.status)}`);
    console.log(`  MongoDB Connected: ${response.data.mongodb?.connected 
      ? chalk.green('Yes') 
      : chalk.red('No')}`);
      
    if (response.data.mongodb) {
      console.log(`  MongoDB Database: ${chalk.blue(response.data.mongodb.database)}`);
      console.log(`  MongoDB State: ${chalk.blue(response.data.mongodb.state)}`);
    }
    
    return true;
  } catch (error) {
    console.log(chalk.red('✗ Backend API connection failed'));
    if (error.response) {
      console.log(`  Status: ${error.response.status}`);
      console.log(`  Response: ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      console.log('  No response received from server. Is the backend running?');
    } else {
      console.log(`  Error: ${error.message}`);
    }
    return false;
  }
}

// Test API data retrieval
async function testApiDataRetrieval() {
  console.log(chalk.cyan('\nTesting API data retrieval...'));
  
  try {
    console.log(`API URL: ${API_URL}/products/search?query=test`);
    const response = await axios.get(`${API_URL}/products/search`, {
      params: { query: 'test' },
      timeout: 5000
    });
    
    if (response.data && response.data.products) {
      console.log(chalk.green(`✓ API returned ${response.data.products.length} products`));
      if (response.data.products.length > 0) {
        console.log('  Sample product:');
        const sample = response.data.products[0];
        console.log(`    Title: ${chalk.blue(sample.title)}`);
        console.log(`    Price: ${chalk.blue(sample.currentPrice)} ${sample.currency || ''}`);
        console.log(`    Source: ${chalk.blue(sample.source || 'N/A')}`);
      } else {
        console.log(chalk.yellow('  No products found for test query.'));
      }
      return true;
    } else {
      console.log(chalk.yellow('✓ API responded but returned no products data'));
      console.log('  Response:', JSON.stringify(response.data));
      return true; // API worked, just no data
    }
  } catch (error) {
    console.log(chalk.red('✗ API data retrieval failed'));
    if (error.response) {
      console.log(`  Status: ${error.response.status}`);
      console.log(`  Response: ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      console.log('  No response received from server');
    } else {
      console.log(`  Error: ${error.message}`);
    }
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log(chalk.cyan('=== SaleSnipe Connection Verification Tool ===\n'));
  
  let hasErrors = false;
  
  // Test database
  const dbResult = await testDatabaseConnection();
  if (!dbResult) hasErrors = true;
  
  // Test API
  const apiResult = await testApiConnection();
  if (!apiResult) hasErrors = true;
  
  // Test data retrieval
  if (apiResult) {
    const dataResult = await testApiDataRetrieval();
    if (!dataResult) hasErrors = true;
  }
  
  // Summary
  console.log(chalk.cyan('\n=== Test Summary ==='));
  if (hasErrors) {
    console.log(chalk.red('✗ Some tests failed. Please check the issues above.'));
    
    console.log(chalk.yellow('\nTroubleshooting tips:'));
    console.log(' 1. Make sure MongoDB is running');
    console.log(' 2. Verify the backend server is running on port 3000');
    console.log(' 3. Check database name consistency (should be "sale-snipe")');
    console.log(' 4. Try running "npm run dev" to start everything together');
    
    process.exit(1);
  } else {
    console.log(chalk.green('✓ All tests passed! The system should be working properly.'));
    process.exit(0);
  }
}

// Run the tests
runTests().catch(err => {
  console.error('Unexpected error during tests:', err);
  process.exit(1);
}); 