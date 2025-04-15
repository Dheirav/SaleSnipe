#!/usr/bin/env node
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Database URI
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sale-snipe';

async function checkConnection() {
  console.log('Database Connection Check Tool');
  console.log('=============================');
  console.log(`Attempting to connect to: ${MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
  
  try {
    const conn = await mongoose.connect(MONGODB_URI);
    
    console.log('\nConnection Successful!');
    console.log('---------------------');
    console.log(`Host: ${conn.connection.host}`);
    console.log(`Database Name: ${conn.connection.name}`);
    console.log(`Connection State: ${conn.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
    
    // List collections
    const collections = await conn.connection.db.listCollections().toArray();
    
    console.log('\nAvailable Collections:');
    console.log('---------------------');
    if (collections.length === 0) {
      console.log('No collections found in the database.');
    } else {
      collections.forEach(collection => {
        console.log(`- ${collection.name}`);
      });
    }
    
    console.log('\nConnection test completed successfully!');
    
    // Close the connection
    await mongoose.connection.close();
    console.log('Connection closed.');
    
    return true;
  } catch (error) {
    console.error('\nConnection Failed!');
    console.error('----------------');
    console.error(`Error Type: ${error.name}`);
    console.error(`Error Message: ${error.message}`);
    
    if (error.name === 'MongoNetworkError' || error.name === 'MongoServerSelectionError') {
      console.error('\nPossible Solutions:');
      console.error('1. Ensure MongoDB server is running');
      console.error('2. Check that the MongoDB connection URI is correct');
      console.error('3. Verify network connectivity to MongoDB server');
      console.error('4. Check for firewall or security restrictions');
    }
    
    return false;
  }
}

// Run if script is executed directly
if (require.main === module) {
  checkConnection()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(err => {
      console.error('Unexpected error:', err);
      process.exit(1);
    });
} else {
  // Export for use in other modules
  module.exports = checkConnection;
} 