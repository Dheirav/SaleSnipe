# SaleSnipe Database Management Tools

This directory contains utilities for managing the SaleSnipe database, including tools for managing product collections, backing up and restoring data, and scheduled refreshes.

## Available Tools

### Database Manager (`db-manager.js`)

An interactive CLI tool for managing product collections and database maintenance.

**Features:**
- Refresh all product collections
- Create new collections with custom search terms
- View all collections and their details
- Delete collections
- Clean up stale products
- View database statistics

**Usage:**
```bash
# Interactive mode
node src/tools/db-manager.js

# Direct commands
node src/tools/db-manager.js --refresh  # Refresh all collections immediately
node src/tools/db-manager.js --stats    # Show database statistics
node src/tools/db-manager.js --cleanup  # Clean up stale products
```

### Backup Utility (`db-backup.js`)

A tool for backing up and restoring product collections and data.

**Features:**
- Backup collections to JSON files
- Backup products to JSON files
- Restore collections from backup
- Restore products from backup
- List available backups
- Delete backups

**Usage:**
```bash
# Interactive mode
node src/tools/db-backup.js

# Direct commands
node src/tools/db-backup.js --backup  # Backup everything immediately
node src/tools/db-backup.js --list    # List available backups
```

### Collection Refresh Script (`refresh-collections.js`)

A non-interactive script designed to be run from cron jobs or scheduled tasks to refresh all product collections.

**Features:**
- Refreshes predefined collections (trending, discount deals, new arrivals, top-rated)
- Support for custom collections via command line arguments
- Detailed logs and summary statistics
- No user interaction required

**Usage:**
```bash
# Refresh predefined collections
node src/tools/refresh-collections.js

# Refresh predefined collections plus custom ones
node src/tools/refresh-collections.js "sales:discount sale" "tech:electronics gadgets"
```

## Setting Up Scheduled Refreshes

### On Linux/macOS (Cron)

To set up a cron job to refresh collections every 12 hours:

1. Edit your crontab:
   ```
   crontab -e
   ```

2. Add the following line:
   ```
   0 */12 * * * cd /path/to/salesnipe && node src/tools/refresh-collections.js >> logs/collections-refresh.log 2>&1
   ```

### On Windows (Task Scheduler)

1. Open Task Scheduler
2. Create a new Basic Task
3. Set the trigger to run every 12 hours
4. Set the action to "Start a program"
5. Program/script: `node`
6. Arguments: `src/tools/refresh-collections.js`
7. Start in: `C:\path\to\salesnipe`

## Backup Strategy

It's recommended to set up regular backups of your collections and products:

1. Daily backups of collections (small size)
2. Weekly backups of all products (larger size)
3. Keep at least 7 days of collection backups and 4 weeks of product backups

Example cron job for daily collection backup:
```
0 0 * * * cd /path/to/salesnipe && node src/tools/db-backup.js --backup-collections >> logs/backup.log 2>&1
```

## Troubleshooting

If you encounter issues with any of the tools:

1. Check that MongoDB is running and accessible
2. Ensure environment variables are properly set
3. Check the console output for specific error messages
4. Look for logs in the application log directory

For persistent issues, you may need to manually repair the database or collections using MongoDB's native tools.

## Database Tools (db-tools.js and db-tools-cli.js)

An integrated database management tool that combines various database operations in a single utility.

### Features

- **Connection Check**: Test and verify database connection
- **Backup and Restore**: Create and restore backups of collections, products, and users
- **Database Statistics**: View comprehensive stats about your database
- **Product Management**: View, delete, and manage product data
- **Collection Management**: View, create, and manage product collections
- **User Management**: View and manage user accounts
- **Interactive CLI**: User-friendly command-line interface for all operations

### Usage

```bash
# If you have inquirer version compatibility issues, use the simple CLI version:
node src/tools/db-tools-cli.js check
node src/tools/db-tools-cli.js backup
node src/tools/db-tools-cli.js stats
node src/tools/db-tools-cli.js list-backups

# For the full-featured interactive version (requires inquirer):
# Run in interactive mode (default)
node src/tools/db-tools.js

# Check database connection
node src/tools/db-tools.js check

# Create full database backup
node src/tools/db-tools.js backup

# Backup only collections
node src/tools/db-tools.js backup --collections-only

# Restore from backup
node src/tools/db-tools.js restore

# View database statistics
node src/tools/db-tools.js stats
```

Note: If you encounter issues with the interactive version (db-tools.js) due to inquirer compatibility, please use the simplified CLI version (db-tools-cli.js) instead, or install an older version of inquirer:

```bash
npm install inquirer@8.2.4 --save-dev
```

This tool combines functionality from:
- db-manager.js
- check-db-connection.js
- db-backup.js

For specialized operations like scraping or collection refreshing, you may still need to use the dedicated tools. 