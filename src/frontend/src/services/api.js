import axios from 'axios';
import config from '../config';
import { debugLogRequest, debugLogResponse, debugLogError } from '../utils/debug';

// Get API URL from config or environment variable - ensure it has the correct format
const API_URL = (config?.api?.baseURL || process.env.REACT_APP_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');

// Log API URL for debugging
console.log('API Configuration:', {
  baseURL: API_URL,
  configURL: config?.api?.baseURL,
  envURL: process.env.REACT_APP_API_URL
});

// Create an axios instance with properly configured base URL
const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Add a request interceptor for authentication
api.interceptors.request.use(
  (config) => {
    // Log the request
    debugLogRequest(config.method.toUpperCase(), config.url, config.data);
    
    // Add auth token if available
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    debugLogError('REQUEST', 'Failed to send request', error);
    return Promise.reject(error);
  }
);

// Add response interceptor to log errors
api.interceptors.response.use(
  (response) => {
    // Log the successful response
    debugLogResponse(response.config.method.toUpperCase(), response.config.url, response.data);
    return response;
  },
  (error) => {
    // Log the error response
    if (error.response) {
      debugLogError(
        error.config?.method?.toUpperCase() || 'UNKNOWN', 
        error.config?.url || 'UNKNOWN', 
        error
      );
    } else if (error.request) {
      console.error('API Request Error (No Response):', error.request);
    } else {
      console.error('API Error:', error.message);
    }
    return Promise.reject(error);
  }
);

// Utility function for making direct fetch requests as a fallback
const directFetch = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers || {})
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return response.json();
};

const apiService = {
  // Auth endpoints
  auth: {
    register: (userData) => {
      console.log('Registering user with data:', userData);
      return api.post('/auth/register', userData);
    },
    login: (credentials) => api.post('/auth/login', credentials),
    getCurrentUser: () => api.get('/auth/me'),
    updateProfile: (userData) => api.put('/auth/me', userData)
  },
  
  // Product endpoints
  products: {
    search: async (query) => {
      // Validate query
      if (!query || typeof query !== 'string' || query.trim() === '') {
        return Promise.reject(new Error('Search query cannot be empty'));
      }
      
      console.log(`Searching for products with query: "${query}"`);
      const searchUrl = `${API_URL}/products/search?query=${encodeURIComponent(query.trim())}`;
      console.log(`Using API endpoint: ${searchUrl}`);
      
      try {
        // Try the axios instance first
        return await api.get('/products/search', {
          params: { query: query.trim() },
          timeout: 15000
        });
      } catch (axiosError) {
        console.warn('Axios search failed, falling back to fetch:', axiosError.message);
        
        // If that fails, try a direct fetch as fallback
        try {
          const data = await directFetch(searchUrl);
          console.log('Fetch search succeeded with data:', data);
          
          // Format the response to match axios format
          return { 
            data,
            status: 200,
            statusText: 'OK'
          };
        } catch (fetchError) {
          console.error('Both axios and fetch failed:', fetchError);
          throw fetchError; 
        }
      }
    },
    getById: (id) => api.get(`/products/${id}`),
    getPriceHistory: (id) => api.get(`/products/${id}/price-history`),
    getSupportedCurrencies: () => api.get('/products/currencies')
  },
  
  // Watchlist endpoints
  watchlist: {
    getAll: () => api.get('/watchlist'),
    addProduct: (productId) => api.post('/watchlist', { productId }),
    removeProduct: (productId) => api.delete(`/watchlist/${productId}`),
    getStats: () => api.get('/watchlist/stats')
  },
  
  // Alerts endpoints
  alerts: {
    getAll: () => api.get('/alerts'),
    create: (productId, targetPrice) => api.post('/alerts', { productId, targetPrice }),
    update: (alertId, data) => api.put(`/alerts/${alertId}`, data),
    delete: (alertId) => api.delete(`/alerts/${alertId}`)
  },
  
  // Collections endpoints
  collections: {
    getAll: () => api.get('/collections'),
    getByName: (name, limit) => api.get(`/collections/${name}`, { params: { limit } }),
    refresh: (name, searchTerm) => api.post(`/collections/${name}/refresh`, { searchTerm })
  }
};

export default apiService; 