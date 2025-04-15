const { createProxyMiddleware } = require('http-proxy-middleware');
const http = require('http');

// Define constants for backend connection
const DEFAULT_BACKEND_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

// Remove /api suffix if present
const getBaseUrl = (url) => {
  return url.endsWith('/api') ? url.slice(0, -4) : url;
};

// Get the base URL for API connections
const API_URL = getBaseUrl(DEFAULT_BACKEND_URL);

module.exports = function(app) {
  // Handle favicon.ico requests
  app.get('/favicon.ico', (req, res) => {
    res.status(204).end();
  });

  // Simple health check for the backend API
  const checkBackendHealth = () => {
    return new Promise((resolve) => {
      console.log(`Checking backend health at ${API_URL}/api/health...`);
      const req = http.get(`${API_URL}/api/health`, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              const healthData = JSON.parse(data);
              console.log(`Backend server is healthy: MongoDB connected = ${healthData.mongodb?.connected || false}`);
              resolve(true);
            } else {
              console.log(`Backend server returned status ${res.statusCode}`);
              resolve(false);
            }
          } catch (error) {
            console.error(`Error parsing health response: ${error.message}`);
            resolve(false);
          }
        });
      });
      
      req.on('error', (error) => {
        console.error(`Backend health check failed: ${error.message}`);
        resolve(false);
      });
      
      req.setTimeout(3000, () => {
        req.abort();
        console.error('Backend health check timed out');
        resolve(false);
      });
    });
  };

  // Set up proxy to the backend
  const setupBackendProxy = () => {
    console.log(`Setting up proxy to backend at ${API_URL}`);
    
    app.use(
      '/api',
      createProxyMiddleware({
        target: API_URL,
        changeOrigin: true,
        onProxyReq: (proxyReq, req, res) => {
          proxyReq.on('error', (err) => {
            console.error(`Proxy request error: ${err.message}`);
          });
        },
        onError: (err, req, res) => {
          console.error(`Proxy error: ${err.message}`);
          res.status(500).json({ 
            message: 'Error connecting to backend server',
            error: err.message
          });
        },
        logLevel: 'warn'
      })
    );
  };

  // Initialize the proxy
  const initializeProxy = async () => {
    try {
      // Always set up the proxy, regardless of health check
      // This allows the frontend to work even if the backend starts later
      setupBackendProxy();
      
      // Run health check but don't wait for it
      checkBackendHealth().then(isHealthy => {
        if (isHealthy) {
          console.log('Backend connection confirmed, proxy is ready');
        } else {
          console.warn('Backend connection not established, proxy will attempt to connect when backend is available');
        }
      });
    } catch (error) {
      console.error(`Error setting up proxy: ${error.message}`);
    }
  };

  // Start the proxy setup
  initializeProxy();
}; 