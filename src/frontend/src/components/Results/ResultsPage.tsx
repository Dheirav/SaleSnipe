import React from 'react';

const ResultsPage: React.FC<{ results: any[] }> = ({ results }) => {
    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Search Results</h1>
            {results.length === 0 ? (
                <p>No results found.</p>
            ) : (
                <ul className="space-y-4">
                    {results.map((result, index) => (
                        <li key={index} className="border p-4 rounded shadow">
                            <h2 className="text-xl font-semibold">{result.title}</h2>
                            <p>{result.description}</p>
                            <p className="text-lg font-bold">{result.price}</p>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default ResultsPage;