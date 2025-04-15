/**
 * Debug utilities to help troubleshoot issues
 */

// Set to true to enable debug logging
const DEBUG_ENABLED = true;

/**
 * Log a debug message to the console
 * @param {string} area - The area of the application (e.g., 'auth', 'api')
 * @param {string} message - The message to log
 * @param {any} data - Optional data to log
 */
export const debugLog = (area, message, data) => {
  if (!DEBUG_ENABLED) return;
  
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${area.toUpperCase()}]`;
  
  console.log(`${prefix} ${message}`);
  if (data !== undefined) {
    console.log(`${prefix} Data:`, data);
  }
};

/**
 * Log an API request
 * @param {string} method - The HTTP method
 * @param {string} url - The URL
 * @param {any} data - The request data
 */
export const debugLogRequest = (method, url, data) => {
  debugLog('api', `Request: ${method} ${url}`, data);
};

/**
 * Log an API response
 * @param {string} method - The HTTP method
 * @param {string} url - The URL
 * @param {any} response - The response data
 */
export const debugLogResponse = (method, url, response) => {
  debugLog('api', `Response: ${method} ${url}`, response);
};

/**
 * Log an API error
 * @param {string} method - The HTTP method
 * @param {string} url - The URL
 * @param {Error} error - The error
 */
export const debugLogError = (method, url, error) => {
  debugLog('api', `Error: ${method} ${url}`, {
    message: error.message,
    response: error.response?.data,
    status: error.response?.status
  });
};

export default {
  debugLog,
  debugLogRequest,
  debugLogResponse,
  debugLogError
}; 