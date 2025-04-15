// API configuration
const DEFAULT_BACKEND_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

// Extract the base API URL (without /api)
const getBaseUrl = (url) => {
  return url.endsWith('/api') ? url.slice(0, -4) : url;
};

// Function to sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Function to check server health with retries
async function checkServerHealth(retries = MAX_RETRIES) {
  console.log(`Attempting to connect to backend server...`);
  const apiUrl = DEFAULT_BACKEND_URL;
  const baseUrl = getBaseUrl(apiUrl);
  
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Connection attempt ${i + 1}/${retries}...`);
      
      const response = await fetch(`${baseUrl}/api/health`, { 
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000) // Increased timeout for reliability
      });
      
      if (response.ok) {
        // Get the data to check MongoDB connection status
        const data = await response.json();
        console.log(`Backend server connection successful!`);
        
        if (data.mongodb && data.mongodb.connected) {
          console.log(`MongoDB connection is established`);
        } else {
          console.warn(`Warning: MongoDB connection may not be established`);
        }
        
        return apiUrl;
      }
    } catch (error) {
      console.log(`Connection attempt failed: ${error.message || error.name}`);
      if (i < retries - 1) {
        console.log(`Retrying in ${RETRY_DELAY/1000} seconds...`);
        await sleep(RETRY_DELAY);
      }
    }
  }
  
  console.warn(`Could not connect to backend server after ${retries} attempts. Using default URL ${DEFAULT_BACKEND_URL}`);
  return DEFAULT_BACKEND_URL;
}

// Initially use the default API URL
let apiBaseUrl = DEFAULT_BACKEND_URL;

// Try to check server health on load
checkServerHealth().then(url => {
  apiBaseUrl = url;
  console.log(`API base URL set to ${apiBaseUrl}`);
}).catch(err => {
  console.error('Error connecting to backend server:', err);
});

const apiConfig = {
  get baseURL() {
    return apiBaseUrl;
  },
  timeout: 60000, // Increased timeout
  headers: {
    'Content-Type': 'application/json'
  }
};

// Log configuration in development mode
if (process.env.NODE_ENV === 'development') {
  console.log('API Configuration:', apiConfig.baseURL);
}

export default {
  api: apiConfig,
  appName: 'SaleSnipe',
  currency: 'USD'
}; 