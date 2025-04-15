/**
 * Authentication check and error handling utility
 * This file helps diagnose and fix auth-related API issues
 */

// Function to check if user is authenticated
export const checkAuthentication = async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    console.error('Authentication check failed: No token found in localStorage');
    return false;
  }
  
  return true;
};

// Function to handle API errors with detailed logging
export const handleApiError = (error, operationName) => {
  console.error(`${operationName} error:`, error);
  
  // Check for specific error types
  if (error.code === 'ECONNABORTED') {
    console.error('Connection timeout - server may be down or unresponsive');
    return 'Connection timeout. Please try again later.';
  }
  
  if (!error.response) {
    console.error('Network error - unable to reach server');
    return 'Network error. Please check your connection.';
  }
  
  // Handle specific HTTP status codes
  switch (error.response.status) {
    case 401:
      console.error('Authentication failed - invalid or expired token');
      // Clear invalid token
      localStorage.removeItem('token');
      return 'Authentication failed. Please log in again.';
    
    case 403:
      console.error('Authorization failed - insufficient permissions');
      return 'You do not have permission to perform this action.';
      
    case 404:
      console.error('Resource not found', error.response.data);
      return 'The requested resource was not found.';
      
    case 500:
      console.error('Server error', error.response.data);
      return 'Server error. Please try again later.';
      
    default:
      if (error.response.data && error.response.data.message) {
        return error.response.data.message;
      }
      return 'An unexpected error occurred. Please try again.';
  }
}; 