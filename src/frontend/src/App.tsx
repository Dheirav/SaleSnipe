import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CurrencyProvider } from './contexts/CurrencyContext';
import apiService from './services/api';
import toast from 'react-hot-toast';

// Pages
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import ProductPage from './pages/ProductPage';
import DashboardPage from './pages/DashboardPage';
import WatchlistPage from './pages/WatchlistPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import SettingsPage from './pages/SettingsPage';
import NotFoundPage from './pages/NotFoundPage';

// Layouts
import MainLayout from './components/Layouts/MainLayout';

// Auth Validation Component
const AuthGuard: React.FC<{ 
  children: React.ReactNode, 
  requireAuth: boolean 
}> = ({ children, requireAuth }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  
  useEffect(() => {
    // Always verify token on route change to ensure it's valid
    const verifyToken = async () => {
      const token = localStorage.getItem('token');
      
      if (token && requireAuth) {
        try {
          await apiService.auth.getCurrentUser();
          setChecking(false);
        } catch (err) {
          console.error('Token validation failed:', err);
          localStorage.removeItem('token');
          toast.error('Your session has expired. Please log in again.');
          setChecking(false);
        }
      } else {
        setChecking(false);
      }
    };
    
    verifyToken();
  }, [location.pathname, requireAuth]);
  
  // Show loading state while checking authentication or loading user data
  if (loading || checking) {
    return (
      <MainLayout>
        <div className="flex justify-center items-center min-h-[calc(100vh-64px)]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </MainLayout>
    );
  }
  
  // Redirect to login if authentication is required but user is not authenticated
  if (requireAuth && !isAuthenticated) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }
  
  // Redirect to dashboard if user is already authenticated but trying to access login/register
  if (!requireAuth && isAuthenticated && (location.pathname === '/login' || location.pathname === '/register')) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// Enhanced Login Route Component
const EnhancedLoginRoute: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const redirectPath = queryParams.get('redirect') || '/dashboard';
  
  // Create a handler for successful login
  const handleSuccessfulLogin = () => {
    navigate(redirectPath);
  };
  
  return (
    <MainLayout>
      <LoginPage onLoginSuccess={handleSuccessfulLogin} />
    </MainLayout>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <CurrencyProvider>
        <BrowserRouter>
          <Toaster 
            position="top-right" 
            toastOptions={{
              duration: 5000,
              style: {
                background: '#333',
                color: '#fff',
              },
              success: {
                style: {
                  background: '#166534',
                },
              },
              error: {
                style: {
                  background: '#991b1b',
                },
              },
            }}
          />
          <Routes>
            {/* Public Routes */}
            <Route 
              path="/" 
              element={
                <AuthGuard requireAuth={false}>
                  <MainLayout><HomePage /></MainLayout>
                </AuthGuard>
              } 
            />
            <Route 
              path="/search" 
              element={
                <AuthGuard requireAuth={false}>
                  <MainLayout><SearchPage /></MainLayout>
                </AuthGuard>
              } 
            />
            <Route 
              path="/product/:id" 
              element={
                <AuthGuard requireAuth={false}>
                  <MainLayout><ProductPage /></MainLayout>
                </AuthGuard>
              } 
            />
            
            {/* Login route with enhanced redirect functionality */}
            <Route 
              path="/login" 
              element={
                <AuthGuard requireAuth={false}>
                  <EnhancedLoginRoute />
                </AuthGuard>
              } 
            />
            
            <Route 
              path="/register" 
              element={
                <AuthGuard requireAuth={false}>
                  <MainLayout><RegisterPage /></MainLayout>
                </AuthGuard>
              } 
            />
            
            {/* Protected Routes */}
            <Route 
              path="/dashboard" 
              element={
                <AuthGuard requireAuth={true}>
                  <MainLayout><DashboardPage /></MainLayout>
                </AuthGuard>
              } 
            />
            <Route 
              path="/watchlist" 
              element={
                <AuthGuard requireAuth={true}>
                  <MainLayout><WatchlistPage /></MainLayout>
                </AuthGuard>
              } 
            />
            <Route 
              path="/settings" 
              element={
                <AuthGuard requireAuth={true}>
                  <MainLayout><SettingsPage /></MainLayout>
                </AuthGuard>
              } 
            />
            
            {/* 404 Route */}
            <Route 
              path="*" 
              element={
                <AuthGuard requireAuth={false}>
                  <MainLayout><NotFoundPage /></MainLayout>
                </AuthGuard>
              } 
            />
          </Routes>
        </BrowserRouter>
      </CurrencyProvider>
    </AuthProvider>
  );
};

export default App;