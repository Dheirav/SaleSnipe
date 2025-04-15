import React from 'react';

const Dashboard: React.FC = () => {
    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white shadow-md rounded-lg p-4">
                    <h2 className="text-xl font-semibold">Price History</h2>
                    {/* Price history chart component will go here */}
                </div>
                <div className="bg-white shadow-md rounded-lg p-4">
                    <h2 className="text-xl font-semibold">AI Insights</h2>
                    {/* AI insights component will go here */}
                </div>
                <div className="bg-white shadow-md rounded-lg p-4">
                    <h2 className="text-xl font-semibold">User Preferences</h2>
                    {/* User preferences component will go here */}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;