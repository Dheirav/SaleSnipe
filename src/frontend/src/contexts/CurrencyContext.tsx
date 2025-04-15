import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import axios from 'axios';

interface CurrencyContextType {
  currency: string;
  setCurrency: (currency: string) => void;
  convertPrice: (price: number, fromCurrency: string) => number;
  formatCurrency: (price: number, sourceCurrency?: string) => string;
  isLoading: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};

interface CurrencyProviderProps {
  children: ReactNode;
}

export const CurrencyProvider: React.FC<CurrencyProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [currency, setCurrency] = useState<string>('USD');
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Update currency from user preferences
  useEffect(() => {
    if (user?.preferences?.currency) {
      setCurrency(user.preferences.currency);
    }
  }, [user]);

  // Fetch exchange rates when currency changes
  useEffect(() => {
    const fetchExchangeRates = async () => {
      setIsLoading(true);
      try {
        // Using ExchangeRate-API (https://www.exchangerate-api.com/)
        const response = await axios.get(`https://open.er-api.com/v6/latest/${currency}`);
        if (response.data && response.data.rates) {
          setExchangeRates(response.data.rates);
        }
      } catch (error) {
        console.error('Error fetching exchange rates:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchExchangeRates();
  }, [currency]);

  // Convert price from source currency to display currency
  const convertPrice = (price: number, fromCurrency: string): number => {
    if (isLoading || !price) return price;
    
    if (fromCurrency === currency) return price;
    
    // If we have direct exchange rate
    if (exchangeRates[fromCurrency]) {
      // Convert: first to base currency (current display currency), then to target
      const rate = 1 / exchangeRates[fromCurrency];
      return Math.round(price * rate * 100) / 100;
    }
    
    // If we don't have the rate, return original price
    console.warn(`Exchange rate for ${fromCurrency} to ${currency} not available`);
    return price;
  };

  // Format price with currency symbol
  const formatCurrency = (price: number, sourceCurrency?: string): string => {
    if (!price && price !== 0) return 'Price unavailable';
    
    const currencyToUse = currency;
    const displayPrice = sourceCurrency 
      ? convertPrice(price, sourceCurrency) 
      : price;
    
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyToUse,
      }).format(displayPrice);
    } catch (e) {
      console.error('Error formatting currency:', e);
      return `${displayPrice} ${currencyToUse}`;
    }
  };

  const value = {
    currency,
    setCurrency,
    convertPrice,
    formatCurrency,
    isLoading
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
};

export default CurrencyContext; 