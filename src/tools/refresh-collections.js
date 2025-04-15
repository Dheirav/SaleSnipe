#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../backend/config/db');
const collectionService = require('../backend/services/collectionService');

// Collections to refresh
const COLLECTIONS = [
  { name: 'trending', searchTerm: 'trending' },
  { name: 'discount-deals', searchTerm: 'discount deals' },
  { name: 'new-arrivals', searchTerm: 'new release' },
  { name: 'top-rated', searchTerm: 'best seller' }
];

// Optional: Add custom collections via command line
const customCollections = process.argv.slice(2);
if (customCollections.length > 0) {
  // Format: name:searchTerm
  customCollections.forEach(arg => {
    const [name, searchTerm] = arg.split(':');
    if (name && searchTerm) {
      COLLECTIONS.push({ name, searchTerm });
    }
  });
}

/**
 * Main function to refresh collections
 */
async function refreshCollections() {
  console.log(`[${new Date().toISOString()}] Starting collection refresh...`);
  
  try {
    // Connect to the database
    console.log('Connecting to MongoDB...');
    await connectDB();
    console.log('Connected to MongoDB successfully');
    
    // Refresh all collections
    const results = {
      total: COLLECTIONS.length,
      successful: 0,
      failed: 0,
      collections: []
    };
    
    for (const collection of COLLECTIONS) {
      console.log(`Refreshing collection: ${collection.name} with search term: ${collection.searchTerm}`);
      
      const startTime = Date.now();
      try {
        const success = await collectionService.updateCollection(
          collection.name,
          collection.searchTerm
        );
        
        const duration = (Date.now() - startTime) / 1000;
        
        if (success) {
          console.log(`✓ Successfully updated ${collection.name} in ${duration}s`);
          results.successful++;
          results.collections.push({
            name: collection.name,
            success: true,
            duration
          });
        } else {
          console.log(`✗ Failed to update ${collection.name}`);
          results.failed++;
          results.collections.push({
            name: collection.name,
            success: false,
            duration
          });
        }
      } catch (error) {
        const duration = (Date.now() - startTime) / 1000;
        console.error(`Error updating ${collection.name}:`, error.message);
        results.failed++;
        results.collections.push({
          name: collection.name,
          success: false,
          error: error.message,
          duration
        });
      }
      
      // Add delay between collections to prevent rate limiting
      if (COLLECTIONS.indexOf(collection) < COLLECTIONS.length - 1) {
        console.log('Waiting before next collection...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    // Print summary
    console.log('\nCollection Refresh Summary:');
    console.log(`Total collections: ${results.total}`);
    console.log(`Successful updates: ${results.successful}`);
    console.log(`Failed updates: ${results.failed}`);
    
    // Detail for each collection
    console.log('\nDetails:');
    results.collections.forEach(col => {
      const status = col.success ? 'SUCCESS' : 'FAILED';
      console.log(`${col.name}: ${status} (${col.duration.toFixed(2)}s)`);
      if (!col.success && col.error) {
        console.log(`  Error: ${col.error}`);
      }
    });
    
    console.log(`\n[${new Date().toISOString()}] Collection refresh completed`);
  } catch (error) {
    console.error('Error during collection refresh:', error);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    try {
      await mongoose.connection.close();
      console.log('MongoDB connection closed');
    } catch (error) {
      console.error('Error closing MongoDB connection:', error);
    }
    
    // Exit process
    process.exit(0);
  }
}

// Run the refresh
refreshCollections(); 