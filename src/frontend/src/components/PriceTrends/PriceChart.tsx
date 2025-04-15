import React from 'react';
import { Line } from 'react-chartjs-2';
import { PriceTrend } from '../../types';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface PriceChartProps {
    priceData: PriceTrend[];
}

const PriceChart: React.FC<PriceChartProps> = ({ priceData }) => {
    const data = {
        labels: priceData.map((item: PriceTrend) => item.date),
        datasets: [
            {
                label: 'Price Trend',
                data: priceData.map((item: PriceTrend) => item.price),
                fill: false,
                backgroundColor: 'rgba(75,192,192,0.4)',
                borderColor: 'rgba(75,192,192,1)',
            },
        ],
    };

    const options = {
        responsive: true,
        scales: {
            y: {
                beginAtZero: true,
            },
        },
    };

    return (
        <div className="p-4">
            <h2 className="text-xl font-semibold mb-4">Price Trends</h2>
            <Line data={data} options={options} />
        </div>
    );
};

export default PriceChart;