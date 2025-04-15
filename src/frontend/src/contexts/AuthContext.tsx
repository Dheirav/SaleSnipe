import React, { createContext, useState, useEffect, useContext } from 'react';
import apiService from '../services/api';

interface User {
  id: string;
  name: string;
  email: string;
  preferences: {
    emailNotifications: boolean;
    desktopNotifications: boolean;
    currency: string;
  };
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  updateProfile: (userData: { name?: string; email?: string; preferences?: any }) => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user is already logged in on mount
  useEffect(() => {
    const checkLoggedIn = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const response = await apiService.auth.getCurrentUser();
          setUser(response.data.user);
        } catch (err) {
          // Token might be expired or invalid
          localStorage.removeItem('token');
          console.error('Authentication error:', err);
        }
      }
      setLoading(false);
    };

    checkLoggedIn();
  }, []);

  // Login function
  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.auth.login({ email, password });
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      setUser(user);
    } catch (err: any) {
      // Use the detailed error message if available, otherwise fall back to the generic message
      const errorDetail = err.response?.data?.detail;
      const errorMessage = err.response?.data?.message;
      setError(errorDetail || errorMessage || 'Login failed. Please check your credentials.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Register function
  const register = async (name: string, email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      console.log('Attempting to register user with:', { name, email });
      const response = await apiService.auth.register({ name, email, password });
      console.log('Registration successful, response:', response.data);
      
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      setUser(user);
    } catch (err: any) {
      console.error('Registration error details:', err);
      
      // Get detailed error information
      const errorDetail = err.response?.data?.detail;
      const errorMessage = err.response?.data?.message;
      const errorStatus = err.response?.status;
      
      console.error(`Registration failed (${errorStatus}):`, errorDetail || errorMessage);
      
      setError(errorDetail || errorMessage || 'Registration failed. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  // Update profile
  const updateProfile = async (userData: { name?: string; email?: string; preferences?: any }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.auth.updateProfile(userData);
      setUser(response.data.user);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update profile.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Direct user state update function
  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        updateProfile,
        updateUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext; 