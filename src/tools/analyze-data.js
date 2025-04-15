require('dotenv').config();
const mongoose = require('mongoose');
const colors = require('colors');
const commander = require('commander');
const { program } = commander;
const moment = require('moment');
const fs = require('fs');
const path = require('path');

// Import models
const Product = require('../models/Product');
const ProductCollection = require('../models/ProductCollection');
const User = require('../models/User');

// Directory for saving analysis results
const REPORTS_DIR = path.join(__dirname, '../../reports');
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// Initialize database connection
async function initializeDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(colors.green('✓ Connected to MongoDB'));
    return true;
  } catch (error) {
    console.error(colors.red(`× MongoDB connection error: ${error.message}`));
    return false;
  }
}

// Generate full statistics report
async function generateFullReport() {
  console.log(colors.cyan('Generating full statistics report...'));
  
  const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
  const reportPath = path.join(REPORTS_DIR, `stats_report_${timestamp}.json`);
  
  try {
    const stats = {
      generatedAt: new Date(),
      summary: await getDatabaseSummary(),
      productStats: await getProductStatistics(),
      collectionStats: await getCollectionStatistics(),
      priceStats: await getPriceStatistics(),
      userActivity: await getUserActivity(),
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(stats, null, 2));
    console.log(colors.green(`Report saved to: ${reportPath}`));
    
    // Print summary to console
    printReportSummary(stats);
    
    return true;
  } catch (error) {
    console.error(colors.red(`Error generating report: ${error.message}`));
    return false;
  }
}

// Get basic database summary
async function getDatabaseSummary() {
  const productCount = await Product.countDocuments();
  const collectionCount = await ProductCollection.countDocuments();
  const userCount = await User.countDocuments();
  
  const oldestProduct = await Product.findOne().sort({ createdAt: 1 });
  const newestProduct = await Product.findOne().sort({ createdAt: -1 });
  
  return {
    productCount,
    collectionCount,
    userCount,
    oldestProductDate: oldestProduct?.createdAt,
    newestProductDate: newestProduct?.createdAt,
    databaseAgeInDays: oldestProduct 
      ? moment().diff(moment(oldestProduct.createdAt), 'days') 
      : 0
  };
}

// Analyze products
async function getProductStatistics() {
  // Products by store
  const storeDistribution = await Product.aggregate([
    { $group: { _id: "$store", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  
  // Products by category
  const categoryDistribution = await Product.aggregate([
    { $group: { _id: "$category", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  
  // Products added over time (last 30 days)
  const thirtyDaysAgo = moment().subtract(30, 'days').toDate();
  const productsOverTime = await Product.aggregate([
    { $match: { createdAt: { $gte: thirtyDaysAgo } } },
    { 
      $group: { 
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 }
      } 
    },
    { $sort: { _id: 1 } }
  ]);
  
  // Products with image vs without
  const withImage = await Product.countDocuments({ 
    $and: [
      { imageUrl: { $exists: true } },
      { imageUrl: { $ne: null } },
      { imageUrl: { $ne: "" } }
    ]
  });
  
  return {
    storeDistribution,
    categoryDistribution,
    productsOverTime,
    imageStats: {
      withImage,
      withoutImage: await Product.countDocuments() - withImage,
      percentWithImage: await Product.countDocuments() > 0 
        ? (withImage / await Product.countDocuments() * 100).toFixed(2) 
        : 0
    }
  };
}

// Analyze collections
async function getCollectionStatistics() {
  // Basic collection stats
  const collections = await ProductCollection.find();
  
  // Collection products stats
  const collectionStats = collections.map(collection => ({
    name: collection.name,
    description: collection.description,
    productCount: collection.products?.length || 0,
    lastUpdated: collection.lastUpdated,
    ageInHours: moment().diff(moment(collection.lastUpdated), 'hours')
  }));
  
  // Products in multiple collections
  const productIds = await ProductCollection.aggregate([
    { $unwind: "$products" },
    { $group: { _id: "$products.productId", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } }
  ]);
  
  return {
    totalCollections: collections.length,
    collectionStats,
    productsInMultipleCollections: productIds.length,
    mostSharedProducts: productIds.slice(0, 10)
  };
}

// Analyze price data
async function getPriceStatistics() {
  // Price range distribution
  const priceRanges = [
    { range: "Under $10", min: 0, max: 10 },
    { range: "$10-$25", min: 10, max: 25 },
    { range: "$25-$50", min: 25, max: 50 },
    { range: "$50-$100", min: 50, max: 100 },
    { range: "$100-$250", min: 100, max: 250 },
    { range: "$250-$500", min: 250, max: 500 },
    { range: "$500-$1000", min: 500, max: 1000 },
    { range: "Over $1000", min: 1000, max: Infinity }
  ];
  
  const priceDistribution = await Promise.all(priceRanges.map(async range => {
    const count = await Product.countDocuments({
      currentPrice: { $gte: range.min, $lt: range.max }
    });
    return { range: range.range, count };
  }));
  
  // Price drop statistics
  const productsWithPriceDrop = await Product.countDocuments({
    $expr: { $lt: ["$currentPrice", "$originalPrice"] }
  });
  
  const averagePriceDrop = await Product.aggregate([
    { 
      $match: { 
        $expr: { $lt: ["$currentPrice", "$originalPrice"] } 
      } 
    },
    { 
      $group: { 
        _id: null,
        avgDrop: { 
          $avg: { 
            $subtract: ["$originalPrice", "$currentPrice"] 
          } 
        },
        avgDropPercentage: { 
          $avg: { 
            $multiply: [
              { $divide: [
                { $subtract: ["$originalPrice", "$currentPrice"] },
                "$originalPrice"
              ] },
              100
            ]
          } 
        }
      } 
    }
  ]);
  
  // Largest price drops
  const largestPriceDrops = await Product.find({
    $expr: { $lt: ["$currentPrice", "$originalPrice"] }
  })
  .sort({ 
    $expr: { 
      $subtract: ["$originalPrice", "$currentPrice"] 
    }
  })
  .limit(10);
  
  return {
    priceDistribution,
    priceDropStats: {
      productsWithPriceDrop,
      percentWithPriceDrop: await Product.countDocuments() > 0 
        ? (productsWithPriceDrop / await Product.countDocuments() * 100).toFixed(2) 
        : 0,
      averagePriceDrop: averagePriceDrop.length > 0 ? averagePriceDrop[0] : { avgDrop: 0, avgDropPercentage: 0 }
    },
    topPriceDrops: largestPriceDrops.map(p => ({
      title: p.title,
      store: p.store,
      originalPrice: p.originalPrice,
      currentPrice: p.currentPrice,
      dropAmount: p.originalPrice - p.currentPrice,
      dropPercentage: ((p.originalPrice - p.currentPrice) / p.originalPrice * 100).toFixed(2)
    }))
  };
}

// Analyze user activity
async function getUserActivity() {
  // Users by creation date
  const thirtyDaysAgo = moment().subtract(30, 'days').toDate();
  const usersOverTime = await User.aggregate([
    { $match: { createdAt: { $gte: thirtyDaysAgo } } },
    { 
      $group: { 
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 }
      } 
    },
    { $sort: { _id: 1 } }
  ]);
  
  // Users with saved products
  const usersWithSavedProducts = await User.countDocuments({
    savedProducts: { $exists: true, $ne: [] }
  });
  
  return {
    totalUsers: await User.countDocuments(),
    newUsersLast30Days: await User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    usersOverTime,
    usersWithSavedProducts,
    percentWithSavedProducts: await User.countDocuments() > 0 
      ? (usersWithSavedProducts / await User.countDocuments() * 100).toFixed(2) 
      : 0
  };
}

// Print summary of the report to console
function printReportSummary(stats) {
  console.log('\n' + colors.bold.underline('DATABASE ANALYSIS SUMMARY'));
  console.log(colors.bold('Generated at:'), moment(stats.generatedAt).format('YYYY-MM-DD HH:mm:ss'));
  
  console.log('\n' + colors.bold.cyan('OVERVIEW'));
  console.log(`Products: ${stats.summary.productCount}`);
  console.log(`Collections: ${stats.summary.collectionCount}`);
  console.log(`Users: ${stats.summary.userCount}`);
  console.log(`Database Age: ${stats.summary.databaseAgeInDays} days`);
  
  console.log('\n' + colors.bold.cyan('PRODUCT INSIGHTS'));
  console.log(`Top Stores: ${stats.productStats.storeDistribution.slice(0, 3).map(s => `${s._id} (${s.count})`).join(', ')}`);
  console.log(`Top Categories: ${stats.productStats.categoryDistribution.slice(0, 3).map(c => `${c._id || 'Uncategorized'} (${c.count})`).join(', ')}`);
  console.log(`Images: ${stats.productStats.imageStats.percentWithImage}% of products have images`);
  
  console.log('\n' + colors.bold.cyan('PRICE INSIGHTS'));
  console.log(`Products with Price Drops: ${stats.priceStats.priceDropStats.percentWithPriceDrop}%`);
  console.log(`Average Price Drop: $${stats.priceStats.priceDropStats.averagePriceDrop.avgDrop.toFixed(2)} (${stats.priceStats.priceDropStats.averagePriceDrop.avgDropPercentage.toFixed(2)}%)`);
  
  if (stats.priceStats.topPriceDrops.length > 0) {
    console.log(`Largest Price Drop: ${stats.priceStats.topPriceDrops[0].title} - $${stats.priceStats.topPriceDrops[0].dropAmount.toFixed(2)} (${stats.priceStats.topPriceDrops[0].dropPercentage}%)`);
  }
  
  console.log('\n' + colors.bold.cyan('COLLECTION INSIGHTS'));
  stats.collectionStats.collectionStats.forEach(c => {
    console.log(`${c.name}: ${c.productCount} products, updated ${moment(c.lastUpdated).fromNow()}`);
  });
  
  console.log('\n' + colors.bold.cyan('USER INSIGHTS'));
  console.log(`New Users (30 days): ${stats.userActivity.newUsersLast30Days}`);
  console.log(`Users with Saved Products: ${stats.userActivity.percentWithSavedProducts}%`);
  
  console.log('\n' + colors.bold(`Full report saved to: ${path.join(REPORTS_DIR, `stats_report_${moment().format('YYYY-MM-DD_HH-mm-ss')}.json`)}`));
}

// Find trending products based on price drops
async function findTrendingProducts() {
  console.log(colors.cyan('Analyzing trending products...'));
  
  try {
    // Find products with significant price drops in the last 7 days
    const sevenDaysAgo = moment().subtract(7, 'days').toDate();
    
    const trendingProducts = await Product.find({
      updatedAt: { $gte: sevenDaysAgo },
      $expr: { 
        $and: [
          { $lt: ["$currentPrice", "$originalPrice"] },
          { $gte: [
            { $multiply: [
              { $divide: [
                { $subtract: ["$originalPrice", "$currentPrice"] },
                "$originalPrice"
              ] },
              100
            ]},
            15 // At least 15% discount
          ]}
        ]
      }
    })
    .sort({ 
      $expr: { 
        $multiply: [
          { $divide: [
            { $subtract: ["$originalPrice", "$currentPrice"] },
            "$originalPrice"
          ] },
          100
        ]
      }
    })
    .limit(20);
    
    // Save results to file
    const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
    const reportPath = path.join(REPORTS_DIR, `trending_products_${timestamp}.json`);
    
    const formattedResults = trendingProducts.map(p => ({
      title: p.title,
      store: p.store,
      category: p.category,
      originalPrice: p.originalPrice,
      currentPrice: p.currentPrice,
      discount: ((p.originalPrice - p.currentPrice) / p.originalPrice * 100).toFixed(2) + '%',
      url: p.url,
      updatedAt: p.updatedAt
    }));
    
    fs.writeFileSync(reportPath, JSON.stringify(formattedResults, null, 2));
    console.log(colors.green(`Found ${trendingProducts.length} trending products. Report saved to: ${reportPath}`));
    
    // Print top trending products
    console.log('\n' + colors.bold.underline('TOP TRENDING PRODUCTS'));
    formattedResults.slice(0, 10).forEach((p, i) => {
      console.log(`${i+1}. ${colors.bold(p.title)} (${p.store})`);
      console.log(`   Price: $${p.currentPrice} (was $${p.originalPrice}) - ${p.discount} off`);
    });
    
    return true;
  } catch (error) {
    console.error(colors.red(`Error finding trending products: ${error.message}`));
    return false;
  }
}

// Find categories with the most price drops
async function analyzeCategories() {
  console.log(colors.cyan('Analyzing categories...'));
  
  try {
    // Analyze categories by price drop percentage
    const categoryAnalysis = await Product.aggregate([
      // Only include products with price drops
      { 
        $match: { 
          $expr: { $lt: ["$currentPrice", "$originalPrice"] },
          category: { $exists: true, $ne: null, $ne: "" }
        } 
      },
      // Calculate discount percentage
      { 
        $addFields: { 
          discountPercentage: { 
            $multiply: [
              { $divide: [
                { $subtract: ["$originalPrice", "$currentPrice"] },
                "$originalPrice"
              ] },
              100
            ]
          } 
        } 
      },
      // Group by category
      { 
        $group: { 
          _id: "$category",
          count: { $sum: 1 },
          avgDiscount: { $avg: "$discountPercentage" },
          maxDiscount: { $max: "$discountPercentage" },
          totalProducts: { $sum: 1 }
        } 
      },
      // Filter to categories with at least 5 products
      { $match: { count: { $gte: 5 } } },
      // Sort by average discount
      { $sort: { avgDiscount: -1 } }
    ]);
    
    // Save results to file
    const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
    const reportPath = path.join(REPORTS_DIR, `category_analysis_${timestamp}.json`);
    
    fs.writeFileSync(reportPath, JSON.stringify(categoryAnalysis, null, 2));
    console.log(colors.green(`Category analysis complete. Report saved to: ${reportPath}`));
    
    // Print top categories by discount
    console.log('\n' + colors.bold.underline('TOP DISCOUNTED CATEGORIES'));
    categoryAnalysis.slice(0, 10).forEach((c, i) => {
      console.log(`${i+1}. ${colors.bold(c._id)}`);
      console.log(`   Products: ${c.totalProducts}, Avg Discount: ${c.avgDiscount.toFixed(2)}%, Max Discount: ${c.maxDiscount.toFixed(2)}%`);
    });
    
    return true;
  } catch (error) {
    console.error(colors.red(`Error analyzing categories: ${error.message}`));
    return false;
  }
}

// Find products that have frequent price changes
async function findVolatileProducts() {
  console.log(colors.cyan('Finding products with volatile prices...'));
  
  try {
    // This would require price history data, but we can approximate with updatedAt and price differences
    const volatileProducts = await Product.find({
      $expr: { $ne: ["$currentPrice", "$originalPrice"] }
    })
    .sort({ updatedAt: -1 })
    .limit(50);
    
    // Save results to file
    const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
    const reportPath = path.join(REPORTS_DIR, `volatile_products_${timestamp}.json`);
    
    const formattedResults = volatileProducts.map(p => ({
      title: p.title,
      store: p.store,
      originalPrice: p.originalPrice,
      currentPrice: p.currentPrice,
      priceChange: p.originalPrice - p.currentPrice,
      percentageChange: ((p.originalPrice - p.currentPrice) / p.originalPrice * 100).toFixed(2),
      lastUpdated: p.updatedAt
    }));
    
    fs.writeFileSync(reportPath, JSON.stringify(formattedResults, null, 2));
    console.log(colors.green(`Found ${volatileProducts.length} products with price changes. Report saved to: ${reportPath}`));
    
    return true;
  } catch (error) {
    console.error(colors.red(`Error finding volatile products: ${error.message}`));
    return false;
  }
}

// Run the main function based on command line arguments
async function main() {
  let connected = await initializeDatabase();
  if (!connected) {
    console.error(colors.red('Failed to connect to database. Exiting.'));
    process.exit(1);
  }
  
  try {
    // Process command line arguments
    program
      .option('-f, --full-report', 'Generate a full analysis report')
      .option('-t, --trending', 'Find trending products')
      .option('-c, --categories', 'Analyze categories')
      .option('-v, --volatile', 'Find products with volatile prices')
      .option('-a, --all', 'Run all analyses')
      .parse(process.argv);
    
    const options = program.opts();
    
    // If no specific options, show full report
    if (!options.fullReport && !options.trending && !options.categories && !options.volatile && !options.all) {
      options.fullReport = true;
    }
    
    // Run requested analyses
    if (options.fullReport || options.all) {
      await generateFullReport();
    }
    
    if (options.trending || options.all) {
      await findTrendingProducts();
    }
    
    if (options.categories || options.all) {
      await analyzeCategories();
    }
    
    if (options.volatile || options.all) {
      await findVolatileProducts();
    }
    
  } catch (error) {
    console.error(colors.red(`Error during analysis: ${error.message}`));
  } finally {
    // Close database connection
    await mongoose.disconnect();
    console.log(colors.green('Database connection closed.'));
  }
}

// Run the main function
main(); 