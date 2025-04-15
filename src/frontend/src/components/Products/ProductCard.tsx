import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Product } from '../../types';
import { useCurrency } from '../../contexts/CurrencyContext';

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const location = useLocation();
  const { formatCurrency } = useCurrency();
  
  // Validate product data
  if (!product || !product._id) {
    return (
      <div className="border border-red-200 rounded-lg p-4 bg-red-50">
        <p className="text-red-500 text-sm">Invalid product data</p>
      </div>
    );
  }

  // Calculate discount percentage if original price exists
  const discountPercentage = product.originalPrice && 
                             product.originalPrice > product.currentPrice &&
                             product.currentPrice > 0
    ? Math.round(100 - (product.currentPrice / product.originalPrice) * 100)
    : null;
    
  // Ensure title exists
  const title = product.title || 'Unnamed Product';

  // Determine product currency based on source
  const getProductCurrency = (): string => {
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

  const productCurrency = getProductCurrency();

  return (
    <Link 
      to={`/product/${product._id}`}
      state={{ from: location.pathname, search: location.search, preserveResults: true }}
      className="group border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300"
    >
      <div className="relative pb-[100%] bg-gray-200 overflow-hidden">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={title}
            className="absolute top-0 left-0 w-full h-full object-center object-cover group-hover:opacity-90 transition-opacity"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = 'https://placehold.co/200x200/e2e8f0/475569?text=No+Image';
            }}
          />
        ) : (
          <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
            No Image
          </div>
        )}
      </div>
      
      <div className="p-4">
        <h3 className="text-sm font-medium text-gray-900 line-clamp-2 mb-1 group-hover:text-blue-600 transition-colors">
          {title}
        </h3>
        
        <p className="text-xs text-gray-500 mb-2">{product.source || 'Unknown source'}</p>
        
        <div className="flex items-baseline mt-1">
          <span className="text-lg font-semibold text-gray-900">
            {formatCurrency(product.currentPrice, productCurrency)}
          </span>
          
          {discountPercentage && (
            <span className="ml-2 text-xs font-medium text-green-600">
              {discountPercentage}% off
            </span>
          )}
        </div>
        
        {product.originalPrice && product.originalPrice > product.currentPrice && (
          <div className="mt-1">
            <span className="text-xs text-gray-500 line-through">
              {formatCurrency(product.originalPrice, productCurrency)}
            </span>
          </div>
        )}
        
        {product.rating !== undefined && (
          <div className="mt-2 flex items-center">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <svg
                  key={i}
                  className={`h-3 w-3 ${
                    i < Math.round(product.rating || 0)
                      ? 'text-yellow-400'
                      : 'text-gray-300'
                  }`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span className="ml-1 text-xs text-gray-500">({product.rating ? product.rating.toFixed(1) : '0.0'})</span>
          </div>
        )}
      </div>
    </Link>
  );
};

export default ProductCard; 