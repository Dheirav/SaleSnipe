import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../../services/api';
import { Product, SearchResults } from '../../types';
import toast from 'react-hot-toast';
import { useCurrency } from '../../contexts/CurrencyContext';

interface ResultsListProps {
  query: string;
}

const ResultsList: React.FC<ResultsListProps> = ({ query }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [results, setResults] = useState<SearchResults | null>(null);
  const navigate = useNavigate();
  const { formatCurrency } = useCurrency();

  useEffect(() => {
    if (query) {
      searchProducts();
    }
  }, [query]);

  const searchProducts = async () => {
    try {
      setLoading(true);
      const response = await apiService.products.search(query);
      if (response.data) {
        setResults({
          products: response.data.products,
          totalResults: response.data.total,
          page: 1,
          totalPages: Math.ceil(response.data.total / 10) // Assuming 10 items per page
        });
      }
    } catch (error) {
      console.error('Error searching products:', error);
      toast.error('Failed to search products');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToWatchlist = async (productId: string) => {
    try {
      await apiService.watchlist.addProduct(productId);
      toast.success('Product added to watchlist');
    } catch (error) {
      console.error('Error adding product to watchlist:', error);
      toast.error('Failed to add product to watchlist');
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
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!results || results.products.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <h2 className="text-xl mb-4">No products found</h2>
        <p className="text-gray-600 mb-6">Try searching with different keywords</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      {results.products.map((product: Product) => (
        <div key={product._id} className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6">
            <div className="flex flex-col md:flex-row">
              {product.imageUrl && (
                <div className="w-full md:w-48 flex-shrink-0 mb-4 md:mb-0 md:mr-6">
                  <img 
                    src={product.imageUrl} 
                    alt={product.title} 
                    className="w-full h-auto object-contain"
                    style={{ maxHeight: '150px' }}
                  />
                </div>
              )}
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
                      {product.rating.toFixed(1)}
                      {product.reviewCount && <span className="text-gray-400 text-sm"> ({product.reviewCount} reviews)</span>}
                    </span>
                  </div>
                )}
                
                {product.description && (
                  <p className="text-gray-700 mb-4">{product.description.substring(0, 200)}...</p>
                )}
                
                <div className="mt-4 flex items-center">
                  <div>
                    <p className="text-sm text-gray-500">Current Price</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(product.currentPrice, getProductCurrency(product))}
                    </p>
                    {product.originalPrice && product.originalPrice > product.currentPrice && (
                      <p className="text-sm text-gray-500">
                        <span className="line-through">{formatCurrency(product.originalPrice, getProductCurrency(product))}</span>
                        <span className="text-green-600 ml-2">
                          {Math.round((1 - product.currentPrice / product.originalPrice) * 100)}% off
                        </span>
                      </p>
                    )}
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
                    onClick={() => handleAddToWatchlist(product._id)}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
                  >
                    Add to Watchlist
                  </button>
                  {product.url && (
                    <a 
                      href={product.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition"
                    >
                      View on {product.source}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ResultsList; 