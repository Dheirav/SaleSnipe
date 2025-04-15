import React, { useState, useEffect } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import { Product, PriceHistoryEntry, PricePrediction, SentimentAnalysis, WatchlistItem, PriceAlert } from '../types';
import PriceChart from '../components/PriceTrends/PriceChart';
import toast from 'react-hot-toast';
import { checkAuthentication, handleApiError } from '../services/authCheck';
import { useCurrency } from '../contexts/CurrencyContext';

const ProductPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { formatCurrency } = useCurrency();
  const [loading, setLoading] = useState<boolean>(true);
  const [product, setProduct] = useState<Product | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([]);
  const [predictions, setPredictions] = useState<PricePrediction | null>(null);
  const [sentimentAnalysis, setSentimentAnalysis] = useState<SentimentAnalysis | null>(null);
  const [inWatchlist, setInWatchlist] = useState<boolean>(false);
  const [hasAlert, setHasAlert] = useState<boolean>(false);
  const [alertPrice, setAlertPrice] = useState<number>(0);

  // Get the previous location from state passed via Link
  const previousPage = location.state?.from || '/search';
  const previousSearch = location.state?.search || '';

  const handleGoBack = () => {
    // Navigate back to the previous page with search params intact
    navigate(`${previousPage}${previousSearch}`);
  };

  useEffect(() => {
    if (id) {
      fetchProductDetails(id);
    }
  }, [id]);

  const fetchProductDetails = async (productId: string) => {
    try {
      setLoading(true);
      
      // Fetch product details
      const productResponse = await apiService.products.getById(productId);
      if (productResponse.data && productResponse.data.product) {
        setProduct(productResponse.data.product);
        setAlertPrice(productResponse.data.product.currentPrice * 0.9); // Set default alert price at 10% below current
      }

      // Fetch price history
      const historyResponse = await apiService.products.getPriceHistory(productId);
      if (historyResponse.data && historyResponse.data.priceHistory) {
        setPriceHistory(historyResponse.data.priceHistory);
      }

      // Check if in watchlist
      const watchlistResponse = await apiService.watchlist.getAll();
      if (watchlistResponse.data && watchlistResponse.data.items) {
        const isInWatchlist = watchlistResponse.data.items.some(
          (item: WatchlistItem) => item.productId === productId
        );
        setInWatchlist(isInWatchlist);
      }

      // Check if has alert
      const alertsResponse = await apiService.alerts.getAll();
      if (alertsResponse.data && alertsResponse.data.alerts) {
        const productAlert = alertsResponse.data.alerts.find(
          (alert: PriceAlert) => alert.productId === productId && alert.active
        );
        setHasAlert(!!productAlert);
        if (productAlert) {
          setAlertPrice(productAlert.targetPrice);
        }
      }

      // Fetch price predictions
      try {
        const predictionsResponse = await apiService.ai.getPricePredictions(productId);
        if (predictionsResponse.data) {
          setPredictions(predictionsResponse.data);
        }
      } catch (error) {
        console.error('Error fetching price predictions:', error);
        // Don't show error toast since predictions are optional
      }

      // Fetch sentiment analysis
      try {
        const sentimentResponse = await apiService.ai.getSentimentAnalysis(productId);
        if (sentimentResponse.data) {
          setSentimentAnalysis(sentimentResponse.data);
        }
      } catch (error) {
        console.error('Error fetching sentiment analysis:', error);
        // Don't show error toast since sentiment analysis is optional
      }
    } catch (error) {
      console.error('Error fetching product details:', error);
      toast.error('Failed to load product details');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToWatchlist = async () => {
    if (!product) return;
    
    try {
      // Check authentication before making the API call
      if (!(await checkAuthentication())) {
        toast.error('Please log in to add products to your watchlist');
        // You could redirect to login here if needed
        return;
      }
      
      await apiService.watchlist.addProduct(product._id);
      setInWatchlist(true);
      toast.success('Product added to watchlist');
    } catch (error) {
      const errorMessage = handleApiError(error, 'Add to watchlist');
      toast.error(errorMessage);
    }
  };

  const handleRemoveFromWatchlist = async () => {
    if (!product) return;
    
    try {
      await apiService.watchlist.removeProduct(product._id);
      setInWatchlist(false);
      toast.success('Product removed from watchlist');
    } catch (error) {
      console.error('Error removing from watchlist:', error);
      toast.error('Failed to remove product from watchlist');
    }
  };

  const handleCreateAlert = async () => {
    if (!product) return;
    
    try {
      // Check authentication before making the API call
      if (!(await checkAuthentication())) {
        toast.error('Please log in to create price alerts');
        // You could redirect to login here if needed
        return;
      }
      
      await apiService.alerts.create(product._id, alertPrice);
      setHasAlert(true);
      toast.success('Price alert created successfully');
    } catch (error) {
      const errorMessage = handleApiError(error, 'Create price alert');
      toast.error(errorMessage);
    }
  };

  const handleUpdateAlert = async () => {
    if (!product) return;
    
    try {
      const alertsResponse = await apiService.alerts.getAll();
      if (alertsResponse.data && alertsResponse.data.alerts) {
        const productAlert = alertsResponse.data.alerts.find(
          (alert: PriceAlert) => alert.productId === product._id && alert.active
        );
        
        if (productAlert) {
          await apiService.alerts.update(productAlert._id, { targetPrice: alertPrice });
          toast.success('Price alert updated successfully');
        } else {
          await handleCreateAlert();
        }
      }
    } catch (error) {
      console.error('Error updating price alert:', error);
      toast.error('Failed to update price alert');
    }
  };

  const handleDeleteAlert = async () => {
    if (!product) return;
    
    try {
      const alertsResponse = await apiService.alerts.getAll();
      if (alertsResponse.data && alertsResponse.data.alerts) {
        const productAlert = alertsResponse.data.alerts.find(
          (alert: PriceAlert) => alert.productId === product._id && alert.active
        );
        
        if (productAlert) {
          await apiService.alerts.delete(productAlert._id);
          setHasAlert(false);
          toast.success('Price alert deleted successfully');
        }
      }
    } catch (error) {
      console.error('Error deleting price alert:', error);
      toast.error('Failed to delete price alert');
    }
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

  if (!product) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center">
        <h1 className="text-3xl font-bold mb-6">Product Not Found</h1>
        <p className="text-gray-600 mb-6">The product you're looking for doesn't exist or has been removed.</p>
        <Link to="/search" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
          Search Products
        </Link>
      </div>
    );
  }

  const productCurrency = getProductCurrency(product);
  
  // Convert price history for chart
  const priceChartData = priceHistory.map(entry => ({
    date: formatDate(entry.date),
    price: entry.price
  }));

  // Convert predictions for chart
  const predictionChartData = predictions?.predictions.map(pred => ({
    date: formatDate(pred.date),
    price: pred.price
  })) || [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Back Button */}
      <div className="mb-4">
        <button
          onClick={handleGoBack}
          className="flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md transition shadow-sm"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-5 w-5 mr-2" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M10 19l-7-7m0 0l7-7m-7 7h18" 
            />
          </svg>
          Return to Search Results
        </button>
      </div>
      
      {/* Product Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex flex-col md:flex-row">
          {/* Product Image */}
          {product.imageUrl && (
            <div className="md:w-1/3 mb-4 md:mb-0 md:mr-6">
              <img 
                src={product.imageUrl} 
                alt={product.title} 
                className="w-full h-auto rounded"
              />
            </div>
          )}
          
          {/* Product Details */}
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{product.title}</h1>
            <p className="text-gray-500 mb-4">From {product.source}</p>
            
            {product.rating !== undefined && (
              <div className="flex items-center mb-4">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <svg 
                      key={i}
                      className={`w-5 h-5 ${i < Math.round(product.rating || 0) ? 'text-yellow-400' : 'text-gray-300'}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="text-gray-600 ml-2">
                  {product.rating.toFixed(1)}
                  {product.reviewCount && <span className="text-gray-400 text-sm"> ({product.reviewCount} reviews)</span>}
                </span>
              </div>
            )}
            
            <div className="mb-6">
              <p className="text-sm text-gray-500">Current Price</p>
              <p className="text-3xl font-bold text-blue-600">
                {formatCurrency(product.currentPrice, productCurrency)}
              </p>
              
              {product.originalPrice && product.originalPrice > product.currentPrice && (
                <p className="text-sm">
                  <span className="text-gray-500">Original: </span>
                  <span className="line-through text-gray-500">
                    {formatCurrency(product.originalPrice, productCurrency)}
                  </span>
                  <span className="text-green-600 ml-2">
                    {Math.round((1 - product.currentPrice / product.originalPrice) * 100)}% off
                  </span>
                </p>
              )}
            </div>
            
            <div className="flex flex-wrap gap-2">
              {inWatchlist ? (
                <button
                  onClick={handleRemoveFromWatchlist}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                >
                  Remove from Watchlist
                </button>
              ) : (
                <button
                  onClick={handleAddToWatchlist}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                >
                  Add to Watchlist
                </button>
              )}
              
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
      </div>
      
      {/* Price Alert Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Price Alert</h2>
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <div className="flex-1">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Alert me when price drops below:
            </label>
            <div className="flex">
              <span className="inline-flex items-center px-3 text-gray-500 bg-gray-100 rounded-l border border-r-0 border-gray-300">
                {productCurrency}
              </span>
              <input
                type="number"
                value={alertPrice}
                onChange={(e) => setAlertPrice(Number(e.target.value))}
                className="flex-1 appearance-none border rounded-r w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                min="0"
                step="0.01"
              />
            </div>
          </div>
          <div className="flex gap-2">
            {hasAlert ? (
              <>
                <button
                  onClick={handleUpdateAlert}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                >
                  Update Alert
                </button>
                <button
                  onClick={handleDeleteAlert}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                >
                  Delete Alert
                </button>
              </>
            ) : (
              <button
                onClick={handleCreateAlert}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
              >
                Create Alert
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Price History Chart */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Price History</h2>
        {priceHistory.length > 0 ? (
          <PriceChart priceData={priceChartData} />
        ) : (
          <p className="text-gray-500 text-center py-8">No price history available yet</p>
        )}
      </div>
      
      {/* Price Predictions */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Price Predictions</h2>
        {predictions && predictionChartData.length > 0 ? (
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
      
      {/* Sentiment Analysis */}
      {sentimentAnalysis && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Customer Sentiment Analysis</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-lg mb-2">Overall Sentiment</h3>
              <div className="flex items-center">
                <div className="relative w-full bg-gray-200 h-4 rounded-full overflow-hidden">
                  <div 
                    className={`absolute left-0 top-0 h-full ${
                      sentimentAnalysis.averageSentiment > 0.66 ? 'bg-green-500' : 
                      sentimentAnalysis.averageSentiment > 0.33 ? 'bg-yellow-500' : 'bg-red-500'
                    }`} 
                    style={{ width: `${sentimentAnalysis.averageSentiment * 100}%` }}
                  />
                </div>
                <span className="ml-2 font-bold">
                  {(sentimentAnalysis.averageSentiment * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-sm mt-2 text-gray-500">
                Based on {sentimentAnalysis.totalReviews} reviews
              </p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-lg mb-2">Sentiment Distribution</h3>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Positive</span>
                    <span>{sentimentAnalysis.sentimentDistribution.positive}%</span>
                  </div>
                  <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-green-500 h-full" 
                      style={{ width: `${sentimentAnalysis.sentimentDistribution.positive}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Neutral</span>
                    <span>{sentimentAnalysis.sentimentDistribution.neutral}%</span>
                  </div>
                  <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-yellow-500 h-full" 
                      style={{ width: `${sentimentAnalysis.sentimentDistribution.neutral}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Negative</span>
                    <span>{sentimentAnalysis.sentimentDistribution.negative}%</span>
                  </div>
                  <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-red-500 h-full" 
                      style={{ width: `${sentimentAnalysis.sentimentDistribution.negative}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-lg mb-2">Key Topics</h3>
              {sentimentAnalysis.topics.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {sentimentAnalysis.topics.map((topic, index) => (
                    <span 
                      key={index}
                      className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                    >
                      {topic.topic} ({topic.count})
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No topic data available</p>
              )}
            </div>
          </div>
          
          {sentimentAnalysis.keyPhrases.length > 0 && (
            <div className="mt-6">
              <h3 className="font-medium text-lg mb-2">Most Mentioned Phrases</h3>
              <div className="flex flex-wrap gap-2">
                {sentimentAnalysis.keyPhrases.map((phrase, index) => (
                  <span 
                    key={index}
                    className={`inline-block px-3 py-1 text-xs rounded ${
                      phrase.score > 0.7 ? 'bg-green-100 text-green-800' : 
                      phrase.score > 0.3 ? 'bg-yellow-100 text-yellow-800' : 
                      'bg-red-100 text-red-800'
                    }`}
                  >
                    {phrase.term} ({phrase.score.toFixed(2)})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductPage; 