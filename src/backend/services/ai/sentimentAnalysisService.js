// Fallback implementation without relying on natural package
const Product = require('../../models/Product');

class SentimentAnalysisService {
  constructor() {
    console.log('Initializing fallback sentiment analysis service');
  }

  async analyzeProductReviews(productId) {
    try {
      const product = await Product.findById(productId);
      if (!product || !product.reviews || product.reviews.length === 0) {
        throw new Error('No reviews found for this product');
      }

      const reviews = product.reviews;
      
      // Simplified sentiment analysis using basic word matching
      const positiveWords = ['good', 'great', 'excellent', 'amazing', 'love', 'perfect', 'best', 'recommended', 'happy'];
      const negativeWords = ['bad', 'poor', 'terrible', 'awful', 'hate', 'worst', 'disappointed', 'broken', 'waste'];
      
      const analysisResults = reviews.map(review => {
        // Simple sentiment calculation based on word matching
        const text = review.text.toLowerCase();
        let sentimentScore = 0;
        
        // Count positive word occurrences and add them to the score
        positiveWords.forEach(word => {
          const regex = new RegExp(`\\b${word}\\b`, 'g');
          const matches = text.match(regex);
          if (matches) {
            sentimentScore += matches.length * 0.2;
          }
        });
        
        // Count negative word occurrences and subtract them from the score
        negativeWords.forEach(word => {
          const regex = new RegExp(`\\b${word}\\b`, 'g');
          const matches = text.match(regex);
          if (matches) {
            sentimentScore -= matches.length * 0.2;
          }
        });
        
        // Adjust based on the rating if available
        if (review.rating) {
          sentimentScore = (sentimentScore + (review.rating - 3) / 2) / 2;
        }
        
        // Clamp the sentiment score between -1 and 1
        sentimentScore = Math.max(-1, Math.min(1, sentimentScore));
        
        // Calculate review length score (longer reviews tend to be more detailed)
        const lengthScore = Math.min(review.text.length / 100, 1);
        
        // Calculate overall review score
        const overallScore = (sentimentScore + 1) / 2 * 0.7 + lengthScore * 0.3;

        return {
          reviewId: review._id,
          text: review.text,
          rating: review.rating,
          sentimentScore,
          lengthScore,
          overallScore,
          date: review.date || new Date()
        };
      });

      // Calculate aggregate metrics
      const aggregateMetrics = {
        averageSentiment: analysisResults.reduce((sum, r) => sum + r.sentimentScore, 0) / analysisResults.length,
        averageOverallScore: analysisResults.reduce((sum, r) => sum + r.overallScore, 0) / analysisResults.length,
        totalReviews: analysisResults.length,
        sentimentDistribution: {
          positive: analysisResults.filter(r => r.sentimentScore > 0.2).length,
          neutral: analysisResults.filter(r => r.sentimentScore >= -0.2 && r.sentimentScore <= 0.2).length,
          negative: analysisResults.filter(r => r.sentimentScore < -0.2).length
        }
      };

      // Simple key phrase extraction - just count word frequency
      const wordCounts = this.countWords(reviews);
      const keyPhrases = Object.entries(wordCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([term, score]) => ({ term, score }));

      // Simple topic extraction
      const topics = keyPhrases.map(({ term }) => ({ 
        topic: term, 
        count: wordCounts[term]
      }));

      return {
        productId,
        reviews: analysisResults,
        metrics: aggregateMetrics,
        keyPhrases,
        topics
      };
    } catch (error) {
      console.error('Error analyzing product reviews:', error);
      throw error;
    }
  }

  countWords(reviews) {
    const wordCounts = {};
    const stopWords = new Set(['the', 'and', 'a', 'to', 'of', 'in', 'is', 'it', 'that', 'was', 'with', 'for', 'on', 'this', 'be', 'i', 'you', 'are']);
    
    reviews.forEach(review => {
      const words = review.text.toLowerCase().match(/\w+/g) || [];
      words.forEach(word => {
        if (word.length > 2 && !stopWords.has(word)) {
          wordCounts[word] = (wordCounts[word] || 0) + 1;
        }
      });
    });
    
    return wordCounts;
  }

  async getReviewInsights(productId) {
    try {
      const analysis = await this.analyzeProductReviews(productId);
      
      // Calculate review sentiment trend
      const reviewsByDate = [...analysis.reviews].sort((a, b) => 
        new Date(a.date) - new Date(b.date)
      );
      
      const sentimentTrend = reviewsByDate.map(review => ({
        date: review.date,
        sentiment: review.sentimentScore
      }));

      // Calculate review volume trend
      const volumeTrend = this.calculateVolumeTrend(reviewsByDate);

      return {
        productId,
        metrics: analysis.metrics,
        trends: {
          sentiment: sentimentTrend,
          volume: volumeTrend
        },
        topPhrases: analysis.keyPhrases,
        topics: analysis.topics
      };
    } catch (error) {
      console.error('Error getting review insights:', error);
      throw error;
    }
  }

  calculateVolumeTrend(reviews) {
    // Group reviews by month
    const monthlyVolume = {};
    
    reviews.forEach(review => {
      const date = new Date(review.date);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyVolume[month] = (monthlyVolume[month] || 0) + 1;
    });

    return Object.entries(monthlyVolume)
      .map(([month, count]) => ({
        month,
        count
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }
}

module.exports = new SentimentAnalysisService(); 