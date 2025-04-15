/**
 * Port finder script for Windows systems
 * This script finds an available port starting from a default port
 * Usage: node find-port.js [startPort]
 */

const net = require('net');

// Use the first argument as the starting port, or default to 3001
const startPort = parseInt(process.argv[2]) || 3001;

// Check if a port is in use
function isPortInUse(port) {
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

// Find an available port
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
  return 4000 + Math.floor(Math.random() * 1000);
}

// Execute the port finder and output the result
findAvailablePort(startPort)
  .then(port => {
    // Print only the port number so it can be captured by scripts
    console.log(port);
  })
  .catch(err => {
    console.error('Error finding available port:', err);
    // Output the starting port as fallback
    console.log(startPort);
  }); 