require('dotenv').config();
const express = require('express');
const cors = require('cors');
const net = require('net');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const productRoutes = require('./routes/productRoutes');
const authRoutes = require('./routes/authRoutes');
const alertRoutes = require('./routes/alertRoutes');
const aiRoutes = require('./routes/aiRoutes');
const watchlistRoutes = require('./routes/watchlistRoutes');
const collectionRoutes = require('./routes/collectionRoutes');
const cronService = require('./services/cronService');
const collectionService = require('./services/collectionService');
const WebSocket = require('ws');

const app = express();

// Connect to MongoDB
console.log('Starting application...');
console.log('MongoDB Connection Info:');
console.log('- Database Name: sale-snipe');
connectDB();

// Enable CORS - important for frontend
app.use(cors({
  // Allow any origin on localhost or accept requests from specific domains in production
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS?.split(',') || ['https://salesnipe.com']
    : true, // In development, accept all origins
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Handle favicon requests to prevent 404 errors
app.get('/favicon.ico', (req, res) => {
  // Return a 204 No Content response
  res.status(204).end();
});

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Don't log bodies for large requests or health checks
  if (req.url !== '/api/health' && req.method !== 'GET') {
    console.log('Request Body:', req.body);
  }
  
  if (Object.keys(req.query).length > 0) {
    console.log('Query Parameters:', req.query);
  }

  // Log response details after request is completed
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
  });

  next();
});

// Health check endpoint - MUST be before the /api routes
app.get('/api/health', (req, res) => {
  // Check MongoDB connection state
  const mongoState = mongoose.connection.readyState;
  const mongoConnected = mongoState === 1;
  const mongoStatus = {
    connected: mongoConnected,
    state: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoState] || 'unknown',
    database: mongoose.connection.name || 'none'
  };
  
  const status = {
    status: mongoConnected ? 'OK' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: mongoStatus,
    memory: process.memoryUsage(),
    env: process.env.NODE_ENV || 'development'
  };
  
  const statusCode = mongoConnected ? 200 : 503;
  res.status(statusCode).json(status);
});

// API Routes
app.use('/api/products', productRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/collections', collectionRoutes);

// WebSocket route handler - Add this before the 404 handler
app.get('/ws', (req, res) => {
  // This is just a placeholder endpoint for WebSocket connection
  // The actual WebSocket connection is handled by the WebSocket.Server
  // This prevents the 404 error for /ws GET requests
  res.status(200).send('WebSocket endpoint is available. Connect using WebSocket protocol.');
});

// 404 handler
app.use((req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.url}`);
  res.status(404).json({ 
    message: 'Route not found',
    path: req.url,
    method: req.method
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  console.error('Error details:', {
    name: err.name,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.url,
    method: req.method
  });

  res.status(err.status || 500).json({
    message: 'Something went wrong!',
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Check if a port is in use
async function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    
    server.listen(port);
  });
}

// Function to find an available port
async function findAvailablePort(startPort, maxAttempts = 10) {
  let port = startPort;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    if (!(await isPortInUse(port))) {
      return port;
    }
    port++;
    attempts++;
  }
  
  // If we've tried too many times, just return a random port in a different range
  return 8000 + Math.floor(Math.random() * 1000);
}

// Start the server
async function startServer() {
  // Use port 3000 whenever possible for consistency with the CLI
  const defaultPort = parseInt(process.env.PORT) || 3000;
  const PORT = await findAvailablePort(defaultPort);
  
  // Update the PORT in process.env so other parts of the app can use it
  process.env.PORT = PORT.toString();
  
  const server = app.listen(PORT, () => {
    console.log(`Server Details:`);
    console.log(`- Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`- Port: ${PORT}${PORT !== defaultPort ? ' (default port was in use)' : ''}`);
    console.log(`- URL: http://localhost:${PORT}`);
    console.log(`- Process ID: ${process.pid}`);
    console.log(`- Node Version: ${process.version}`);
    console.log(`- Memory Usage: ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`);
    console.log(`- Database: ${mongoose.connection.name || 'not connected'}`);
    
    // Initialize cron jobs
    cronService.initializeJobs();

    // Initialize product collections
    initializeCollections();
  });
  
  // Create WebSocket server
  const wss = new WebSocket.Server({ 
    server,
    path: '/ws'  // This specifies the endpoint path for WebSocket connections
  });
  
  // WebSocket connection handler
  wss.on('connection', function connection(ws, req) {
    console.log(`WebSocket client connected from ${req.socket.remoteAddress}`);
    
    // Handle incoming messages
    ws.on('message', function incoming(message) {
      try {
        const data = JSON.parse(message);
        console.log('Received WebSocket message:', data);
        
        // Handle different message types
        switch(data.type) {
          case 'ping':
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            break;
          case 'subscribe':
            // Subscribe to updates for specific products, alerts, etc.
            console.log(`Client subscribed to: ${data.topic}`);
            ws.topic = data.topic;
            ws.send(JSON.stringify({ 
              type: 'subscribed', 
              topic: data.topic,
              message: `Subscribed to ${data.topic} updates`
            }));
            break;
          default:
            ws.send(JSON.stringify({ 
              type: 'error', 
              message: 'Unknown message type' 
            }));
        }
      } catch (err) {
        console.error('Error processing WebSocket message:', err);
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Invalid message format' 
        }));
      }
    });
    
    // Send a welcome message
    ws.send(JSON.stringify({ 
      type: 'info', 
      message: 'Connected to SaleSnipe WebSocket server',
      timestamp: Date.now()
    }));
    
    // Handle errors
    ws.on('error', function error(err) {
      console.error('WebSocket error:', err);
    });
    
    // Handle disconnection
    ws.on('close', function close() {
      console.log('WebSocket client disconnected');
    });
  });
  
  // Handle WebSocket server errors
  wss.on('error', function error(err) {
    console.error('WebSocket server error:', err);
  });
  
  // Add the WebSocket server to the app for use in other parts
  app.set('wss', wss);
  
  // WebSocket broadcast utility - allows other parts of the app to send messages
  app.set('sendToAllClients', (data) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  });
  
  // WebSocket topic broadcast utility - sends messages to clients subscribed to a specific topic
  app.set('sendToTopic', (topic, data) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && client.topic === topic) {
        client.send(JSON.stringify(data));
      }
    });
  });
  
  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM signal. Starting graceful shutdown...');
    
    // Stop all cron jobs
    cronService.stopAllJobs();
    
    // Close WebSocket server
    wss.close(() => {
      console.log('WebSocket server closed.');
    });
    
    server.close(() => {
      console.log('Server closed. Exiting process...');
      process.exit(0);
    });
  });
  
  return server;
}

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  console.error('Stack trace:', err.stack);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection:', reason);
  console.error('Promise:', promise);
});

// Initialize product collections
const initializeCollections = async () => {
  console.log('Initializing product collections...');
  
  const initialCollections = [
    { name: 'trending', searchTerm: 'trending' },
    { name: 'discount-deals', searchTerm: 'discount deals' },
    { name: 'new-arrivals', searchTerm: 'new release' },
    { name: 'top-rated', searchTerm: 'best seller' }
  ];
  
  for (const collection of initialCollections) {
    const isStale = await collectionService.isCollectionStale(collection.name, 24);
    if (isStale) {
      console.log(`Initializing collection: ${collection.name}`);
      setTimeout(async () => {
        await collectionService.updateCollection(collection.name, collection.searchTerm);
      }, 5000); // Delay to allow server to fully start
    } else {
      console.log(`Collection ${collection.name} is up to date`);
    }
  }
};

// Call the initialize function
initializeCollections().catch(err => {
  console.error('Error initializing collections:', err);
});

// Start the server
startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
}); 