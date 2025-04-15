import React, { useState, KeyboardEvent } from 'react';

interface SearchBarProps {
    onSearch: (query: string) => void;
    initialQuery?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, initialQuery = '' }) => {
    const [query, setQuery] = useState(initialQuery);

    const handleSearch = () => {
        if (query.trim()) {
            onSearch(query.trim());
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    return (
        <div className="relative w-full">
            <div className="relative">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search for products, brands, or categories..."
                    className="w-full py-3 px-4 pr-12 bg-white border-0 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 placeholder-gray-500"
                    autoFocus
                />
                <button
                    onClick={handleSearch}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition"
                    aria-label="Search"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 justify-center">
                <button 
                    onClick={() => onSearch('electronics')}
                    className="px-3 py-1 text-sm bg-white bg-opacity-75 rounded-full hover:bg-opacity-100 transition text-blue-600"
                >
                    Electronics
                </button>
                <button 
                    onClick={() => onSearch('best deals')}
                    className="px-3 py-1 text-sm bg-white bg-opacity-75 rounded-full hover:bg-opacity-100 transition text-blue-600"
                >
                    Best Deals
                </button>
                <button 
                    onClick={() => onSearch('home appliances')}
                    className="px-3 py-1 text-sm bg-white bg-opacity-75 rounded-full hover:bg-opacity-100 transition text-blue-600"
                >
                    Home Appliances
                </button>
            </div>
        </div>
    );
};

export default SearchBar;