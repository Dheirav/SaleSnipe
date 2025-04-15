// Product Types
export interface Product {
    _id: string;
    title: string;
    description?: string;
    currentPrice: number;
    originalPrice?: number;
    imageUrl?: string;
    source?: string;
    currency?: string;
    rating?: number;
    reviewCount?: number;
    url?: string;
    category?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface PriceHistoryEntry {
    price: number;
    currency: string;
    date: string;
}

export interface ProductReview {
    text: string;
    rating: number;
    date: string;
    sentimentScore: number;
    lengthScore: number;
    overallScore: number;
}

export interface PricePrediction {
    lastPrediction: string;
    predictions: {
        date: string;
        price: number;
        currency: string;
    }[];
    accuracy: number;
}

export interface SentimentAnalysis {
    averageSentiment: number;
    averageOverallScore: number;
    totalReviews: number;
    sentimentDistribution: {
        positive: number;
        neutral: number;
        negative: number;
    };
    keyPhrases: {
        term: string;
        score: number;
    }[];
    topics: {
        topic: string;
        count: number;
    }[];
    lastUpdated: string;
}

// User Types
export interface User {
    id: string;
    name: string;
    email: string;
    watchlist: WatchlistItem[];
    alerts: PriceAlert[];
    preferences: UserPreferences;
}

export interface WatchlistItem {
    productId: string;
    addedAt: string;
    product?: Product; // Populated when returning from API
}

export interface PriceAlert {
    _id: string;
    productId: string;
    targetPrice: number;
    active: boolean;
    notificationSent: boolean;
    createdAt: string;
    product?: Product; // Populated when returning from API
}

export interface UserPreferences {
    emailNotifications: boolean;
    desktopNotifications: boolean;
    currency: string;
}

// API Response Types
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

export interface SearchResponse {
    products: Product[];
    total: number;
    currency: string;
}

export interface PriceHistoryResponse {
    priceHistory: PriceHistoryEntry[];
    currency: string;
}

export interface AuthResponse {
    token: string;
    user: User;
}

// Form Types
export interface LoginFormData {
    email: string;
    password: string;
}

export interface RegisterFormData {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
}

export interface AlertFormData {
    productId: string;
    targetPrice: number;
}

export interface PriceTrend {
    date: string;
    price: number;
}

export interface Notification {
    _id: string;
    type: string; // 'price_drop', 'price_increase', 'back_in_stock', 'lowest_price', etc.
    productId: string;
    product: {
        _id: string;
        title: string;
        currentPrice: number;
        currency: string;
    };
    data: {
        percentageChange?: number;
        previousPrice?: number;
        [key: string]: any;
    };
    read: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface SearchResults {
    products: Product[];
    totalResults: number;
    page: number;
    totalPages: number;
}