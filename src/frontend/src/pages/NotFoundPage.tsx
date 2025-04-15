import React from 'react';
import { Link } from 'react-router-dom';

const NotFoundPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)]">
      <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
      <p className="text-2xl text-gray-600 mb-8">Page not found</p>
      <p className="text-gray-500 mb-8">The page you are looking for does not exist or has been moved.</p>
      <Link 
        to="/" 
        className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
      >
        Return to Home
      </Link>
    </div>
  );
};

export default NotFoundPage; 