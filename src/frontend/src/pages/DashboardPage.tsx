import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';
import apiService from '../services/api';
import { Product, PriceHistoryEntry, PricePrediction, WatchlistItem } from '../types';
import PriceChart from '../components/PriceTrends/PriceChart';
import toast from 'react-hot-toast';

const DashboardPage: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [productDetailsLoading, setProductDetailsLoading] = useState<boolean>(false);
  const [watchlistProducts, setWatchlistProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([]);
  const [predictions, setPredictions] = useState<PricePrediction | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();

  useEffect(() => {
    fetchWatchlist();
  }, []);

  const fetchWatchlist = async () => {
    try {
      setLoading(true);
      const response = await apiService.watchlist.getAll();
      
      // Check for both response formats to ensure backward compatibility
      if (response.data) {
        let products = [];
        
        // Handle response when 'items' is used
        if (response.data.items) {
          products = response.data.items
            .filter((item: WatchlistItem) => item.product) // Make sure product exists
            .map((item: WatchlistItem) => item.product);
        } 
        // Handle response when 'watchlist' is used (from backend)
        else if (response.data.watchlist) {
          products = response.data.watchlist
            .filter((item: WatchlistItem) => item.productId) // Filter out any items without productId
            .map((item: WatchlistItem) => item.productId); // Extract product data
        }
        
        setWatchlistProducts(products);
        
        // If products exist, select the first one by default
        if (products.length > 0) {
          setSelectedProduct(products[0]);
          fetchProductDetails(products[0]._id);
        }
      }
    } catch (error) {
      console.error('Error fetching watchlist:', error);
      toast.error('Failed to load your watchlist');
    } finally {
      setLoading(false);
    }
  };

  const fetchProductDetails = async (productId: string) => {
    try {
      setProductDetailsLoading(true);
      
      // Fetch price history
      try {
        const historyResponse = await apiService.products.getPriceHistory(productId);
        if (historyResponse.data && historyResponse.data.priceHistory) {
          setPriceHistory(historyResponse.data.priceHistory);
        } else {
          // Clear price history if no data available for the new product
          setPriceHistory([]);
        }
      } catch (error) {
        console.error('Error fetching price history:', error);
        setPriceHistory([]);
      }

      // Fetch price predictions
      try {
        const predictionsResponse = await apiService.ai.getPricePredictions(productId);
        if (predictionsResponse.data && predictionsResponse.data.predictions) {
          // Format the response to match our expected type
          setPredictions({
            lastPrediction: new Date().toISOString(),
            predictions: predictionsResponse.data.predictions.map((p: any) => ({
              date: typeof p.date === 'string' ? p.date : new Date(p.date).toISOString(),
              price: p.price,
              currency: predictionsResponse.data.currency || 'USD'
            })),
            accuracy: predictionsResponse.data.accuracy || 0.75 // Default accuracy if not provided
          });
        } else {
          // Clear predictions if no data available
          setPredictions(null);
        }
      } catch (error) {
        // Don't show toast error for insufficient price history - this is normal for new products
        if (error instanceof Error && 
            error.message.includes('Insufficient price history data')) {
          console.log('Info: Insufficient price history data for prediction');
        } else {
          console.error('Error fetching price predictions:', error);
        }
        setPredictions(null);
      }
    } catch (error) {
      console.error('Error fetching product details:', error);
      toast.error('Failed to load product details');
    } finally {
      setProductDetailsLoading(false);
    }
  };

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    fetchProductDetails(product._id);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
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
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
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

  const priceChartData = priceHistory.map(entry => ({
    date: formatDate(entry.date),
    price: entry.price
  }));

  const predictionChartData = predictions?.predictions.map(pred => ({
    date: formatDate(pred.date),
    price: pred.price
  })) || [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Watchlist Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-md p-4">
            <h2 className="text-xl font-semibold mb-4">Your Watchlist</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {watchlistProducts.map(product => (
                <div 
                  key={product._id}
                  onClick={() => handleProductSelect(product)}
                  className={`p-3 rounded cursor-pointer transition ${
                    selectedProduct?._id === product._id 
                      ? 'bg-blue-100 border-l-4 border-blue-500' 
                      : 'hover:bg-gray-100'
                  }`}
                >
                  <h3 className="font-medium text-gray-900 truncate">{product.title}</h3>
                  <p className="text-sm text-gray-500">
                    {formatCurrency(product.currentPrice, getProductCurrency(product))}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {selectedProduct && (
            <>
              {/* Product Header */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold">{selectedProduct.title}</h2>
                    <p className="text-gray-500">From {selectedProduct.source || 'Unknown'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Current Price</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(
                        selectedProduct.currentPrice,
                        getProductCurrency(selectedProduct)
                      )}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <a 
                    href={selectedProduct.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    View on {selectedProduct.source || 'Website'}
                  </a>
                </div>
              </div>
              
              {/* Price History Chart */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">Price History</h2>
                {productDetailsLoading ? (
                  <div className="flex justify-center items-center h-48">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                  </div>
                ) : priceHistory.length > 0 ? (
                  <PriceChart priceData={priceChartData} />
                ) : (
                  <p className="text-gray-500 text-center py-8">No price history available yet</p>
                )}
              </div>
              
              {/* Price Predictions */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">Price Predictions</h2>
                {productDetailsLoading ? (
                  <div className="flex justify-center items-center h-48">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                  </div>
                ) : predictions && predictionChartData.length > 0 ? (
                  <>
                    <PriceChart priceData={predictionChartData} />
                    <p className="text-sm text-gray-500 mt-2">
                      Prediction accuracy: {(predictions.accuracy * 100).toFixed(1)}%
                    </p>
                  </>
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    No price predictions available yet. More price history data is needed.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage; 