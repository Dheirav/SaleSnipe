require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../backend/config/db');
const Product = require('../backend/models/Product');
const ProductCollection = require('../backend/models/ProductCollection');
const fs = require('fs');
const path = require('path');
const colors = require('colors');
const { program } = require('commander');
const inquirer = require('inquirer');
const moment = require('moment');

// Backup directory
const BACKUP_DIR = path.join(__dirname, '../backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Connect to the database
async function initializeDatabase() {
  try {
    console.log(colors.blue('Connecting to MongoDB...'));
    await connectDB();
    console.log(colors.green('Connected to MongoDB!'));
  } catch (error) {
    console.error(colors.red('Failed to connect to MongoDB:'), error);
    process.exit(1);
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
      return;
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
    // We might need to do this in chunks for very large databases
    const products = await Product.find();
    
    if (products.length === 0) {
      console.log(colors.yellow('No products found to backup.'));
      return;
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

// Backup everything
async function backupAll() {
  try {
    console.log(colors.blue('Starting full database backup...'));
    
    // Backup collections and products
    const collectionsBackupPath = await backupCollections();
    const productsBackupPath = await backupProducts();
    
    if (collectionsBackupPath && productsBackupPath) {
      console.log(colors.green('Full backup completed successfully!'));
      console.log(colors.cyan('Backup files:'));
      console.log(`Collections: ${collectionsBackupPath}`);
      console.log(`Products: ${productsBackupPath}`);
    } else {
      console.log(colors.red('Backup completed with errors. Check above for details.'));
    }
  } catch (error) {
    console.error(colors.red('Error creating full backup:'), error);
  }
}

// Restore collections from backup
async function restoreCollections() {
  try {
    // List available backups
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('collections_backup_') && file.endsWith('.json'))
      .sort()
      .reverse(); // Most recent first
    
    if (files.length === 0) {
      console.log(colors.yellow('No collection backups found in the backup directory.'));
      return;
    }
    
    // Let user select a backup file
    const { backupFile } = await inquirer.prompt([
      {
        type: 'list',
        name: 'backupFile',
        message: 'Select a collection backup to restore:',
        choices: files.map(file => {
          const stats = fs.statSync(path.join(BACKUP_DIR, file));
          return {
            name: `${file} (${moment(stats.mtime).format('YYYY-MM-DD HH:mm:ss')})`,
            value: file
          };
        })
      }
    ]);
    
    // Confirm restoration
    const { confirmRestore } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmRestore',
        message: 'This will REPLACE all existing collections. Are you sure?',
        default: false
      }
    ]);
    
    if (!confirmRestore) {
      console.log(colors.yellow('Restoration cancelled.'));
      return;
    }
    
    // Load backup file
    const backupPath = path.join(BACKUP_DIR, backupFile);
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    
    // Clear existing collections
    await ProductCollection.deleteMany({});
    
    // Restore collections from backup
    for (const collectionData of backupData.collections) {
      // Remove MongoDB specific fields
      delete collectionData._id;
      delete collectionData.__v;
      
      // Create new collection
      const collection = new ProductCollection(collectionData);
      await collection.save();
    }
    
    console.log(colors.green(`Successfully restored ${backupData.collections.length} collections from backup!`));
  } catch (error) {
    console.error(colors.red('Error restoring collections:'), error);
  }
}

// Restore products from backup
async function restoreProducts() {
  try {
    // List available backups
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('products_backup_') && file.endsWith('.json'))
      .sort()
      .reverse(); // Most recent first
    
    if (files.length === 0) {
      console.log(colors.yellow('No product backups found in the backup directory.'));
      return;
    }
    
    // Let user select a backup file
    const { backupFile } = await inquirer.prompt([
      {
        type: 'list',
        name: 'backupFile',
        message: 'Select a product backup to restore:',
        choices: files.map(file => {
          const stats = fs.statSync(path.join(BACKUP_DIR, file));
          return {
            name: `${file} (${moment(stats.mtime).format('YYYY-MM-DD HH:mm:ss')})`,
            value: file
          };
        })
      }
    ]);
    
    // Confirm restoration
    const { confirmRestore } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmRestore',
        message: 'This will REPLACE all existing products. Are you sure?',
        default: false
      }
    ]);
    
    if (!confirmRestore) {
      console.log(colors.yellow('Restoration cancelled.'));
      return;
    }
    
    // Load backup file
    const backupPath = path.join(BACKUP_DIR, backupFile);
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    
    // Clear existing products
    await Product.deleteMany({});
    
    // Restore products from backup
    let restoredCount = 0;
    for (const productData of backupData.products) {
      try {
        // Remove MongoDB specific fields
        delete productData._id;
        delete productData.__v;
        
        // Create new product
        const product = new Product(productData);
        await product.save();
        restoredCount++;
        
        // Show progress for large restores
        if (restoredCount % 100 === 0) {
          process.stdout.write(`\rRestoring products... ${restoredCount}/${backupData.products.length}`);
        }
      } catch (err) {
        console.error(colors.yellow(`Error restoring product: ${err.message}`));
      }
    }
    
    console.log(colors.green(`\nSuccessfully restored ${restoredCount} products from backup!`));
    
    // Update collection references
    console.log(colors.blue('Updating collection references...'));
    const collections = await ProductCollection.find();
    for (const collection of collections) {
      // Validate product references
      const validProducts = [];
      for (const productId of collection.products) {
        const exists = await Product.exists({ _id: productId });
        if (exists) {
          validProducts.push(productId);
        }
      }
      
      // Update collection with valid product references
      collection.products = validProducts;
      await collection.save();
    }
    
    console.log(colors.green('Collection references updated successfully!'));
  } catch (error) {
    console.error(colors.red('Error restoring products:'), error);
  }
}

// List available backups
async function listBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => (file.startsWith('collections_backup_') || file.startsWith('products_backup_')) && file.endsWith('.json'))
      .sort();
    
    if (files.length === 0) {
      console.log(colors.yellow('No backups found in the backup directory.'));
      return;
    }
    
    console.log(colors.green('Available backups:'));
    
    const collectionBackups = files.filter(file => file.startsWith('collections_backup_'));
    const productBackups = files.filter(file => file.startsWith('products_backup_'));
    
    if (collectionBackups.length > 0) {
      console.log(colors.cyan('\nCollection backups:'));
      collectionBackups.forEach(file => {
        const stats = fs.statSync(path.join(BACKUP_DIR, file));
        const backupData = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, file), 'utf8'));
        const collectionsCount = backupData.collections ? backupData.collections.length : 0;
        
        console.log(`${file} - ${moment(stats.mtime).format('YYYY-MM-DD HH:mm:ss')} - ${collectionsCount} collections`);
      });
    }
    
    if (productBackups.length > 0) {
      console.log(colors.cyan('\nProduct backups:'));
      productBackups.forEach(file => {
        const stats = fs.statSync(path.join(BACKUP_DIR, file));
        const backupData = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, file), 'utf8'));
        const productsCount = backupData.products ? backupData.products.length : 0;
        
        console.log(`${file} - ${moment(stats.mtime).format('YYYY-MM-DD HH:mm:ss')} - ${productsCount} products`);
      });
    }
  } catch (error) {
    console.error(colors.red('Error listing backups:'), error);
  }
}

// Delete a backup
async function deleteBackup() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => (file.startsWith('collections_backup_') || file.startsWith('products_backup_')) && file.endsWith('.json'))
      .sort();
    
    if (files.length === 0) {
      console.log(colors.yellow('No backups found in the backup directory.'));
      return;
    }
    
    const { backupFile } = await inquirer.prompt([
      {
        type: 'list',
        name: 'backupFile',
        message: 'Select a backup to delete:',
        choices: files.map(file => {
          const stats = fs.statSync(path.join(BACKUP_DIR, file));
          return {
            name: `${file} (${moment(stats.mtime).format('YYYY-MM-DD HH:mm:ss')})`,
            value: file
          };
        })
      }
    ]);
    
    const { confirmDelete } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmDelete',
        message: `Are you sure you want to delete ${backupFile}? This cannot be undone.`,
        default: false
      }
    ]);
    
    if (!confirmDelete) {
      console.log(colors.yellow('Deletion cancelled.'));
      return;
    }
    
    fs.unlinkSync(path.join(BACKUP_DIR, backupFile));
    console.log(colors.green(`Successfully deleted backup: ${backupFile}`));
  } catch (error) {
    console.error(colors.red('Error deleting backup:'), error);
  }
}

// Main menu function
async function showMainMenu() {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        'Backup Collections',
        'Backup Products',
        'Backup Everything',
        'Restore Collections',
        'Restore Products',
        'List Backups',
        'Delete Backup',
        'Exit'
      ]
    }
  ]);
  
  switch (action) {
    case 'Backup Collections':
      await backupCollections();
      break;
    case 'Backup Products':
      await backupProducts();
      break;
    case 'Backup Everything':
      await backupAll();
      break;
    case 'Restore Collections':
      await restoreCollections();
      break;
    case 'Restore Products':
      await restoreProducts();
      break;
    case 'List Backups':
      await listBackups();
      break;
    case 'Delete Backup':
      await deleteBackup();
      break;
    case 'Exit':
      console.log(colors.green('Goodbye!'));
      process.exit(0);
    default:
      console.log(colors.yellow('Invalid option. Please try again.'));
  }
  
  // After action completion, show the menu again unless exiting
  if (action !== 'Exit') {
    console.log('\n'); // Add some spacing
    await showMainMenu();
  }
}

// Commander setup for CLI
program
  .version('1.0.0')
  .description('SaleSnipe Database Backup Utility')
  .option('-b, --backup', 'Backup everything immediately')
  .option('-l, --list', 'List available backups')
  .parse(process.argv);

// Main function
async function main() {
  try {
    const options = program.opts();
    
    // Connect to the database
    await initializeDatabase();
    
    // Check for direct commands
    if (options.backup) {
      await backupAll();
      process.exit(0);
    } else if (options.list) {
      await listBackups();
      process.exit(0);
    }
    
    // Show the title
    console.log(colors.green('============================='));
    console.log(colors.green('  SaleSnipe Backup Utility  '));
    console.log(colors.green('============================='));
    
    // Show the main menu
    await showMainMenu();
  } catch (error) {
    console.error(colors.red('An error occurred:'), error);
    process.exit(1);
  }
}

// Start the application
main(); 