#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
// Replace the direct require with dynamic import for inquirer
// const inquirer = require('inquirer');
const colors = require('colors');
const clear = require('clear');
const figlet = require('figlet');
const fs = require('fs');
const moment = require('moment');
const { program } = require('commander');

// Import models
const Product = require('../backend/models/Product');
const ProductCollection = require('../backend/models/ProductCollection');
const User = require('../backend/models/User');

// Import services
const scraperService = require('../backend/services/scraperService');
const collectionService = require('../backend/services/collectionService');

// Constants
const BACKUP_DIR = path.join(__dirname, '../backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Load inquirer dynamically
let inquirer;
async function loadInquirer() {
  try {
    // Try the CommonJS way first
    inquirer = require('inquirer');
  } catch (error) {
    // If that fails, try to import as ESM
    try {
      inquirer = (await import('inquirer')).default;
    } catch (err) {
      console.error(colors.red('Error loading inquirer:'), err);
      console.error(colors.yellow('Please install inquirer with: npm install inquirer@^8.0.0'));
      process.exit(1);
    }
  }
}

// Make sure to await this before using inquirer
loadInquirer();

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
    
    // Get all products (note: this could be a lot of data)
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
    
    return [...grouped.collections, ...grouped.products, ...grouped.users, ...grouped.other];
  } catch (error) {
    console.error(colors.red('Error listing backups:'), error);
    return [];
  }
}

// Restore database from backup
async function restoreDatabase() {
  // Connect to the database
  const conn = await connectDB();
  if (!conn) {
    return;
  }
  
  try {
    console.log(colors.blue('Database Restore Tool'));
    console.log('=====================');
    
    // List available backups
    const backups = await listBackups();
    
    if (backups.length === 0) {
      return;
    }
    
    // Let user select what to restore
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to restore?',
        choices: [
          { name: 'Collections', value: 'collections' },
          { name: 'Products', value: 'products' },
          { name: 'Users', value: 'users' },
          { name: 'Return to main menu', value: 'cancel' }
        ]
      }
    ]);
    
    if (action === 'cancel') {
      return;
    }
    
    // Filter backups by type
    let filteredBackups;
    let entityName;
    
    switch (action) {
      case 'collections':
        filteredBackups = backups.filter(b => b.name.startsWith('collections_backup_'));
        entityName = 'collections';
        break;
      case 'products':
        filteredBackups = backups.filter(b => b.name.startsWith('products_backup_'));
        entityName = 'products';
        break;
      case 'users':
        filteredBackups = backups.filter(b => b.name.startsWith('users_backup_'));
        entityName = 'users';
        break;
    }
    
    if (filteredBackups.length === 0) {
      console.log(colors.yellow(`No ${entityName} backups found.`));
      return;
    }
    
    // Let user select a backup file
    const { backupFile } = await inquirer.prompt([
      {
        type: 'list',
        name: 'backupFile',
        message: `Select a ${entityName} backup to restore:`,
        choices: filteredBackups.map(file => ({
          name: file.display,
          value: file.path
        }))
      }
    ]);
    
    // Confirm restoration
    const { confirmRestore } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmRestore',
        message: `This will REPLACE all existing ${entityName}. Are you sure?`,
        default: false
      }
    ]);
    
    if (!confirmRestore) {
      console.log(colors.yellow('Restoration cancelled.'));
      return;
    }
    
    // Load backup file
    const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    
    // Perform restoration based on entity type
    switch (action) {
      case 'collections':
        await restoreCollections(backupData);
        break;
      case 'products':
        await restoreProducts(backupData);
        break;
      case 'users':
        await restoreUsers(backupData);
        break;
    }
  } catch (error) {
    console.error(colors.red('Error during restore:'), error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
  }
}

// Restore collections from backup data
async function restoreCollections(backupData) {
  try {
    // Clear existing collections
    await ProductCollection.deleteMany({});
    console.log(colors.yellow('Existing collections cleared.'));
    
    // Restore collections from backup
    let restoredCount = 0;
    for (const collectionData of backupData.collections) {
      // Remove MongoDB specific fields
      delete collectionData._id;
      delete collectionData.__v;
      
      // Create new collection
      const collection = new ProductCollection(collectionData);
      await collection.save();
      restoredCount++;
    }
    
    console.log(colors.green(`Successfully restored ${restoredCount} collections from backup!`));
  } catch (error) {
    console.error(colors.red('Error restoring collections:'), error);
  }
}

// Restore products from backup data
async function restoreProducts(backupData) {
  try {
    // Clear existing products
    await Product.deleteMany({});
    console.log(colors.yellow('Existing products cleared.'));
    
    // Restore products from backup
    let restoredCount = 0;
    for (const productData of backupData.products) {
      // Remove MongoDB specific fields
      delete productData._id;
      delete productData.__v;
      
      // Create new product
      const product = new Product(productData);
      await product.save();
      restoredCount++;
    }
    
    console.log(colors.green(`Successfully restored ${restoredCount} products from backup!`));
  } catch (error) {
    console.error(colors.red('Error restoring products:'), error);
  }
}

// Restore users from backup data
async function restoreUsers(backupData) {
  try {
    // Clear existing users
    await User.deleteMany({});
    console.log(colors.yellow('Existing users cleared.'));
    
    // Restore users from backup
    let restoredCount = 0;
    for (const userData of backupData.users) {
      // Remove MongoDB specific fields
      delete userData._id;
      delete userData.__v;
      
      // Create new user
      const user = new User(userData);
      await user.save();
      restoredCount++;
    }
    
    console.log(colors.green(`Successfully restored ${restoredCount} users from backup!`));
  } catch (error) {
    console.error(colors.red('Error restoring users:'), error);
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

// Display banner for interactive mode
function displayBanner() {
  clear();
  console.log(
    colors.yellow(
      figlet.textSync('DB Tools', { horizontalLayout: 'full' })
    )
  );
  console.log(colors.cyan('Integrated Database Management Tool for SaleSnipe\n'));
}

// Show interactive main menu
async function showMainMenu() {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: 'View Database Statistics', value: 'stats' },
        new inquirer.Separator(),
        { name: 'Backup Database', value: 'backup' },
        { name: 'Restore Database', value: 'restore' },
        { name: 'Delete Backup Files', value: 'deleteBackup' },
        new inquirer.Separator(),
        { name: 'Manage Products', value: 'products' },
        { name: 'Manage Collections', value: 'collections' },
        { name: 'Manage Users', value: 'users' },
        new inquirer.Separator(),
        { name: 'Clean Database', value: 'clean' },
        { name: 'Refresh All Collections', value: 'refreshCollections' },
        new inquirer.Separator(),
        { name: 'Exit', value: 'exit' }
      ]
    }
  ]);
  
  return action;
}

// Show product management menu
async function showProductsMenu() {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Product Management:',
      choices: [
        { name: 'View All Products', value: 'viewProducts' },
        { name: 'View Price History', value: 'viewPriceHistory' },
        { name: 'Delete Specific Products', value: 'deleteProducts' },
        { name: 'Clear All Products', value: 'clearProducts' },
        { name: 'Run Product Scraper', value: 'runScraper' },
        { name: 'Back to Main Menu', value: 'back' }
      ]
    }
  ]);
  
  return action;
}

// Show collections management menu
async function showCollectionsMenu() {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Collection Management:',
      choices: [
        { name: 'View All Collections', value: 'viewCollections' },
        { name: 'View Collection Details', value: 'viewCollectionDetails' },
        { name: 'Create New Collection', value: 'createCollection' },
        { name: 'Refresh Collection', value: 'refreshCollection' },
        { name: 'Delete Collection', value: 'deleteCollection' },
        { name: 'Back to Main Menu', value: 'back' }
      ]
    }
  ]);
  
  return action;
}

// Show users management menu
async function showUsersMenu() {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'User Management:',
      choices: [
        { name: 'View All Users', value: 'viewUsers' },
        { name: 'View User Details', value: 'viewUserDetails' },
        { name: 'Delete User', value: 'deleteUser' },
        { name: 'Back to Main Menu', value: 'back' }
      ]
    }
  ]);
  
  return action;
}

// Interactive mode main function
async function startInteractiveMode() {
  displayBanner();
  
  // Connect to the database
  const conn = await connectDB();
  if (!conn) {
    return;
  }
  
  let exit = false;
  
  while (!exit) {
    const action = await showMainMenu();
    
    switch (action) {
      case 'stats':
        await viewDatabaseStats();
        break;
      case 'backup':
        await backupDatabase({});
        break;
      case 'restore':
        await restoreDatabase();
        break;
      case 'deleteBackup':
        await deleteBackup();
        break;
      case 'products':
        await handleProductsMenu();
        break;
      case 'collections':
        await handleCollectionsMenu();
        break;
      case 'users':
        await handleUsersMenu();
        break;
      case 'clean':
        await cleanDatabase();
        break;
      case 'refreshCollections':
        await refreshAllCollections();
        break;
      case 'exit':
        exit = true;
        break;
    }
    
    if (!exit) {
      await inquirer.prompt([
        {
          type: 'input',
          name: 'continue',
          message: 'Press Enter to continue...'
        }
      ]);
      displayBanner();
    }
  }
  
  console.log(colors.green('Goodbye!'));
  await mongoose.connection.close();
}

// Handler for products menu
async function handleProductsMenu() {
  let back = false;
  
  while (!back) {
    const action = await showProductsMenu();
    
    switch (action) {
      case 'viewProducts':
        await viewProducts();
        break;
      case 'viewPriceHistory':
        await viewPriceHistory();
        break;
      case 'deleteProducts':
        await deleteProducts();
        break;
      case 'clearProducts':
        await clearProducts();
        break;
      case 'runScraper':
        await runScraper();
        break;
      case 'back':
        back = true;
        break;
    }
    
    if (!back) {
      await inquirer.prompt([
        {
          type: 'input',
          name: 'continue',
          message: 'Press Enter to continue...'
        }
      ]);
    }
  }
}

// Handler for collections menu
async function handleCollectionsMenu() {
  let back = false;
  
  while (!back) {
    const action = await showCollectionsMenu();
    
    switch (action) {
      case 'viewCollections':
        await viewCollections();
        break;
      case 'viewCollectionDetails':
        await viewCollectionDetails();
        break;
      case 'createCollection':
        await createCollection();
        break;
      case 'refreshCollection':
        await refreshCollection();
        break;
      case 'deleteCollection':
        await deleteCollection();
        break;
      case 'back':
        back = true;
        break;
    }
    
    if (!back) {
      await inquirer.prompt([
        {
          type: 'input',
          name: 'continue',
          message: 'Press Enter to continue...'
        }
      ]);
    }
  }
}

// Handler for users menu
async function handleUsersMenu() {
  let back = false;
  
  while (!back) {
    const action = await showUsersMenu();
    
    switch (action) {
      case 'viewUsers':
        await viewUsers();
        break;
      case 'viewUserDetails':
        await viewUserDetails();
        break;
      case 'deleteUser':
        await deleteUser();
        break;
      case 'back':
        back = true;
        break;
    }
    
    if (!back) {
      await inquirer.prompt([
        {
          type: 'input',
          name: 'continue',
          message: 'Press Enter to continue...'
        }
      ]);
    }
  }
}

// Placeholder functions for product operations
async function viewProducts() {
  try {
    const products = await Product.find({}).sort({ createdAt: -1 });
    
    if (products.length === 0) {
      console.log(colors.yellow('\nNo products found in database.'));
      return;
    }

    console.log(colors.green(`\nFound ${products.length} products:\n`));
    products.forEach((product, index) => {
      console.log(colors.cyan(`\n${index + 1}. ${product.title}`));
      console.log(colors.gray('ID:'), product._id);
      console.log(colors.gray('Source:'), product.source);
      console.log(colors.gray('Site Product ID:'), product.siteProductId);
      console.log(colors.gray('Current Price:'), `$${product.currentPrice}`);
      console.log(colors.gray('URL:'), product.url);
      console.log(colors.gray('Price History:'), product.priceHistory.length, 'entries');
      console.log(colors.gray('Last Updated:'), new Date(product.lastUpdated).toLocaleString());
    });
  } catch (error) {
    console.error(colors.red('Error viewing products:'), error);
  }
}

async function viewPriceHistory() {
  try {
    const products = await Product.find({}, 'title source siteProductId');
    
    if (products.length === 0) {
      console.log(colors.yellow('\nNo products found in database.'));
      return;
    }

    const { productId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'productId',
        message: 'Select a product to view price history:',
        choices: products.map(p => ({
          name: `${p.title} (${p.source} - ${p.siteProductId})`,
          value: p._id
        }))
      }
    ]);

    const product = await Product.findById(productId);
    console.log(colors.cyan(`\nPrice history for ${product.title}:`));
    
    product.priceHistory.sort((a, b) => b.timestamp - a.timestamp)
      .forEach((entry, index) => {
        console.log(colors.gray(`${index + 1}.`),
          `$${entry.price}`,
          colors.gray(`(${new Date(entry.timestamp).toLocaleString()})`));
      });
  } catch (error) {
    console.error(colors.red('Error viewing price history:'), error);
  }
}

async function deleteProducts() {
  try {
    const products = await Product.find({}, 'title source siteProductId');
    
    if (products.length === 0) {
      console.log(colors.yellow('\nNo products found in database.'));
      return;
    }

    const { selectedProducts } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedProducts',
        message: 'Select products to delete:',
        choices: products.map(p => ({
          name: `${p.title} (${p.source} - ${p.siteProductId})`,
          value: p._id
        }))
      }
    ]);

    if (selectedProducts.length === 0) {
      console.log(colors.yellow('\nNo products selected for deletion.'));
      return;
    }

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Are you sure you want to delete ${selectedProducts.length} selected products?`,
        default: false
      }
    ]);

    if (confirm) {
      await Product.deleteMany({ _id: { $in: selectedProducts } });
      console.log(colors.green(`\n${selectedProducts.length} products have been deleted.`));
    } else {
      console.log(colors.yellow('\nOperation cancelled.'));
    }
  } catch (error) {
    console.error(colors.red('Error deleting products:'), error);
  }
}

async function clearProducts() {
  try {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: colors.red('Are you sure you want to delete ALL products? This cannot be undone!'),
        default: false
      }
    ]);

    if (confirm) {
      await Product.deleteMany({});
      console.log(colors.green('\nAll products have been deleted from the database.'));
    } else {
      console.log(colors.yellow('\nOperation cancelled.'));
    }
  } catch (error) {
    console.error(colors.red('Error clearing products:'), error);
  }
}

async function runScraper() {
  console.log(colors.yellow('Running scraper is not implemented in this tool yet.'));
  console.log(colors.yellow('Please use the dedicated run-scraper.js tool instead.'));
}

// Placeholder functions for collection operations
async function viewCollections() {
  try {
    const collections = await ProductCollection.find().sort({ name: 1 });
    
    if (collections.length === 0) {
      console.log(colors.yellow('\nNo collections found in database.'));
      return;
    }
    
    console.log(colors.green(`\nFound ${collections.length} collections:\n`));
    
    collections.forEach((collection, index) => {
      console.log(colors.cyan(`${index + 1}. ${collection.name}`));
      console.log(colors.gray('  Description:'), collection.description || 'No description');
      console.log(colors.gray('  Products:'), collection.products?.length || 0);
      console.log(colors.gray('  Last Updated:'), collection.lastUpdated ? 
        new Date(collection.lastUpdated).toLocaleString() : 'Never');
    });
  } catch (error) {
    console.error(colors.red('Error viewing collections:'), error);
  }
}

async function viewCollectionDetails() {
  try {
    const collections = await ProductCollection.find({}, 'name description');
    
    if (collections.length === 0) {
      console.log(colors.yellow('\nNo collections found in database.'));
      return;
    }
    
    const { collectionId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'collectionId',
        message: 'Select a collection to view details:',
        choices: collections.map(c => ({
          name: c.name,
          value: c._id
        }))
      }
    ]);
    
    // Get collection with populated products
    const collection = await ProductCollection.findById(collectionId).populate('products');
    
    console.log(colors.cyan(`\nCollection: ${collection.name}`));
    console.log(colors.gray('Description:'), collection.description || 'No description');
    console.log(colors.gray('Search Terms:'), collection.searchTerms?.join(', ') || 'None');
    console.log(colors.gray('Last Updated:'), collection.lastUpdated ? 
      new Date(collection.lastUpdated).toLocaleString() : 'Never');
    
    if (!collection.products || collection.products.length === 0) {
      console.log(colors.yellow('\nThis collection has no products.'));
      return;
    }
    
    console.log(colors.green(`\nProducts (${collection.products.length}):`));
    collection.products.forEach((product, index) => {
      console.log(colors.cyan(`\n${index + 1}. ${product.title}`));
      console.log(colors.gray('  Price:'), `$${product.currentPrice}`);
      console.log(colors.gray('  Source:'), product.source);
      console.log(colors.gray('  Last Updated:'), new Date(product.lastUpdated).toLocaleString());
    });
    
  } catch (error) {
    console.error(colors.red('Error viewing collection details:'), error);
  }
}

async function createCollection() {
  console.log(colors.yellow('Collection creation is not implemented in this tool yet.'));
}

async function refreshCollection() {
  console.log(colors.yellow('Collection refresh is not implemented in this tool yet.'));
}

async function deleteCollection() {
  try {
    const collections = await ProductCollection.find({}, 'name');
    
    if (collections.length === 0) {
      console.log(colors.yellow('\nNo collections found in database.'));
      return;
    }
    
    const { collectionId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'collectionId',
        message: 'Select a collection to delete:',
        choices: collections.map(c => ({
          name: c.name,
          value: c._id
        }))
      }
    ]);
    
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: colors.red('Are you sure you want to delete this collection? This cannot be undone!'),
        default: false
      }
    ]);
    
    if (confirm) {
      await ProductCollection.findByIdAndDelete(collectionId);
      console.log(colors.green('\nCollection has been deleted from the database.'));
    } else {
      console.log(colors.yellow('\nOperation cancelled.'));
    }
  } catch (error) {
    console.error(colors.red('Error deleting collection:'), error);
  }
}

// Placeholder functions for user operations
async function viewUsers() {
  try {
    const users = await User.find().sort({ name: 1 });
    
    if (users.length === 0) {
      console.log(colors.yellow('\nNo users found in database.'));
      return;
    }
    
    console.log(colors.green(`\nFound ${users.length} users:\n`));
    
    users.forEach((user, index) => {
      console.log(colors.cyan(`${index + 1}. ${user.name}`));
      console.log(colors.gray('  Email:'), user.email);
      console.log(colors.gray('  ID:'), user._id);
      console.log(colors.gray('  Created:'), new Date(user.createdAt).toLocaleString());
    });
  } catch (error) {
    console.error(colors.red('Error viewing users:'), error);
  }
}

async function viewUserDetails() {
  try {
    const users = await User.find({}, 'name email');
    
    if (users.length === 0) {
      console.log(colors.yellow('\nNo users found in database.'));
      return;
    }
    
    const { userId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'userId',
        message: 'Select a user to view details:',
        choices: users.map(u => ({
          name: `${u.name} (${u.email})`,
          value: u._id
        }))
      }
    ]);
    
    const user = await User.findById(userId);
    
    console.log(colors.cyan(`\nUser: ${user.name}`));
    console.log(colors.gray('Email:'), user.email);
    console.log(colors.gray('ID:'), user._id);
    console.log(colors.gray('Created:'), new Date(user.createdAt).toLocaleString());
    console.log(colors.gray('Last Updated:'), new Date(user.updatedAt).toLocaleString());
    
    if (user.preferences) {
      console.log(colors.cyan('\nPreferences:'));
      console.log(colors.gray('  Email Notifications:'), user.preferences.emailNotifications ? 'Yes' : 'No');
      console.log(colors.gray('  Desktop Notifications:'), user.preferences.desktopNotifications ? 'Yes' : 'No');
      console.log(colors.gray('  Currency:'), user.preferences.currency || 'USD');
    }
    
    if (user.watchlist && user.watchlist.length > 0) {
      console.log(colors.cyan(`\nWatchlist (${user.watchlist.length} items):`));
      // This would typically need to populate watchlist items
      console.log(colors.gray('  Watchlist IDs:'), user.watchlist.join(', '));
    }
  } catch (error) {
    console.error(colors.red('Error viewing user details:'), error);
  }
}

async function deleteUser() {
  try {
    const users = await User.find({}, 'name email');
    
    if (users.length === 0) {
      console.log(colors.yellow('\nNo users found in database.'));
      return;
    }
    
    const { userId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'userId',
        message: 'Select a user to delete:',
        choices: users.map(u => ({
          name: `${u.name} (${u.email})`,
          value: u._id
        }))
      }
    ]);
    
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: colors.red('Are you sure you want to delete this user? This cannot be undone!'),
        default: false
      }
    ]);
    
    if (confirm) {
      await User.findByIdAndDelete(userId);
      console.log(colors.green('\nUser has been deleted from the database.'));
    } else {
      console.log(colors.yellow('\nOperation cancelled.'));
    }
  } catch (error) {
    console.error(colors.red('Error deleting user:'), error);
  }
}

// Delete a backup file
async function deleteBackup() {
  try {
    // List available backups
    const backups = await listBackups();
    
    if (backups.length === 0) {
      return;
    }
    
    const { backupFile } = await inquirer.prompt([
      {
        type: 'list',
        name: 'backupFile',
        message: 'Select a backup file to delete:',
        choices: backups.map(file => ({
          name: file.display,
          value: file.path
        }))
      }
    ]);
    
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: colors.red('Are you sure you want to delete this backup file? This cannot be undone!'),
        default: false
      }
    ]);
    
    if (confirm) {
      fs.unlinkSync(backupFile);
      console.log(colors.green('\nBackup file has been deleted.'));
    } else {
      console.log(colors.yellow('\nOperation cancelled.'));
    }
  } catch (error) {
    console.error(colors.red('Error deleting backup:'), error);
  }
}

// Clean database (placeholder function)
async function cleanDatabase() {
  console.log(colors.yellow('Database cleaning is not implemented in this tool yet.'));
}

// Refresh all collections (placeholder function)
async function refreshAllCollections() {
  console.log(colors.yellow('Collection refresh is not implemented in this tool yet.'));
  console.log(colors.yellow('Please use the dedicated refresh-collections.js tool instead.'));
}

// Parse command line arguments and run the appropriate command
async function main() {
  // Make sure inquirer is loaded before proceeding
  await loadInquirer();
  program.parse(process.argv);
}

main().catch(err => {
  console.error(colors.red('Fatal error:'), err);
  process.exit(1);
});

// Export the module for use in other scripts
module.exports = {
  checkConnection,
  backupDatabase,
  restoreDatabase,
  viewDatabaseStats,
  startInteractiveMode
}; 