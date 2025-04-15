import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';
import apiService from '../services/api';
import SearchBar from '../components/SearchBar/SearchBar';
import { Product, PriceHistoryEntry } from '../types';
import PriceChart from '../components/PriceTrends/PriceChart';

const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const initialQuery = searchParams.get('q') || '';
    const { isAuthenticated } = useAuth();
    const { formatCurrency } = useCurrency();
    const [loading, setLoading] = useState<boolean>(false);
    const [trendingProducts, setTrendingProducts] = useState<Product[]>([]);
    const [recentPriceDrops, setRecentPriceDrops] = useState<Product[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([]);
    const [collectionsInfo, setCollectionsInfo] = useState<{ [key: string]: Date | null }>({
        trending: null,
        'discount-deals': null
    });

    useEffect(() => {
        const fetchHomePageData = async () => {
            setLoading(true);
            try {
                // Fetch trending products from collections
                const trendingResponse = await apiService.collections.getByName('trending', 3);
                if (trendingResponse.data && trendingResponse.data.products) {
                    setTrendingProducts(trendingResponse.data.products);
                    setCollectionsInfo(prev => ({
                        ...prev,
                        trending: trendingResponse.data.lastUpdated
                    }));
                }

                // Fetch discount deals from collections
                const discountResponse = await apiService.collections.getByName('discount-deals', 3);
                if (discountResponse.data && discountResponse.data.products) {
                    setRecentPriceDrops(discountResponse.data.products);
                    setCollectionsInfo(prev => ({
                        ...prev,
                        'discount-deals': discountResponse.data.lastUpdated
                    }));
                }
            } catch (error) {
                console.error('Error fetching homepage data:', error);
                
                // Fallback to direct search if collections API fails
                try {
                    // Try to fetch trending products using direct search
                    const trendingFallback = await apiService.products.search('trending');
                    if (trendingFallback.data && trendingFallback.data.products) {
                        setTrendingProducts(trendingFallback.data.products.slice(0, 3));
                    }

                    // Try to fetch products with price drops using direct search
                    const dropsFallback = await apiService.products.search('discount deals');
                    if (dropsFallback.data && dropsFallback.data.products) {
                        setRecentPriceDrops(dropsFallback.data.products.slice(0, 3));
                    }
                } catch (fallbackError) {
                    console.error('Fallback search also failed:', fallbackError);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchHomePageData();
    }, []);

    const handleSearch = (query: string) => {
        navigate(`/search?q=${encodeURIComponent(query)}`);
    };

    const handleProductClick = async (product: Product) => {
        setSelectedProduct(product);
        try {
            const historyResponse = await apiService.products.getPriceHistory(product._id);
            if (historyResponse.data && historyResponse.data.priceHistory) {
                setPriceHistory(historyResponse.data.priceHistory);
            }
        } catch (error) {
            console.error('Error fetching product price history:', error);
            setPriceHistory([]);
        }
    };

    const handleViewDetails = (productId: string) => {
        navigate(`/product/${productId}`);
    };

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

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString();
    };

    const calculateDiscount = (currentPrice: number, originalPrice: number) => {
        if (!originalPrice || originalPrice <= currentPrice) return null;
        const discount = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
        return discount;
    };

    const priceChartData = priceHistory.map(entry => ({
        date: formatDate(entry.date),
        price: entry.price
    }));

    const getRatingStars = (rating: number | undefined) => {
        const ratingValue = rating !== undefined ? Math.round(rating) : 0;
        return [...Array(5)].map((_, i) => (
            <svg 
                key={i}
                className={`w-4 h-4 ${i < ratingValue ? 'text-yellow-400' : 'text-gray-300'}`}
                fill="currentColor"
                viewBox="0 0 20 20"
            >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
        ));
    };

    const renderProductCard = (product: Product, featured: boolean = false) => (
        <div 
            key={product._id}
            className={`bg-white rounded-lg shadow-md overflow-hidden transition-all transform hover:scale-[1.02] hover:shadow-lg ${featured ? 'md:col-span-2 lg:col-span-3' : ''}`}
            onClick={() => handleProductClick(product)}
        >
            <div className="flex flex-col md:flex-row h-full">
                {product.imageUrl && (
                    <div className={`${featured ? 'md:w-1/3' : 'md:w-1/4'} bg-gray-200`}>
                        <img 
                            src={product.imageUrl} 
                            alt={product.title} 
                            className="w-full h-full object-cover"
                        />
                    </div>
                )}
                <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                        <h3 className="text-lg font-semibold line-clamp-2">{product.title}</h3>
                        <p className="text-sm text-gray-500 mb-2">From {product.source || 'Unknown'}</p>
                        
                        <div className="flex items-baseline mb-2">
                            <span className="text-2xl font-bold text-blue-600 mr-2">
                                {formatCurrency(product.currentPrice, getProductCurrency(product))}
                            </span>
                            
                            {product.originalPrice && product.originalPrice > product.currentPrice && (
                                <>
                                    <span className="text-sm line-through text-gray-500 mr-2">
                                        {formatCurrency(product.originalPrice, getProductCurrency(product))}
                                    </span>
                                    <span className="text-sm font-medium text-green-600">
                                        {calculateDiscount(product.currentPrice, product.originalPrice)}% off
                                    </span>
                                </>
                            )}
                        </div>
                        
                        {product.rating !== undefined && (
                            <div className="flex items-center mb-2">
                                <div className="flex">
                                    {getRatingStars(product.rating)}
                                </div>
                                <span className="text-sm text-gray-600 ml-1">
                                    {product.rating.toFixed(1)}
                                </span>
                            </div>
                        )}
                    </div>
                    
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(product._id);
                        }}
                        className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition w-full md:w-auto text-center"
                    >
                        View Details
                    </button>
                </div>
            </div>
        </div>
    );

    // Information about when collections were updated
    const formatLastUpdated = (date: Date | null) => {
        if (!date) return 'Not available';
        const lastUpdated = new Date(date);
        return lastUpdated.toLocaleString();
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Hero Section */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-400 py-16 px-4">
                <div className="max-w-5xl mx-auto text-center">
                    <h1 className="text-4xl font-bold text-white mb-4">
                        Track Prices, Save Money
                    </h1>
                    <p className="text-white text-xl mb-8 max-w-2xl mx-auto">
                        Get notified when prices drop on your favorite products and make informed buying decisions with SaleSnipe.
                    </p>
                    <div className="max-w-xl mx-auto">
                        <SearchBar onSearch={handleSearch} initialQuery={initialQuery} />
                    </div>
                </div>
            </div>
            
            {/* Main Content */}
            <div className="max-w-6xl mx-auto px-4 py-8">
                {/* Featured Section */}
                {selectedProduct ? (
                    <div className="mb-12">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold">{selectedProduct.title}</h2>
                            <button 
                                onClick={() => setSelectedProduct(null)}
                                className="text-sm text-blue-600 hover:underline"
                            >
                                Back to recommendations
                            </button>
                        </div>
                        
                        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                            <div className="flex flex-col md:flex-row">
                                {selectedProduct.imageUrl && (
                                    <div className="md:w-1/3 mb-4 md:mb-0 md:mr-6">
                                        <img 
                                            src={selectedProduct.imageUrl} 
                                            alt={selectedProduct.title} 
                                            className="w-full h-auto rounded"
                                        />
                                    </div>
                                )}
                                
                                <div className="flex-1">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h2 className="text-2xl font-bold">{selectedProduct.title}</h2>
                                            <p className="text-gray-500">From {selectedProduct.source || 'Unknown'}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm text-gray-500">Current Price</p>
                                            <p className="text-2xl font-bold text-blue-600">
                                                {formatCurrency(selectedProduct.currentPrice, getProductCurrency(selectedProduct))}
                                            </p>
                                            
                                            {selectedProduct.originalPrice && selectedProduct.originalPrice > selectedProduct.currentPrice && (
                                                <p className="text-sm">
                                                    <span className="text-gray-500">Original: </span>
                                                    <span className="line-through text-gray-500">
                                                        {formatCurrency(selectedProduct.originalPrice, getProductCurrency(selectedProduct))}
                                                    </span>
                                                    <span className="text-green-600 ml-2">
                                                        {calculateDiscount(selectedProduct.currentPrice, selectedProduct.originalPrice)}% off
                                                    </span>
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="mt-6">
                                        <h3 className="text-lg font-semibold mb-2">Price History</h3>
                                        {priceHistory.length > 0 ? (
                                            <div className="h-64">
                                                <PriceChart priceData={priceChartData} />
                                            </div>
                                        ) : (
                                            <p className="text-gray-500">No price history available yet</p>
                                        )}
                                    </div>
                                    
                                    <div className="mt-6 flex gap-3">
                                        <button
                                            onClick={() => handleViewDetails(selectedProduct._id)}
                                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                                        >
                                            View Full Details
                                        </button>
                                        
                                        <a 
                                            href={selectedProduct.url} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition"
                                        >
                                            View on {selectedProduct.source || 'Website'}
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Features Section */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                            <div className="bg-white p-6 rounded-lg shadow-md">
                                <div className="text-blue-600 mb-4">
                                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold mb-2">Track Any Product</h3>
                                <p className="text-gray-600">
                                    Monitor prices for your favorite items from top online retailers and get notified when prices drop.
                                </p>
                            </div>
                            
                            <div className="bg-white p-6 rounded-lg shadow-md">
                                <div className="text-blue-600 mb-4">
                                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold mb-2">AI Price Predictions</h3>
                                <p className="text-gray-600">
                                    Our AI analyzes price history data to predict future price drops, helping you decide when to buy.
                                </p>
                            </div>
                            
                            <div className="bg-white p-6 rounded-lg shadow-md">
                                <div className="text-blue-600 mb-4">
                                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold mb-2">Custom Price Alerts</h3>
                                <p className="text-gray-600">
                                    Set your desired price point and get notified when your tracked items reach that price.
                                </p>
                            </div>
                        </div>
                    
                        {/* Trending Products */}
                        {trendingProducts.length > 0 && (
                            <div className="mb-12">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-2xl font-bold">Trending Products</h2>
                                    <button 
                                        onClick={() => navigate('/search', { state: { searchQuery: 'trending' } })}
                                        className="text-sm text-blue-600 hover:underline"
                                    >
                                        View all
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {trendingProducts.map(product => renderProductCard(product))}
                                </div>
                                <div className="text-xs text-gray-500 mt-2 text-right">
                                    Last updated: {formatLastUpdated(collectionsInfo.trending)}
                                </div>
                            </div>
                        )}
                        
                        {/* Recent Price Drops */}
                        {recentPriceDrops.length > 0 && (
                            <div className="mt-12">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-2xl font-bold">Recent Price Drops</h2>
                                    <button 
                                        onClick={() => navigate('/search', { state: { searchQuery: 'discount deals' } })}
                                        className="text-sm text-blue-600 hover:underline"
                                    >
                                        See all
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {recentPriceDrops.map(product => renderProductCard(product))}
                                </div>
                                <div className="text-xs text-gray-500 mt-2 text-right">
                                    Last updated: {formatLastUpdated(collectionsInfo['discount-deals'])}
                                </div>
                            </div>
                        )}

                        {/* Call to Action */}
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-8 text-center">
                            <h2 className="text-2xl font-bold mb-4">Start saving on your favorite products today</h2>
                            <p className="text-lg mb-6 max-w-2xl mx-auto">
                                Sign up now to unlock personalized price tracking, custom alerts, and AI-powered predictions.
                            </p>
                            {isAuthenticated ? (
                                <button 
                                    onClick={() => navigate('/dashboard')}
                                    className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition font-medium text-lg"
                                >
                                    Go to Dashboard
                                </button>
                            ) : (
                                <div className="flex flex-col sm:flex-row justify-center gap-4">
                                    <button 
                                        onClick={() => navigate('/register')}
                                        className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition font-medium text-lg"
                                    >
                                        Sign Up Free
                                    </button>
                                    <button 
                                        onClick={() => navigate('/login')}
                                        className="px-6 py-3 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition font-medium text-lg"
                                    >
                                        Login
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default HomePage;