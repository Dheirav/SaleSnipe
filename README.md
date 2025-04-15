# SaleSnipe

SaleSnipe is a price tracking application that helps you monitor product prices across multiple e-commerce websites. Get notified when prices drop, view price history, and make informed purchase decisions.

## Features

- **Multi-site Web Scraping**: Search products across Amazon, eBay, Flipkart, and more
- **Price Tracking**: Monitor price changes and receive alerts
- **AI-Powered Insights**: Get price predictions and sentiment analysis
- **Notifications**: Receive price drop alerts via email or desktop notifications
- **Watchlist Management**: Save and organize products you're interested in

## Getting Started

### Prerequisites

- Node.js 14+ and npm 6+
- MongoDB installed locally

### Installation

1. Clone the repository
   ```
   git clone <repository-url>
   cd SaleSnipe
   ```

2. Install dependencies
   ```
   # Install backend dependencies
   npm install
   
   # Install frontend dependencies
   cd src/frontend
   npm install
   cd ../..
   ```

3. Set up environment variables
   ```
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Start MongoDB
   ```
   sudo service mongod start
   # or for Windows
   # net start MongoDB
   ```

### Running the Application

1. Start the backend server
   ```
   npm run start:backend
   ```

2. Start the frontend development server
   ```
   npm run start:frontend
   ```

3. Access the application
   ```
   Open your browser and navigate to:
   
   Frontend: http://localhost:3001
   Backend API: http://localhost:3000/api
   ```

### Running the Scraper

To run the scraper directly:

```
node src/tools/run-scraper.js --scraper=amazon --query="product name"
```

Available scrapers:
- `amazon`: Amazon US
- `amazon_in`: Amazon India
- `ebay`: eBay
- `flipkart`: Flipkart
- `all`: All scrapers

## Development

### Project Structure

- `/src/backend`: Backend API server
- `/src/frontend`: React frontend
- `/src/tools`: Command-line tools for scraping
- `/src/backend/services/scrapers`: Web scrapers for different sites

### Scripts

- `npm run start:backend`: Start the backend server
- `npm run start:frontend`: Start the frontend development server
- `npm run build`: Build the frontend for production
- `npm run scrape`: Run the scraper tool

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Database Management Tools

SaleSnipe includes several tools to help manage the product database:

### 1. Database Manager (`db-manager.js`)

An interactive CLI tool for managing your product collections.

**Features:**
- Refresh product collections (fetch latest data)
- Create new collections with predefined keywords
- View collection details and statistics
- Delete unused collections
- Clean up stale products
- View database statistics

**Usage:**
```bash
node src/tools/db-manager.js
node src/tools/db-manager.js --refresh
node src/tools/db-manager.js --stats
node src/tools/db-manager.js --cleanup
```

### 2. Backup Utility (`db-backup.js`)

Tool for backing up and restoring product collections and data.

**Features:**
- Backup collections to JSON files
- Restore from previous backups
- List available backups
- Delete old backups

**Usage:**
```bash
node src/tools/db-backup.js --backup
node src/tools/db-backup.js --restore <backup-name>
node src/tools/db-backup.js --list
node src/tools/db-backup.js --delete <backup-name>
```

### 3. Collection Refresh Script (`refresh-collections.js`)

A non-interactive script for refreshing product collections. Perfect for scheduled tasks.

**Features:**
- Refreshes predefined collections
- Can accept custom collections via command line
- Produces detailed logs
- No user interaction required

**Usage:**
```bash
node src/tools/refresh-collections.js
node src/tools/refresh-collections.js "sales:discount sale" "tech:electronics gadgets"
```

### 4. Data Analysis Tool (`analyze-data.js`)

A powerful tool for analyzing database statistics and product trends.

**Features:**
- Generate comprehensive database statistics reports
- Identify trending products with significant price drops
- Analyze categories with the most discounts
- Find products with volatile prices
- Save all analyses to JSON files in the `reports` directory

**Usage:**
```bash
# Generate full report (default)
node src/tools/analyze-data.js

# Find trending products (with >15% discount in last 7 days)
node src/tools/analyze-data.js --trending

# Analyze categories by discount percentage
node src/tools/analyze-data.js --categories

# Find products with price changes
node src/tools/analyze-data.js --volatile

# Run all analyses
node src/tools/analyze-data.js --all
```

The reports are saved to the `reports` directory with timestamped filenames and include:
- Database summary (product/collection/user counts)
- Product statistics (by store, category, time added)
- Collection statistics and relationships
- Price analysis and discount tracking
- User activity metrics

## Setting Up Scheduled Refreshes

### Linux/macOS (using cron)

Add the following to your crontab (`crontab -e`):

```
# Refresh collections every day at 3 AM
0 3 * * * cd /path/to/salesnipe && node src/tools/refresh-collections.js >> logs/refresh.log 2>&1
```

### Windows (using Task Scheduler)

1. Open Task Scheduler
2. Create a Basic Task
3. Set trigger to Daily
4. Set action to "Start a program"
5. Program/script: `node`
6. Arguments: `src\tools\refresh-collections.js`
7. Start in: `C:\path\to\salesnipe`

## Recommended Backup Strategy

We recommend:
- Daily backups of collections
- Weekly backups of all products

Example cron job for daily collection backups:
```
# Backup collections daily at 2 AM
0 2 * * * cd /path/to/salesnipe && node src/tools/db-backup.js --backup collections >> logs/backup.log 2>&1
```

## Troubleshooting

If you encounter issues:
1. Check MongoDB is running
2. Verify your environment variables are set correctly
3. Check console output for errors
4. Look at application logs for more detailed errors 