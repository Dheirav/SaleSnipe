#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const inquirer = require('inquirer');
const colors = require('colors');
const clear = require('clear');
const figlet = require('figlet');
const Product = require('../backend/models/Product');
const ProductCollection = require('../backend/models/ProductCollection');
const User = require('../backend/models/User');
const scraperService = require('../backend/services/scraperService');
const collectionService = require('../backend/services/collectionService');
const { program } = require('commander');

// Connect to MongoDB
async function connectDB() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set. Please check your .env file.');
    }
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(colors.cyan(`MongoDB Connected: ${conn.connection.host}`));
  } catch (error) {
    console.error(colors.red('Error connecting to MongoDB:'), error.message);
    console.error(colors.yellow('\nPlease make sure:'));
    console.error(colors.yellow('1. Your .env file exists in the project root'));
    console.error(colors.yellow('2. MONGODB_URI is properly set in .env'));
    console.error(colors.yellow('3. MongoDB server is running'));
    process.exit(1);
  }
}

// Display banner
function displayBanner() {
  clear();
  console.log(
    colors.yellow(
      figlet.textSync('DB Manager', { horizontalLayout: 'full' })
    )
  );
  console.log(colors.cyan('Database Management Tool for SaleSnipe\n'));
}

// View all products
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

// View price history for a product
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

// Clear all products
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

// Delete specific products
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

// View database stats
async function viewStats() {
  try {
    const totalProducts = await Product.countDocuments();
    const stats = await Product.aggregate([
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

    const sourceStats = await Product.aggregate([
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 },
          avgPrice: { $avg: '$currentPrice' }
        }
      }
    ]);

    console.log(colors.cyan('\nDatabase Statistics:'));
    console.log(colors.gray('Total Products:'), totalProducts);
    
    if (stats.length > 0) {
      console.log(colors.gray('Average Price:'), `$${stats[0].avgPrice.toFixed(2)}`);
      console.log(colors.gray('Minimum Price:'), `$${stats[0].minPrice.toFixed(2)}`);
      console.log(colors.gray('Maximum Price:'), `$${stats[0].maxPrice.toFixed(2)}`);
      console.log(colors.gray('Sources:'), stats[0].sources.join(', '));
    }

    console.log(colors.cyan('\nSource Statistics:'));
    sourceStats.forEach(stat => {
      console.log(colors.gray(`${stat._id}:`),
        `${stat.count} products,`,
        `avg price $${stat.avgPrice.toFixed(2)}`);
    });
  } catch (error) {
    console.error(colors.red('Error viewing stats:'), error);
  }
}

// Main menu
async function mainMenu() {
  while (true) {
    const { choice } = await inquirer.prompt([
      {
        type: 'list',
        name: 'choice',
        message: 'What would you like to do?',
        choices: [
          { name: 'View All Products', value: 'view' },
          { name: 'View Price History', value: 'history' },
          { name: 'View Database Stats', value: 'stats' },
          { name: 'Delete Specific Products', value: 'delete' },
          { name: 'Clear All Products', value: 'clear' },
          { name: 'Clear Screen', value: 'cls' },
          { name: 'Exit', value: 'exit' }
        ]
      }
    ]);

    switch (choice) {
      case 'view':
        await viewProducts();
        break;
      case 'history':
        await viewPriceHistory();
        break;
      case 'stats':
        await viewStats();
        break;
      case 'delete':
        await deleteProducts();
        break;
      case 'clear':
        await clearProducts();
        break;
      case 'cls':
        displayBanner();
        break;
      case 'exit':
        console.log(colors.green('\nGoodbye!'));
        process.exit(0);
    }

    console.log('\nPress Enter to continue...');
    await inquirer.prompt([{ type: 'input', name: 'continue', message: '' }]);
    displayBanner();
  }
}

// Start the application
async function start() {
  try {
    displayBanner();
    await connectDB();
    await mainMenu();
  } catch (error) {
    console.error(colors.red('Fatal error:'), error);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log(colors.yellow('\nClosing database connection...'));
  await mongoose.connection.close();
  console.log(colors.green('Goodbye!'));
  process.exit(0);
});

start(); 

// Function to refresh all collections
async function refreshAllCollections() {
  try {
    console.log(colors.blue('Starting refresh of all product collections...'));
    
    const collections = [
      { name: 'trending', searchTerm: 'trending' },
      { name: 'discount-deals', searchTerm: 'discount deals' },
      { name: 'new-arrivals', searchTerm: 'new release' },
      { name: 'top-rated', searchTerm: 'best seller' }
    ];
    
    for (const collection of collections) {
      console.log(colors.yellow(`Refreshing collection: ${collection.name}`));
      const success = await collectionService.updateCollection(collection.name, collection.searchTerm);
      
      if (success) {
        console.log(colors.green(`✓ Successfully updated ${collection.name}`));
      } else {
        console.log(colors.red(`✗ Failed to update ${collection.name}`));
      }
      
      // Add a delay between collections to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    console.log(colors.green('All collections refreshed!'));
  } catch (error) {
    console.error(colors.red('Error refreshing collections:'), error);
  }
}

// Function to create a new collection
async function createCollection() {
  try {
    const { name, description, searchTerm } = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Enter collection name (e.g., "flash-deals"):',
        validate: input => input.length >= 3 || 'Collection name must be at least 3 characters'
      },
      {
        type: 'input',
        name: 'description',
        message: 'Enter collection description:',
        default: ''
      },
      {
        type: 'input',
        name: 'searchTerm',
        message: 'Enter search term to populate the collection:',
        validate: input => input.length >= 2 || 'Search term must be at least 2 characters'
      }
    ]);
    
    // Check if collection already exists
    const existingCollection = await ProductCollection.findOne({ name });
    if (existingCollection) {
      console.log(colors.yellow(`Collection "${name}" already exists. Do you want to update it?`));
      
      const { shouldUpdate } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'shouldUpdate',
          message: 'Update existing collection?',
          default: false
        }
      ]);
      
      if (!shouldUpdate) {
        console.log(colors.yellow('Operation cancelled.'));
        return;
      }
    }
    
    console.log(colors.blue(`Creating/updating collection "${name}" with search term "${searchTerm}"...`));
    const success = await collectionService.updateCollection(name, searchTerm);
    
    if (success) {
      // If it's a new collection, update the description which isn't set in updateCollection
      if (!existingCollection) {
        const collection = await ProductCollection.findOne({ name });
        if (collection && description) {
          collection.description = description;
          await collection.save();
        }
      }
      
      console.log(colors.green(`Collection "${name}" successfully created/updated!`));
    } else {
      console.log(colors.red(`Failed to create/update collection "${name}"`));
    }
  } catch (error) {
    console.error(colors.red('Error creating collection:'), error);
  }
}

// Function to view all collections
async function viewCollections() {
  try {
    console.log(colors.blue('Fetching all collections...'));
    
    const collections = await ProductCollection.find().sort('name');
    
    if (collections.length === 0) {
      console.log(colors.yellow('No collections found in the database.'));
      return;
    }
    
    console.log(colors.green(`Found ${collections.length} collections:`));
    
    collections.forEach(collection => {
      const lastUpdated = collection.lastUpdated 
        ? new Date(collection.lastUpdated).toLocaleString() 
        : 'Never';
      
      console.log(colors.cyan(`\n${collection.name}`));
      console.log(`  Description: ${collection.description || 'N/A'}`);
      console.log(`  Products: ${collection.products.length}`);
      console.log(`  Last Updated: ${lastUpdated}`);
    });
  } catch (error) {
    console.error(colors.red('Error fetching collections:'), error);
  }
}

// Function to view a specific collection
async function viewCollectionDetails() {
  try {
    // First get all collection names for the prompt
    const collections = await ProductCollection.find().select('name').sort('name');
    
    if (collections.length === 0) {
      console.log(colors.yellow('No collections found in the database.'));
      return;
    }
    
    const { collectionName } = await inquirer.prompt([
      {
        type: 'list',
        name: 'collectionName',
        message: 'Select a collection to view:',
        choices: collections.map(c => c.name)
      }
    ]);
    
    // Fetch the full collection with populated products
    const collection = await ProductCollection.findOne({ name: collectionName })
      .populate({
        path: 'products',
        select: 'title currentPrice url source currency lastUpdated'
      });
    
    if (!collection) {
      console.log(colors.red(`Collection "${collectionName}" not found.`));
      return;
    }
    
    console.log(colors.cyan(`\n${collection.name}`));
    console.log(`Description: ${collection.description || 'N/A'}`);
    console.log(`Last Updated: ${new Date(collection.lastUpdated).toLocaleString()}`);
    console.log(`Total Products: ${collection.products.length}`);
    
    if (collection.products.length > 0) {
      console.log(colors.green('\nProducts:'));
      
      collection.products.forEach((product, index) => {
        console.log(`${index + 1}. ${product.title}`);
        console.log(`   Price: ${product.currency} ${product.currentPrice}`);
        console.log(`   Source: ${product.source}`);
        console.log(`   Updated: ${new Date(product.lastUpdated).toLocaleString()}`);
      });
    }
  } catch (error) {
    console.error(colors.red('Error viewing collection details:'), error);
  }
}

// Function to delete a collection
async function deleteCollection() {
  try {
    // First get all collection names for the prompt
    const collections = await ProductCollection.find().select('name').sort('name');
    
    if (collections.length === 0) {
      console.log(colors.yellow('No collections found in the database.'));
      return;
    }
    
    const { collectionName } = await inquirer.prompt([
      {
        type: 'list',
        name: 'collectionName',
        message: 'Select a collection to delete:',
        choices: collections.map(c => c.name)
      }
    ]);
    
    const { confirmDelete } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmDelete',
        message: `Are you sure you want to delete "${collectionName}"? This cannot be undone.`,
        default: false
      }
    ]);
    
    if (!confirmDelete) {
      console.log(colors.yellow('Operation cancelled.'));
      return;
    }
    
    await ProductCollection.deleteOne({ name: collectionName });
    console.log(colors.green(`Collection "${collectionName}" successfully deleted!`));
  } catch (error) {
    console.error(colors.red('Error deleting collection:'), error);
  }
}

// Function to clean up stale products
async function cleanupStaleProducts() {
  try {
    console.log(colors.blue('Looking for stale products...'));
    
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    // Find products that haven't been updated in over a month
    const staleProducts = await Product.find({
      lastUpdated: { $lt: oneMonthAgo }
    });
    
    if (staleProducts.length === 0) {
      console.log(colors.green('No stale products found!'));
      return;
    }
    
    console.log(colors.yellow(`Found ${staleProducts.length} stale products.`));
    
    const { confirmCleanup } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmCleanup',
        message: `Do you want to clean up ${staleProducts.length} stale products?`,
        default: false
      }
    ]);
    
    if (!confirmCleanup) {
      console.log(colors.yellow('Operation cancelled.'));
      return;
    }
    
    // Get all collections to update references
    const collections = await ProductCollection.find();
    
    // Delete stale products and update collections
    for (const product of staleProducts) {
      // Remove product from all collections
      for (const collection of collections) {
        collection.products = collection.products.filter(
          prodId => prodId.toString() !== product._id.toString()
        );
        await collection.save();
      }
      
      // Delete the product
      await Product.deleteOne({ _id: product._id });
    }
    
    console.log(colors.green(`Successfully cleaned up ${staleProducts.length} stale products!`));
  } catch (error) {
    console.error(colors.red('Error cleaning up stale products:'), error);
  }
}

// Function to display database statistics
async function showDatabaseStats() {
  try {
    console.log(colors.blue('Gathering database statistics...'));
    
    const productCount = await Product.countDocuments();
    const collectionCount = await ProductCollection.countDocuments();
    const userCount = await User.countDocuments();
    
    const collections = await ProductCollection.find().select('name products');
    const collectionStats = collections.map(c => ({
      name: c.name,
      productCount: c.products.length
    }));
    
    // Get recent products
    const recentProducts = await Product.find()
      .sort({ lastUpdated: -1 })
      .limit(5)
      .select('title currentPrice source lastUpdated');
    
    console.log(colors.green('\nDatabase Statistics:'));
    console.log(colors.cyan('Summary:'));
    console.log(`Total Products: ${productCount}`);
    console.log(`Total Collections: ${collectionCount}`);
    console.log(`Total Users: ${userCount}`);
    
    console.log(colors.cyan('\nCollections:'));
    collectionStats.forEach(stat => {
      console.log(`${stat.name}: ${stat.productCount} products`);
    });
    
    console.log(colors.cyan('\nRecent Products:'));
    recentProducts.forEach(product => {
      console.log(`${product.title.substring(0, 50)}${product.title.length > 50 ? '...' : ''}`);
      console.log(`  Price: ${product.currentPrice}`);
      console.log(`  Source: ${product.source}`);
      console.log(`  Updated: ${new Date(product.lastUpdated).toLocaleString()}`);
    });
  } catch (error) {
    console.error(colors.red('Error gathering database statistics:'), error);
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
        'Refresh All Collections',
        'Create New Collection',
        'View All Collections',
        'View Collection Details',
        'Delete Collection',
        'Clean Up Stale Products',
        'Show Database Statistics',
        'Exit'
      ]
    }
  ]);
  
  switch (action) {
    case 'Refresh All Collections':
      await refreshAllCollections();
      break;
    case 'Create New Collection':
      await createCollection();
      break;
    case 'View All Collections':
      await viewCollections();
      break;
    case 'View Collection Details':
      await viewCollectionDetails();
      break;
    case 'Delete Collection':
      await deleteCollection();
      break;
    case 'Clean Up Stale Products':
      await cleanupStaleProducts();
      break;
    case 'Show Database Statistics':
      await showDatabaseStats();
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
  .description('SaleSnipe Database Manager')
  .option('-r, --refresh', 'Refresh all collections immediately')
  .option('-s, --stats', 'Show database statistics')
  .option('-c, --cleanup', 'Clean up stale products')
  .parse(process.argv);

// Main function
async function main() {
  try {
    const options = program.opts();
    
    // Connect to the database
    await connectDB();
    
    // Check for direct commands
    if (options.refresh) {
      await refreshAllCollections();
      process.exit(0);
    } else if (options.stats) {
      await showDatabaseStats();
      process.exit(0);
    } else if (options.cleanup) {
      await cleanupStaleProducts();
      process.exit(0);
    }
    
    // Show the title
    console.log(colors.green('========================='));
    console.log(colors.green('  SaleSnipe DB Manager  '));
    console.log(colors.green('========================='));
    
    // Show the main menu
    await showMainMenu();
  } catch (error) {
    console.error(colors.red('An error occurred:'), error);
    process.exit(1);
  }
}

// Start the application
main(); 