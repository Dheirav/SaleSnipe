import React, { useState, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import apiService from '../services/api';
import { Product } from '../types';
import ProductCard from '../components/Products/ProductCard';

const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const initialQuery = searchParams.get('q') || '';
  
  const [query, setQuery] = useState<string>(initialQuery);
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [currency, setCurrency] = useState<string>('USD');
  const [supportedCurrencies, setSupportedCurrencies] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  // Load results from session storage on mount
  useEffect(() => {
    const savedResults = sessionStorage.getItem('searchResults');
    const savedQuery = sessionStorage.getItem('searchQuery');
    if (savedResults && savedQuery === initialQuery) {
      try {
        const parsedResults = JSON.parse(savedResults);
        setResults(parsedResults);
        setHasSearched(true);
      } catch (err) {
        console.error('Error parsing saved results:', err);
      }
    }
  }, [initialQuery]);

  // Save results to session storage whenever they change
  useEffect(() => {
    if (results.length > 0) {
      sessionStorage.setItem('searchResults', JSON.stringify(results));
      sessionStorage.setItem('searchQuery', query);
    }
  }, [results, query]);

  // Load supported currencies on mount
  useEffect(() => {
    const loadCurrencies = async () => {
      try {
        const response = await apiService.products.getSupportedCurrencies();
        if (response.data && response.data.supportedCurrencies) {
          setSupportedCurrencies(response.data.supportedCurrencies);
        }
      } catch (err) {
        console.error('Error loading currencies:', err);
      }
    };

    loadCurrencies();
  }, []);

  // Check if we're coming back from a product page or performing initial search
  useEffect(() => {
    // Always preserve results from previous searches
    if (hasSearched) {
      console.log('Preserving previous search results');
      return;
    }
    
    // Perform search if query is present in URL and we haven't searched yet
    if (initialQuery && !hasSearched) {
      handleSearch();
    }
  }, [initialQuery, hasSearched]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    setError(null);
    setDebugInfo(null);
    
    try {
      // Update URL with search query
      setSearchParams({ q: query });
      
      console.log('Starting search for:', query);
      const response = await apiService.products.search(query);
      console.log('Search response received:', response.data);
      
      // Handle different possible response formats from the backend
      let products: Product[] = [];
      
      if (response.data) {
        // Format 1: { products: Product[], ... }
        if (Array.isArray(response.data.products)) {
          products = response.data.products;
        } 
        // Format 2: { Product[], ... }
        else if (Array.isArray(response.data)) {
          products = response.data;
        }
        // Format 3: Other structure that might contain products
        else if (typeof response.data === 'object') {
          // Look for any array property that might contain products
          const arrayProps = Object.keys(response.data)
            .filter(key => Array.isArray(response.data[key]));
          
          for (const prop of arrayProps) {
            if (response.data[prop].length > 0 && 
                response.data[prop][0]._id && 
                response.data[prop][0].title !== undefined) {
              products = response.data[prop];
              break;
            }
          }
        }
      }
      
      // Set the results, regardless of where we found them
      setResults(products);
      setHasSearched(true);
      
      // Set currency if available
      if (response.data && response.data.currency) {
        setCurrency(response.data.currency);
      }
      
      // Handle case where no products were found
      if (products.length === 0) {
        setError('No products found. Try a different search term.');
      }
      
      // Log success for debugging
      console.log(`Found ${products.length} products in the response`);
    } catch (err: any) {
      console.error('Search error:', err);
      
      // Create more informative error message
      let errorMessage = 'An error occurred while searching. Please try again.';
      
      if (err.response) {
        // The request was made and the server responded with a status code
        errorMessage = `Server error: ${err.response.status} ${err.response.data?.message || ''}`; 
        setDebugInfo({
          status: err.response.status,
          data: err.response.data,
          headers: err.response.headers
        });
      } else if (err.request) {
        // The request was made but no response was received
        errorMessage = 'No response received from server. Please check your connection.';
        setDebugInfo({
          request: err.request
        });
      } else {
        // Something happened in setting up the request that triggered an Error
        errorMessage = `Error: ${err.message}`;
        setDebugInfo({
          message: err.message,
          stack: err.stack
        });
      }
      
      setError(errorMessage);
      setResults([]);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleClearResults = () => {
    setResults([]);
    setQuery('');
    setError(null);
    setDebugInfo(null);
    setHasSearched(false);
    setSearchParams({});
    // Clear session storage
    sessionStorage.removeItem('searchResults');
    sessionStorage.removeItem('searchQuery');
    toast.success('Search results cleared');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Search Products</h1>
          <p className="mt-4 text-lg text-gray-500">
            Enter a product name to search across multiple e-commerce platforms
          </p>
        </div>

        <div className="flex items-center max-w-3xl mx-auto">
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Search for products..."
              className="block w-full px-4 py-3 rounded-l-md border border-gray-300 shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="inline-flex items-center px-4 py-3 border border-transparent rounded-r-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <div className="text-red-700">{error}</div>
            {debugInfo && process.env.NODE_ENV === 'development' && (
              <details className="mt-2">
                <summary className="text-sm text-red-500 cursor-pointer">Debug Information</summary>
                <pre className="mt-2 p-2 bg-gray-100 text-xs overflow-auto max-h-40 rounded">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}

        {results.length > 0 && (
          <div className="mt-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                Search Results ({results.length})
              </h2>
              <button
                onClick={handleClearResults}
                className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 rounded transition"
              >
                Clear Results
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.map((product) => (
                <ProductCard key={product._id} product={product} />
              ))}
            </div>
          </div>
        )}

        {!loading && !error && results.length === 0 && initialQuery && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">
              No products found for "{initialQuery}". Try a different search term.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPage; 