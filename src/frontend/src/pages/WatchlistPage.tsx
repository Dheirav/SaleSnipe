import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import { Product, WatchlistItem } from '../types';
import toast from 'react-hot-toast';
import { useCurrency } from '../contexts/CurrencyContext';

const WatchlistPage: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [watchlistProducts, setWatchlistProducts] = useState<Product[]>([]);
  const navigate = useNavigate();
  const { formatCurrency } = useCurrency();

  useEffect(() => {
    fetchWatchlist();
  }, []);

  const fetchWatchlist = async () => {
    try {
      setLoading(true);
      const response = await apiService.watchlist.getAll();
      
      if (response.data) {
        let products = [];
        
        if (response.data.items) {
          products = response.data.items.map((item: WatchlistItem) => item.product);
        } 
        else if (response.data.watchlist) {
          products = response.data.watchlist
            .filter((item: WatchlistItem) => item.productId)
            .map((item: WatchlistItem) => item.productId);
        }
        
        setWatchlistProducts(products);
      }
    } catch (error) {
      console.error('Error fetching watchlist:', error);
      toast.error('Failed to load your watchlist');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFromWatchlist = async (productId: string) => {
    try {
      await apiService.watchlist.removeProduct(productId);
      setWatchlistProducts(watchlistProducts.filter(product => product._id !== productId));
      toast.success('Product removed from watchlist');
    } catch (error) {
      console.error('Error removing product from watchlist:', error);
      toast.error('Failed to remove product from watchlist');
    }
  };

  const handleCreateAlert = async (productId: string) => {
    try {
      const product = watchlistProducts.find(p => p._id === productId);
      if (!product) return;

      // Set alert for 10% below current price as a default
      const targetPrice = product.currentPrice * 0.9;
      await apiService.alerts.create(productId, targetPrice);
      toast.success('Price alert created successfully');
    } catch (error) {
      console.error('Error creating price alert:', error);
      toast.error('Failed to create price alert');
    }
  };

  const handleViewDetails = (productId: string) => {
    navigate(`/product/${productId}`);
  };

  // Get product currency based on source
  const getProductCurrency = (product: Product): string => {
    if (product.currency && typeof product.currency === 'string') return product.currency;
    
    if (product.source === 'amazon_in' || product.source === 'flipkart') {
      return 'INR';
    } else if (product.source === 'amazon_uk') {
      return 'GBP';
    } else if (product.source === 'amazon_de' || product.source === 'amazon_fr') {
      return 'EUR';
    }
    
    return 'USD';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-64px)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (watchlistProducts.length === 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Your Watchlist</h1>
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <h2 className="text-xl mb-4">Your watchlist is empty</h2>
          <p className="text-gray-600 mb-6">Start by searching for products to track their prices</p>
          <button 
            onClick={() => navigate('/search')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            Search Products
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Your Watchlist</h1>
      
      <div className="grid grid-cols-1 gap-6">
        {watchlistProducts.map(product => (
          <div key={product._id} className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-6">
              <div className="flex flex-col md:flex-row justify-between">
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900 mb-2">{product.title}</h2>
                  <p className="text-gray-500 mb-2">From {product.source}</p>
                  {product.rating !== undefined && (
                    <div className="flex items-center mb-2">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <svg 
                            key={i}
                            className={`w-4 h-4 ${i < Math.round(product.rating || 0) ? 'text-yellow-400' : 'text-gray-300'}`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                      <span className="text-gray-600 ml-2">
                        {product.rating !== undefined ? product.rating.toFixed(1) : '0.0'}
                        {product.reviewCount && <span className="text-gray-400 text-sm"> ({product.reviewCount} reviews)</span>}
                      </span>
                    </div>
                  )}
                </div>
                <div className="mt-4 md:mt-0 text-right">
                  <p className="text-sm text-gray-500">Current Price</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(product.currentPrice, getProductCurrency(product))}
                  </p>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2 mt-6">
                <button
                  onClick={() => handleViewDetails(product._id)} 
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                >
                  View Details
                </button>
                <button
                  onClick={() => handleCreateAlert(product._id)}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
                >
                  Create Alert
                </button>
                <button
                  onClick={() => handleRemoveFromWatchlist(product._id)}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                >
                  Remove
                </button>
                <a 
                  href={product.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition"
                >
                  View on {product.source}
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WatchlistPage; 