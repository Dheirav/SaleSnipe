/**
 * Logger utility for consistent logging across the application
 * This makes debugging easier by adding timestamps and color coding
 */
const logger = {
  info: (message, ...args) => {
    console.log(`[INFO ${new Date().toISOString()}]`, message, ...args);
  },
  
  debug: (message, ...args) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEBUG ${new Date().toISOString()}]`, message, ...args);
    }
  },
  
  warn: (message, ...args) => {
    console.warn(`[WARN ${new Date().toISOString()}]`, message, ...args);
  },
  
  error: (message, error) => {
    console.error(`[ERROR ${new Date().toISOString()}]`, message);
    
    if (error) {
      // Log additional error details for easier debugging
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      } else if (error.request) {
        console.error('Request was made but no response received');
      } else {
        console.error('Error details:', error.message);
      }
      console.error('Full error:', error);
    }
  }
};

export default logger; 