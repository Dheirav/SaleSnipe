require('dotenv').config();
const readline = require('readline');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const scraperService = require('../backend/services/scraperService');
const Product = require('../backend/models/Product');
const User = require('../backend/models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sale-snipe';

// Parse command line arguments
const args = process.argv.slice(2);
const cmdArgs = {};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith('--')) {
    const [key, value] = arg.substring(2).split('=');
    cmdArgs[key] = value || true;
  }
}

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Connect to MongoDB
async function connectToDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    return true;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    return false;
  }
}

// Prompt for search query
function promptForQuery() {
  return new Promise((resolve) => {
    rl.question('\nEnter product name to search (or "exit" to quit): ', (query) => {
      resolve(query);
    });
  });
}

// Prompt for website selection
function promptForWebsite() {
  return new Promise((resolve) => {
    console.log('\nSelect website to search:');
    console.log('1. Amazon');
    console.log('2. eBay');
    console.log('3. Amazon India');
    console.log('4. Flipkart');
    console.log('5. All websites');
    
    rl.question('Enter your choice (1-5): ', (choice) => {
      let website;
      switch (choice) {
        case '1':
          website = 'amazon';
          break;
        case '2':
          website = 'ebay';
          break;
        case '3':
          website = 'amazonin';
          break;
        case '4':
          website = 'flipkart';
          break;
        case '5':
        default:
          website = 'all';
          break;
      }
      resolve(website);
    });
  });
}

// Display product details
function displayProductDetails(products) {
  console.log(`\nFound ${products.length} products:`);
  
  products.forEach((product, index) => {
    console.log(`\n--- Product ${index + 1} ---`);
    console.log(`Title: ${product.title}`);
    console.log(`Price: ${product.currency} ${product.currentPrice}`);
    console.log(`Source: ${product.source}`);
    console.log(`URL: ${product.url}`);
    console.log(`Rating: ${product.rating || 'N/A'}`);
    
    if (product._id) {
      console.log(`Product ID: ${product._id}`);
    }
  });
}

// Save product to database
async function saveProductToDatabase(product) {
  try {
    // Check if product already exists
    const existingProduct = await Product.findOne({
      source: product.source,
      siteProductId: product.siteProductId
    });
    
    if (existingProduct) {
      console.log(`Product already exists in database with ID: ${existingProduct._id}`);
      
      // Update price history
      if (existingProduct.currentPrice !== product.currentPrice) {
        await existingProduct.addPriceToHistory(product.currentPrice, product.currency);
        console.log('Price history updated');
      } else {
        console.log('Price unchanged, history not updated');
      }
      
      return existingProduct;
    }
    
    // Save new product
    const newProduct = new Product(product);
    await newProduct.save();
    console.log(`New product saved to database with ID: ${newProduct._id}`);
    return newProduct;
  } catch (error) {
    console.error('Error saving product to database:', error);
    return null;
  }
}

// Prompt to save product
async function promptToSaveProduct(products) {
  if (products.length === 0) {
    return;
  }
  
  const savePromises = [];
  
  for (let i = 0; i < products.length; i++) {
    const answer = await new Promise((resolve) => {
      rl.question(`\nSave product "${products[i].title}" to database? (y/n): `, (answer) => {
        resolve(answer.toLowerCase());
      });
    });
    
    if (answer === 'y' || answer === 'yes') {
      savePromises.push(saveProductToDatabase(products[i]));
    }
  }
  
  const savedProducts = await Promise.all(savePromises);
  console.log(`\n${savedProducts.filter(Boolean).length} products saved to database`);
  return savedProducts.filter(Boolean);
}

// Check if a test user exists, create one if not
async function ensureTestUserExists() {
  try {
    const userCount = await User.countDocuments();
    
    if (userCount === 0) {
      console.log('\nNo users found in database. Creating a test user...');
      
      const testUser = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        preferences: {
          emailNotifications: true,
          desktopNotifications: true,
          currency: 'USD'
        }
      };
      
      // Hash the password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(testUser.password, salt);
      
      // Create the user
      const user = new User({
        ...testUser,
        password: hashedPassword
      });
      
      await user.save();
      console.log('\nTest user created successfully:');
      console.log('Email: test@example.com');
      console.log('Password: password123');
      console.log('\nYou can use these credentials to log in to the application.');
    }
  } catch (error) {
    console.error('Error ensuring test user exists:', error);
  }
}

// Prompt to add product to user's watchlist
async function promptToAddToWatchlist(savedProducts) {
  if (!savedProducts || savedProducts.length === 0) {
    return;
  }
  
  try {
    // Check if any users exist
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      return;
    }
    
    const answer = await new Promise((resolve) => {
      rl.question('\nWould you like to add any of these products to a test user\'s watchlist? (y/n): ', (answer) => {
        resolve(answer.toLowerCase());
      });
    });
    
    if (answer !== 'y' && answer !== 'yes') {
      return;
    }
    
    // Find the test user
    const user = await User.findOne({ email: 'test@example.com' });
    if (!user) {
      console.log('Test user not found. Skipping watchlist addition.');
      return;
    }
    
    for (const product of savedProducts) {
      const addToWatchlist = await new Promise((resolve) => {
        rl.question(`\nAdd "${product.title}" to watchlist? (y/n): `, (answer) => {
          resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
      });
      
      if (addToWatchlist) {
        await user.addToWatchlist(product._id);
        console.log(`Added to watchlist: ${product.title}`);
        
        // Ask if they want to create a price alert
        const createAlert = await new Promise((resolve) => {
          rl.question(`\nCreate a price alert for "${product.title}"? (y/n): `, (answer) => {
            resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
          });
        });
        
        if (createAlert) {
          const targetPrice = await new Promise((resolve) => {
            rl.question(`Enter target price (current price is ${product.currency} ${product.currentPrice}): `, (price) => {
              const numPrice = parseFloat(price);
              resolve(isNaN(numPrice) ? product.currentPrice * 0.9 : numPrice);
            });
          });
          
          await user.createAlert(product._id, targetPrice);
          console.log(`Created price alert at ${product.currency} ${targetPrice}`);
        }
      }
    }
    
    console.log('\nWatchlist and alerts updated successfully.');
  } catch (error) {
    console.error('\nError updating watchlist:', error);
  }
}

// Main function
async function main() {
  console.log('\n=== SaleSnipe Web Scraper Tool ===\n');
  
  // Connect to database
  const connected = await connectToDatabase();
  if (!connected) {
    console.error('Unable to connect to the database. Exiting...');
    rl.close();
    process.exit(1);
  }
  
  // If command line arguments are provided for direct testing
  if (cmdArgs.scraper && cmdArgs.query) {
    console.log(`\nRunning scraper test with direct arguments:`);
    console.log(`Scraper: ${cmdArgs.scraper}`);
    console.log(`Query: ${cmdArgs.query}`);
    console.log(`Note: Running in non-headless mode for better results\n`);
    
    try {
      let results = [];
      
      // Select the scraper based on the argument
      switch (cmdArgs.scraper.toLowerCase()) {
        case 'amazon':
          console.log('\nUsing Amazon scraper...');
          results = await scraperService.scrapers[0].searchProducts(cmdArgs.query);
          break;
        case 'ebay':
          console.log('\nUsing eBay scraper...');
          results = await scraperService.scrapers[1].searchProducts(cmdArgs.query);
          break;
        case 'flipkart':
          console.log('\nUsing Flipkart scraper...');
          results = await scraperService.scrapers[2].searchProducts(cmdArgs.query);
          break;
        case 'amazon_in':
          console.log('\nUsing Amazon India scraper...');
          results = await scraperService.scrapers[3].searchProducts(cmdArgs.query);
          break;
        case 'all':
        default:
          console.log('\nUsing all scrapers simultaneously...');
          results = await scraperService.searchAllProducts(cmdArgs.query);
          break;
      }
      
      if (results.length === 0) {
        console.log('\nNo products found. This could be due to:');
        console.log('1. Anti-bot protections on the website');
        console.log('2. Product not found with that exact query');
        console.log('3. Connection issues or IP blocking');
        console.log('\nTry running with a different query or website.');
      } else {
        console.log(`\nFound ${results.length} products!`);
        displayProductDetails(results);
        
        // Prompt to save products to database
        const savedProducts = await promptToSaveProduct(results);
        
        // If test user exists, prompt to add products to watchlist
        if (savedProducts && savedProducts.length > 0) {
          await promptToAddToWatchlist(savedProducts);
        }
      }
      
      rl.close();
    } catch (error) {
      console.error('\nError during scraping:', error.message);
      
      if (error.message.includes('CAPTCHA') || error.message.includes('Robot')) {
        console.log('\nThe website is showing a CAPTCHA or robot check.');
        console.log('This is common with headless browsers. Try:');
        console.log('1. Running with a different website');
        console.log('2. Using a VPN or different network');
        console.log('3. Waiting for a while before trying again');
      } else if (error.message.includes('timeout') || error.message.includes('navigation')) {
        console.log('\nTimeout error occurred. The website might be:');
        console.log('1. Slow to respond');
        console.log('2. Blocking automated access');
        console.log('3. Having technical issues');
      }
      
      rl.close();
    }
    return;
  }
  
  // Interactive mode
  try {
    await ensureTestUserExists();
    
    while (true) {
      const query = await promptForQuery();
      if (query === 'exit') break;
      
      const website = await promptForWebsite();
      
      console.log(`\nSearching for "${query}" on ${website === 'all' ? 'all websites' : website}...`);
      console.log('Please wait, this may take up to 30 seconds...');
      
      let results = [];
      
      switch (website) {
        case 'amazon':
          results = await scraperService.scrapers[0].searchProducts(query);
          break;
        case 'ebay':
          results = await scraperService.scrapers[1].searchProducts(query);
          break;
        case 'flipkart':
          results = await scraperService.scrapers[2].searchProducts(query);
          break;
        case 'amazonin':
          results = await scraperService.scrapers[3].searchProducts(query);
          break;
        case 'all':
        default:
          results = await scraperService.searchAllProducts(query);
          break;
      }
      
      if (results.length === 0) {
        console.log('\nNo products found. This could be due to:');
        console.log('1. Anti-bot protections on the website');
        console.log('2. Product not found with that exact query');
        console.log('3. Connection issues or IP blocking');
        console.log('\nTry a different query or website.');
        continue;
      }
      
      displayProductDetails(results);
      
      // Prompt to save products to database
      const savedProducts = await promptToSaveProduct(results);
      
      // Prompt to add to watchlist
      if (savedProducts && savedProducts.length > 0) {
        await promptToAddToWatchlist(savedProducts);
      }
    }
  } catch (error) {
    console.error('\nError:', error.message);
    
    if (error.message.includes('CAPTCHA') || error.message.includes('Robot')) {
      console.log('\nThe website is showing a CAPTCHA or robot check.');
      console.log('This is common with headless browsers. Try:');
      console.log('1. Running with a different website');
      console.log('2. Using a VPN or different network');
      console.log('3. Waiting for a while before trying again');
    }
  } finally {
    console.log('\nClosing database connection...');
    await mongoose.connection.close();
    rl.close();
  }
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  rl.close();
  process.exit(1);
}); 