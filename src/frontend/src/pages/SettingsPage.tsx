import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';

// Currency options with full names
const currencyOptions = [
  { code: 'USD', name: 'United States Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound Sterling' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'NZD', name: 'New Zealand Dollar' },
  { code: 'BRL', name: 'Brazilian Real' },
  { code: 'MXN', name: 'Mexican Peso' },
  { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'HKD', name: 'Hong Kong Dollar' },
  { code: 'SEK', name: 'Swedish Krona' },
  { code: 'NOK', name: 'Norwegian Krone' },
  { code: 'KRW', name: 'South Korean Won' },
  { code: 'TRY', name: 'Turkish Lira' },
  { code: 'RUB', name: 'Russian Ruble' },
  { code: 'ZAR', name: 'South African Rand' }
];

const SettingsPage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [displayCurrency, setDisplayCurrency] = useState<string>('USD');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [supportedCurrencies, setSupportedCurrencies] = useState<string[]>([]);

  // Load user preferences and supported currencies on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Load user preferences
        if (user?.preferences?.currency) {
          setDisplayCurrency(user.preferences.currency);
        }

        // Fetch supported currencies from backend
        const response = await apiService.products.getSupportedCurrencies();
        if (response.data && response.data.supportedCurrencies) {
          setSupportedCurrencies(response.data.supportedCurrencies);
        }
      } catch (error) {
        console.error('Error loading user settings:', error);
        toast.error('Failed to load settings');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user]);

  const handleCurrencyChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newCurrency = event.target.value;
    setDisplayCurrency(newCurrency);

    try {
      setIsLoading(true);
      // Update user preferences in backend
      await apiService.auth.updateProfile({
        preferences: {
          ...user?.preferences,
          currency: newCurrency
        }
      });

      // Update local user object
      if (updateUser && user) {
        updateUser({
          id: user.id,
          name: user.name,
          email: user.email,
          preferences: {
            emailNotifications: user.preferences.emailNotifications,
            desktopNotifications: user.preferences.desktopNotifications,
            currency: newCurrency
          }
        });
      }

      toast.success(`Currency updated to ${getCurrencyName(newCurrency)}`);
    } catch (error) {
      console.error('Error updating currency preference:', error);
      toast.error('Failed to update currency preference');
      // Revert to previous value on error
      setDisplayCurrency(user?.preferences?.currency || 'USD');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to get full currency name
  const getCurrencyName = (code: string): string => {
    const currency = currencyOptions.find(curr => curr.code === code);
    return currency ? `${currency.code} - ${currency.name}` : code;
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Display Settings</h2>

        <div className="mb-4">
          <label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-1">
            Display Currency
          </label>
          <div className="mt-1 relative">
            <select
              id="currency"
              name="currency"
              value={displayCurrency}
              onChange={handleCurrencyChange}
              disabled={isLoading}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              {/* Only show currencies that are supported by the backend */}
              {currencyOptions
                .filter(curr => supportedCurrencies.length === 0 || supportedCurrencies.includes(curr.code))
                .map(currency => (
                  <option key={currency.code} value={currency.code}>
                    {currency.code} - {currency.name}
                  </option>
                ))}
            </select>
            {isLoading && (
              <div className="absolute right-2 top-2">
                <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            )}
          </div>
          <p className="mt-2 text-sm text-gray-500">
            All product prices will be displayed in this currency
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Account Settings</h2>
        {user ? (
          <div>
            <p><strong>Name:</strong> {user.name}</p>
            <p><strong>Email:</strong> {user.email}</p>
            <p className="text-sm text-gray-500 mt-4">
              To update your account details, please contact support.
            </p>
          </div>
        ) : (
          <p>Please log in to view account settings.</p>
        )}
      </div>
    </div>
  );
};

export default SettingsPage; 