import React from 'react';
import { useLocation } from 'react-router-dom';
import ResultsList from '../components/Results/ResultsList';

const ResultsPage: React.FC = () => {
    const location = useLocation();
    const { searchQuery } = location.state || { searchQuery: '' };

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Search Results for: {searchQuery}</h1>
            <ResultsList query={searchQuery} />
        </div>
    );
};

export default ResultsPage;