const inquirer = require('inquirer');
const axios = require('axios');
const Table = require('cli-table3');
const colors = require('colors');
const clear = require('clear');
const figlet = require('figlet');

const API_URL = 'http://localhost:3000/api';
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

// Global state
let currentCurrency = 'INR';
let supportedCurrencies = [];

// Display banner
function displayBanner() {
  clear();
  console.log(
    colors.cyan(
      figlet.textSync('SaleSnipe CLI', { horizontalLayout: 'full' })
    )
  );
  console.log(colors.yellow('Price Tracking Made Easy\n'));
}

// Sleep function for retries
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Check server connection and get supported currencies
async function checkServerConnection(retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(colors.yellow(`Attempting to connect to server (attempt ${i + 1}/${retries})...`));
      
      // First check server health
      const healthResponse = await axios.get(`${API_URL}/health`);
      
      if (healthResponse.data.status === 'OK' || healthResponse.data.status === 'ok') {
        console.log(colors.green('Successfully connected to server!'));
        console.log(colors.gray('Server Status:'));
        
        if (healthResponse.data.mongodb) {
          console.log(colors.gray('- MongoDB:', healthResponse.data.mongodb.connected ? 'Connected' : 'Disconnected'));
        }
        
        if (healthResponse.data.uptime) {
          console.log(colors.gray('- Uptime:', Math.floor(healthResponse.data.uptime), 'seconds'));
        }
        
        // After confirming server is healthy, get supported currencies
        try {
          const currencyResponse = await axios.get(`${API_URL}/products/currencies`);
          if (currencyResponse.data && currencyResponse.data.supportedCurrencies) {
            supportedCurrencies = currencyResponse.data.supportedCurrencies;
            console.log(colors.gray(`- Supported Currencies: ${supportedCurrencies.length}`));
          }
        } catch (currencyError) {
          console.log(colors.yellow('Warning: Could not fetch supported currencies'));
          // Set default currencies if we can't fetch them
          supportedCurrencies = ['USD', 'EUR', 'GBP', 'JPY'];
        }
        
        return true;
      }
    } catch (error) {
      if (i < retries - 1) {
        console.log(colors.yellow(`Connection failed. Retrying in ${RETRY_DELAY/1000} seconds...`));
        await sleep(RETRY_DELAY);
      }
    }
  }
  throw new Error('Unable to connect to the server after multiple attempts');
}

// Format price with currency
const formatPrice = (price, currency = currentCurrency) => {
  const symbols = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥'
  };
  const symbol = symbols[currency] || currency + ' ';
  return `${symbol}${price.toFixed(2)}`;
};

// Format date
const formatDate = (date) => new Date(date).toLocaleString();

// Create a table for products
function createProductTable(products, currency) {
  const table = new Table({
    head: [
      colors.cyan('#'),
      colors.cyan('Title'),
      colors.cyan('Price'),
      colors.cyan('Source'),
      colors.cyan('Last Updated')
    ],
    colWidths: [4, 50, 20, 10, 20]
  });

  products.forEach((product, index) => {
    // Format price with original currency info if available
    let priceDisplay = `${product.currentPrice} ${product.currency}`;
    if (product.originalCurrency && product.originalPrice) {
      priceDisplay += ` (${product.originalPrice} ${product.originalCurrency})`;
    }

    // Format last updated date
    const lastUpdated = new Date(product.lastUpdated);
    const formattedDate = lastUpdated.toLocaleDateString() + ' ' + lastUpdated.toLocaleTimeString();

    table.push([
      index + 1,
      product.title,
      priceDisplay,
      product.source,
      formattedDate
    ]);
  });

  return table;
}

// Create a table for price history
function createPriceHistoryTable(priceHistory, currency) {
  const table = new Table({
    head: ['Date'.cyan, 'Price'.cyan],
    colWidths: [30, 15]
  });

  priceHistory.forEach(entry => {
    table.push([
      formatDate(entry.timestamp),
      formatPrice(entry.price, currency)
    ]);
  });

  return table;
}

// Change currency
async function changeCurrency() {
  if (supportedCurrencies.length === 0) {
    console.log(colors.red('\nNo currency information available. Please check server connection.'));
    return;
  }

  const { newCurrency } = await inquirer.prompt([
    {
      type: 'list',
      name: 'newCurrency',
      message: 'Select preferred currency:',
      choices: supportedCurrencies,
      default: currentCurrency
    }
  ]);

  currentCurrency = newCurrency;
  console.log(colors.green(`\nCurrency changed to ${currentCurrency}`));
}

// Search products
async function searchProducts() {
  try {
    const { query } = await inquirer.prompt([
      {
        type: 'input',
        name: 'query',
        message: 'Enter product name to search:',
        validate: input => input.length >= 2 || 'Please enter at least 2 characters'
      }
    ]);

    console.log(colors.yellow('\nSearching for products...'));
    const response = await axios.get(`${API_URL}/products/search`, {
      params: { 
        query,
        currency: currentCurrency
      }
    });

    if (!response.data.products || response.data.products.length === 0) {
      console.log(colors.red('\nNo products found.'));
      return;
    }

    console.log(colors.green(`\nFound ${response.data.products.length} products (in ${response.data.currency}):\n`));
    console.log(createProductTable(response.data.products, response.data.currency).toString());
    console.log(colors.yellow('\nTip: You can copy the URL to visit the product page in your browser'));
    
    // Store the search results for viewing details later
    global.lastSearchResults = response.data.products;
    global.lastSearchCurrency = response.data.currency;

    // Add option to open product URL
    const { viewProduct } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'viewProduct',
        message: 'Would you like to copy a product URL to clipboard?',
        default: false
      }
    ]);

    if (viewProduct) {
      const { productIndex } = await inquirer.prompt([
        {
          type: 'list',
          name: 'productIndex',
          message: 'Select a product to copy its URL:',
          choices: response.data.products.map((product, index) => ({
            name: `${product.title} - ${formatPrice(product.currentPrice, response.data.currency)}`,
            value: index
          }))
        }
      ]);

      const selectedProduct = response.data.products[productIndex];
      console.log(colors.green('\nProduct URL:'), colors.blue(selectedProduct.url));
      console.log(colors.yellow('You can now copy this URL to your browser'));
    }

  } catch (error) {
    if (error.response) {
      console.error(colors.red('Server error:', error.response.data.message || error.message));
    } else if (error.request) {
      console.error(colors.red('Network error: Unable to reach the server'));
      console.error(colors.yellow('Please check if the server is running'));
    } else {
      console.error(colors.red('Error:', error.message));
    }
  }
}

// View price history
async function viewPriceHistory() {
  try {
    if (!global.lastSearchResults || global.lastSearchResults.length === 0) {
      console.log(colors.red('\nNo recent search results. Please search for products first.'));
      return;
    }

    const { productIndex } = await inquirer.prompt([
      {
        type: 'list',
        name: 'productIndex',
        message: 'Select a product to view price history:',
        choices: global.lastSearchResults.map((product, index) => ({
          name: `${product.title} - ${formatPrice(product.currentPrice, global.lastSearchCurrency)}`,
          value: index
        }))
      }
    ]);

    const selectedProduct = global.lastSearchResults[productIndex];
    console.log(colors.yellow('\nFetching price history...'));
    
    const response = await axios.get(`${API_URL}/products/${selectedProduct._id}/price-history`, {
      params: { currency: currentCurrency }
    });

    if (!response.data.priceHistory || response.data.priceHistory.length === 0) {
      console.log(colors.yellow('\nNo price history available for this product.'));
      return;
    }

    console.log(colors.green(`\nPrice history for ${selectedProduct.title} (in ${response.data.currency}):\n`));
    console.log(createPriceHistoryTable(response.data.priceHistory, response.data.currency).toString());

  } catch (error) {
    if (error.response) {
      console.error(colors.red('Server error:', error.response.data.message || error.message));
    } else if (error.request) {
      console.error(colors.red('Network error: Unable to reach the server'));
      console.error(colors.yellow('Please check if the server is running'));
    } else {
      console.error(colors.red('Error:', error.message));
    }
  }
}

// Main menu
async function mainMenu() {
  while (true) {
    try {
      const { choice } = await inquirer.prompt([
        {
          type: 'list',
          name: 'choice',
          message: 'What would you like to do?',
          choices: [
            { name: 'Search Products', value: 'search' },
            { name: 'View Price History', value: 'history' },
            { name: 'Change Currency', value: 'currency' },
            { name: 'Check Server Status', value: 'status' },
            { name: 'Clear Screen', value: 'clear' },
            { name: 'Exit', value: 'exit' }
          ]
        }
      ]);

      switch (choice) {
        case 'search':
          await searchProducts();
          break;
        case 'history':
          await viewPriceHistory();
          break;
        case 'currency':
          await changeCurrency();
          break;
        case 'status':
          await checkServerConnection(1);
          break;
        case 'clear':
          displayBanner();
          break;
        case 'exit':
          console.log(colors.green('\nThank you for using SaleSnipe CLI!'));
          process.exit(0);
      }

      console.log('\n'); // Add spacing between operations
    } catch (error) {
      console.error(colors.red('An error occurred:', error.message));
      await sleep(1000); // Brief pause before showing menu again
    }
  }
}

// Start the application
async function start() {
  try {
    displayBanner();
    await checkServerConnection();
    await mainMenu();
  } catch (error) {
    console.error(colors.red('\nFatal error:', error.message));
    console.error(colors.yellow('Please make sure the server is running and try again.'));
    process.exit(1);
  }
}

// Run the application
start(); 