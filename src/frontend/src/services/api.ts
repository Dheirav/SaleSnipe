import axios from 'axios';
import config from '../config';

// Create axios instance with configuration
const api = axios.create({
  baseURL: config.api.baseURL,
  timeout: config.api.timeout,
  headers: config.api.headers
});

// Add a request interceptor for authentication
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor for handling errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Check if error is due to connection issues
    if (error.code === 'ECONNABORTED' || !error.response) {
      console.error('Backend connection error:', error.message || 'Connection failed');
      
      // You could implement a custom notification here
      // Example: store.dispatch(setNotification({ type: 'error', message: 'Server connection lost' }));
    }
    
    // Log authentication errors
    if (error.response && error.response.status === 401) {
      console.error('Authentication error:', error.response.data?.message || 'Unauthorized');
      
      // Check if we're not already on the login page before redirecting
      const isLoginPage = window.location.pathname.includes('/login');
      if (!isLoginPage) {
        console.log('Auth token invalid, clearing token');
        localStorage.removeItem('token');
        
        // You could also redirect to login or dispatch a logout action here
        // Example: window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
      }
    }
    
    return Promise.reject(error);
  }
);

// Type for Axios errors
interface AxiosErrorWithResponse extends Error {
  response?: any;
}

// Retry mechanism for failed requests
const withRetry = <T extends (...args: any[]) => Promise<any>>(
  apiCall: T,
  maxRetries = 3, // Increased retries
  delay = 1000
): ((...args: Parameters<T>) => Promise<ReturnType<T>>) => {
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    let lastError: AxiosErrorWithResponse;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await apiCall(...args);
      } catch (err) {
        const error = err as AxiosErrorWithResponse;
        // Don't retry auth errors or server errors that are not network related
        if ((error.response && error.response.status !== 0) || attempt === maxRetries) {
          throw error;
        }
        
        console.log(`Retrying API call, attempt ${attempt + 1} of ${maxRetries}`);
        lastError = error;
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1))); // Exponential backoff
      }
    }
    throw lastError!;
  };
};

// API service functions
const apiService = {
  // Auth endpoints
  auth: {
    register: withRetry((userData: { name: string; email: string; password: string }) => 
      api.post('/auth/register', userData)),
    
    login: withRetry((credentials: { email: string; password: string }) => 
      api.post('/auth/login', credentials)),
    
    getCurrentUser: withRetry(() => 
      api.get('/auth/me')),
    
    updateProfile: withRetry((userData: { name?: string; email?: string; preferences?: any }) => 
      api.put('/auth/me', userData))
  },
  
  // Product endpoints
  products: {
    search: withRetry((query: string) => 
      api.get('/products/search', { 
        params: { 
          query: query.trim() 
        } 
      })),
    
    getById: withRetry((id: string) => 
      api.get(`/products/${id}`)),
    
    getPriceHistory: withRetry((id: string) => 
      api.get(`/products/${id}/price-history`)),
    
    getSupportedCurrencies: withRetry(() => 
      api.get('/products/currencies'))
  },
  
  // Watchlist endpoints
  watchlist: {
    getAll: withRetry(() => 
      api.get('/watchlist')),
    
    addProduct: withRetry((productId: string) => 
      api.post('/watchlist', { productId })),
    
    removeProduct: withRetry((productId: string) => 
      api.delete(`/watchlist/${productId}`)),
    
    getStats: withRetry(() => 
      api.get('/watchlist/stats'))
  },
  
  // Alerts endpoints
  alerts: {
    getAll: withRetry(() => 
      api.get('/alerts')),
    
    create: withRetry((productId: string, targetPrice: number) => 
      api.post('/alerts', { productId, targetPrice })),
    
    update: withRetry((alertId: string, data: { targetPrice?: number, active?: boolean }) => 
      api.put(`/alerts/${alertId}`, data)),
    
    delete: withRetry((alertId: string) => 
      api.delete(`/alerts/${alertId}`))
  },
  
  // AI endpoints
  ai: {
    getPricePredictions: withRetry((productId: string) => 
      api.get(`/ai/predictions/${productId}`)),
    
    getSentimentAnalysis: withRetry((productId: string) => 
      api.get(`/ai/sentiment/${productId}`))
  },
  
  // Notifications endpoints
  notifications: {
    getAll: withRetry(() => 
      api.get('/notifications')),
    
    markAsRead: withRetry((notificationId: string) => 
      api.put(`/notifications/${notificationId}/read`)),
    
    markAllAsRead: withRetry(() => 
      api.put('/notifications/read-all'))
  },
  
  // Collections endpoints
  collections: {
    getAll: withRetry(() => 
      api.get('/collections')),
    
    getByName: withRetry((name: string, limit?: number) => 
      api.get(`/collections/${name}`, { params: { limit } })),
    
    refresh: withRetry((name: string, searchTerm: string) => 
      api.post(`/collections/${name}/refresh`, { searchTerm }))
  }
};

export default apiService; 