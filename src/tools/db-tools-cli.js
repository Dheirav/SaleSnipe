#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const colors = require('colors');
const fs = require('fs');
const moment = require('moment');
const { program } = require('commander');

// Import models
const Product = require('../backend/models/Product');
const ProductCollection = require('../backend/models/ProductCollection');
const User = require('../backend/models/User');

// Constants
const BACKUP_DIR = path.join(__dirname, '../backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Connect to MongoDB
async function connectDB() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set. Please check your .env file.');
    }
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(colors.cyan(`MongoDB Connected: ${conn.connection.host}`));
    return conn;
  } catch (error) {
    console.error(colors.red('Error connecting to MongoDB:'), error.message);
    console.error(colors.yellow('\nPlease make sure:'));
    console.error(colors.yellow('1. Your .env file exists in the project root'));
    console.error(colors.yellow('2. MONGODB_URI is properly set in .env'));
    console.error(colors.yellow('3. MongoDB server is running'));
    return null;
  }
}

// Check database connection
async function checkConnection() {
  console.log('Database Connection Check Tool');
  console.log('=============================');
  
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sale-snipe';
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

// Backup collections
async function backupCollections() {
  try {
    console.log(colors.blue('Backing up collections...'));
    
    // Get all collections
    const collections = await ProductCollection.find();
    
    if (collections.length === 0) {
      console.log(colors.yellow('No collections found to backup.'));
      return null;
    }
    
    // Format the backup data
    const backupData = {
      timestamp: new Date().toISOString(),
      collections: collections.map(collection => collection.toObject())
    };
    
    // Generate filename with timestamp
    const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
    const filename = `collections_backup_${timestamp}.json`;
    const backupPath = path.join(BACKUP_DIR, filename);
    
    // Write to file
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
    
    console.log(colors.green(`Successfully backed up ${collections.length} collections to ${backupPath}`));
    return backupPath;
  } catch (error) {
    console.error(colors.red('Error backing up collections:'), error);
    return null;
  }
}

// Backup products
async function backupProducts() {
  try {
    console.log(colors.blue('Backing up products...'));
    
    // Get all products
    const products = await Product.find();
    
    if (products.length === 0) {
      console.log(colors.yellow('No products found to backup.'));
      return null;
    }
    
    // Format the backup data
    const backupData = {
      timestamp: new Date().toISOString(),
      products: products.map(product => product.toObject())
    };
    
    // Generate filename with timestamp
    const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
    const filename = `products_backup_${timestamp}.json`;
    const backupPath = path.join(BACKUP_DIR, filename);
    
    // Write to file
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
    
    console.log(colors.green(`Successfully backed up ${products.length} products to ${backupPath}`));
    return backupPath;
  } catch (error) {
    console.error(colors.red('Error backing up products:'), error);
    return null;
  }
}

// Backup users
async function backupUsers() {
  try {
    console.log(colors.blue('Backing up users...'));
    
    // Get all users (excluding sensitive data)
    const users = await User.find().select('-password');
    
    if (users.length === 0) {
      console.log(colors.yellow('No users found to backup.'));
      return null;
    }
    
    // Format the backup data
    const backupData = {
      timestamp: new Date().toISOString(),
      users: users.map(user => user.toObject())
    };
    
    // Generate filename with timestamp
    const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
    const filename = `users_backup_${timestamp}.json`;
    const backupPath = path.join(BACKUP_DIR, filename);
    
    // Write to file
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
    
    console.log(colors.green(`Successfully backed up ${users.length} users to ${backupPath}`));
    return backupPath;
  } catch (error) {
    console.error(colors.red('Error backing up users:'), error);
    return null;
  }
}

// Full database backup
async function backupDatabase(options) {
  // Connect to the database
  const conn = await connectDB();
  if (!conn) {
    return;
  }
  
  try {
    console.log(colors.blue('Starting database backup...'));
    
    let collectionsBackupPath = null;
    let productsBackupPath = null;
    let usersBackupPath = null;
    
    // Determine what to backup based on options
    if (options.collectionsOnly) {
      collectionsBackupPath = await backupCollections();
    } else if (options.productsOnly) {
      productsBackupPath = await backupProducts();
    } else {
      // Backup everything
      collectionsBackupPath = await backupCollections();
      productsBackupPath = await backupProducts();
      usersBackupPath = await backupUsers();
    }
    
    console.log(colors.green('\nBackup Summary:'));
    if (collectionsBackupPath) console.log(`Collections: ${collectionsBackupPath}`);
    if (productsBackupPath) console.log(`Products: ${productsBackupPath}`);
    if (usersBackupPath) console.log(`Users: ${usersBackupPath}`);
    
    if (!collectionsBackupPath && !productsBackupPath && !usersBackupPath) {
      console.log(colors.yellow('No data was backed up.'));
    } else {
      console.log(colors.green('\nBackup completed successfully!'));
    }
  } catch (error) {
    console.error(colors.red('Error during backup:'), error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
  }
}

// List available backups
async function listBackups() {
  try {
    // Get all backup files
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.endsWith('.json'))
      .sort()
      .reverse(); // Most recent first
    
    if (files.length === 0) {
      console.log(colors.yellow('No backup files found.'));
      return [];
    }
    
    console.log(colors.green('\nAvailable Backups:'));
    console.log('------------------');
    
    // Group backups by type
    const grouped = {
      collections: [],
      products: [],
      users: [],
      other: []
    };
    
    files.forEach(file => {
      const stats = fs.statSync(path.join(BACKUP_DIR, file));
      const size = (stats.size / 1024 / 1024).toFixed(2) + ' MB';
      const date = moment(stats.mtime).format('YYYY-MM-DD HH:mm:ss');
      const fileInfo = {
        name: file,
        path: path.join(BACKUP_DIR, file),
        date,
        size,
        display: `${file} (${date}, ${size})`
      };
      
      if (file.startsWith('collections_backup_')) {
        grouped.collections.push(fileInfo);
      } else if (file.startsWith('products_backup_')) {
        grouped.products.push(fileInfo);
      } else if (file.startsWith('users_backup_')) {
        grouped.users.push(fileInfo);
      } else {
        grouped.other.push(fileInfo);
      }
    });
    
    // Display grouped backups
    if (grouped.collections.length > 0) {
      console.log(colors.cyan('\nCollection Backups:'));
      grouped.collections.forEach((file, i) => {
        console.log(`${i+1}. ${file.display}`);
      });
    }
    
    if (grouped.products.length > 0) {
      console.log(colors.cyan('\nProduct Backups:'));
      grouped.products.forEach((file, i) => {
        console.log(`${i+1}. ${file.display}`);
      });
    }
    
    if (grouped.users.length > 0) {
      console.log(colors.cyan('\nUser Backups:'));
      grouped.users.forEach((file, i) => {
        console.log(`${i+1}. ${file.display}`);
      });
    }
    
    if (grouped.other.length > 0) {
      console.log(colors.cyan('\nOther Backups:'));
      grouped.other.forEach((file, i) => {
        console.log(`${i+1}. ${file.display}`);
      });
    }
    
    return [
      ...grouped.collections, 
      ...grouped.products, 
      ...grouped.users, 
      ...grouped.other
    ];
  } catch (error) {
    console.error(colors.red('Error listing backups:'), error);
    return [];
  }
}

// Display database statistics
async function viewDatabaseStats() {
  // Connect to the database
  const conn = await connectDB();
  if (!conn) {
    return;
  }
  
  try {
    console.log(colors.blue('\nDatabase Statistics'));
    console.log('===================');
    
    // Products stats
    const totalProducts = await Product.countDocuments();
    console.log(colors.cyan(`\nProducts: ${totalProducts} total`));
    
    if (totalProducts > 0) {
      // Get product statistics
      const productStats = await Product.aggregate([
        {
          $group: {
            _id: null,
            avgPrice: { $avg: '$currentPrice' },
            minPrice: { $min: '$currentPrice' },
            maxPrice: { $max: '$currentPrice' },
            totalProducts: { $sum: 1 },
            sources: { $addToSet: '$source' }
          }
        }
      ]);
      
      if (productStats.length > 0) {
        const { avgPrice, minPrice, maxPrice, sources } = productStats[0];
        console.log(colors.gray(`Average price: $${avgPrice.toFixed(2)}`));
        console.log(colors.gray(`Price range: $${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`));
        console.log(colors.gray(`Sources: ${sources.join(', ')}`));
      }
      
      // Get source distribution
      const sourceStats = await Product.aggregate([
        {
          $group: {
            _id: '$source',
            count: { $sum: 1 },
            avgPrice: { $avg: '$currentPrice' }
          }
        },
        { $sort: { count: -1 } }
      ]);
      
      if (sourceStats.length > 0) {
        console.log(colors.gray('\nSource Distribution:'));
        sourceStats.forEach(source => {
          console.log(colors.gray(`  ${source._id}: ${source.count} products (avg: $${source.avgPrice.toFixed(2)})`));
        });
      }
    }
    
    // Collections stats
    const totalCollections = await ProductCollection.countDocuments();
    console.log(colors.cyan(`\nCollections: ${totalCollections} total`));
    
    if (totalCollections > 0) {
      // Get top collections by product count
      const collections = await ProductCollection.aggregate([
        {
          $project: {
            name: 1,
            productCount: { $size: { $ifNull: ['$products', []] } }
          }
        },
        { $sort: { productCount: -1 } },
        { $limit: 5 }
      ]);
      
      if (collections.length > 0) {
        console.log(colors.gray('\nTop Collections by Product Count:'));
        collections.forEach((collection, index) => {
          console.log(colors.gray(`  ${index + 1}. ${collection.name}: ${collection.productCount} products`));
        });
      }
    }
    
    // Users stats
    const totalUsers = await User.countDocuments();
    console.log(colors.cyan(`\nUsers: ${totalUsers} total`));
    
    // Display DB size info if available
    try {
      const dbStats = await mongoose.connection.db.stats();
      const dbSizeMB = (dbStats.storageSize / (1024 * 1024)).toFixed(2);
      const indexSizeMB = (dbStats.indexSize / (1024 * 1024)).toFixed(2);
      
      console.log(colors.cyan(`\nDatabase Size:`));
      console.log(colors.gray(`  Storage: ${dbSizeMB} MB`));
      console.log(colors.gray(`  Indexes: ${indexSizeMB} MB`));
    } catch (error) {
      console.error(colors.yellow('Could not retrieve database size information.'));
    }
  } catch (error) {
    console.error(colors.red('Error getting database statistics:'), error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
  }
}

// Main program definition
program
  .name('db-tools-cli')
  .description('Database Tools for SaleSnipe (CLI version)')
  .version('1.0.0');

program
  .command('check')
  .description('Check database connection')
  .action(checkConnection);

program
  .command('backup')
  .description('Backup database collections and products')
  .option('-c, --collections-only', 'Backup only collections')
  .option('-p, --products-only', 'Backup only products')
  .action(backupDatabase);

program
  .command('list-backups')
  .description('List available backup files')
  .action(listBackups);

program
  .command('stats')
  .description('View database statistics')
  .action(viewDatabaseStats);

// Main function
async function main() {
  try {
    program.parse(process.argv);
    
    // If no command is specified, display help
    if (process.argv.length <= 2) {
      program.help();
    }
  } catch (error) {
    console.error(colors.red('Error:'), error.message);
    process.exit(1);
  }
}

main(); 