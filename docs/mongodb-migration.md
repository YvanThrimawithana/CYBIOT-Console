# MongoDB Migration Guide for CybIOT

This document explains how to migrate your CybIOT system from JSON file storage to MongoDB.

## Prerequisites

1. Install MongoDB Community Server:
   - Download from [MongoDB website](https://www.mongodb.com/try/download/community)
   - Run the installer and follow the installation wizard
   - Choose "Install MongoDB as a Service" for convenience

2. Install required Node.js packages:
   ```
   npm install mongoose bcryptjs --save
   ```

## Migration Process

### 1. Run the Migration Script

The migration script transfers all your existing data from JSON files to MongoDB:

```bash
# Navigate to the backend directory
cd backend

# Run the migration script
node scripts/migrateToMongo.js
```

This will:
- Connect to your local MongoDB instance
- Create required collections in the "cybiot" database
- Transfer all your devices, traffic logs, alerts, rules, firmware, platform settings, and users
- Log the progress to the console

### 2. Verify Migration Success

Use MongoDB Compass to verify that your data has been successfully migrated:

1. Open MongoDB Compass
2. Connect to `mongodb://localhost:27017`
3. Navigate to the "cybiot" database
4. Check that the following collections exist and contain your data:
   - `devices`
   - `trafficlogs`
   - `alerts`
   - `alertrules`
   - `firmwares`
   - `platformsettings`
   - `users`

### 3. Start Your Application

The application has been updated to use MongoDB instead of JSON files. Simply start it as usual:

```bash
# From the project root
npm start
```

## Database Structure

The following collections have been created in MongoDB:

| Collection | Purpose |
|------------|---------|
| devices | IoT device information and status |
| trafficlogs | Network traffic events from devices |
| alerts | Security incidents and offenses |
| alertrules | Rule definitions for alert generation |
| firmwares | Firmware versions and analysis results |
| platformsettings | Global configuration settings |
| users | User accounts and authentication |

## Troubleshooting

### Connection Issues

If the application fails to connect to MongoDB:

1. Check that MongoDB service is running:
   - Windows: Open Services app (services.msc) and verify MongoDB is running
   - Linux: `sudo systemctl status mongodb`

2. Verify connection string:
   - The application should use `mongodb://localhost:27017/cybiot`
   - If you've changed the default port, update the connection string accordingly

### Missing Data

If some data appears to be missing after migration:

1. Check the migration script logs for errors
2. Verify that the original JSON files contain the expected data
3. Run the migration script again with proper permissions

## Backup and Restore

To back up your MongoDB database:

```bash
mongodump --db cybiot --out ./backup
```

To restore from backup:

```bash
mongorestore --db cybiot ./backup/cybiot
```

## Benefits of MongoDB

Using MongoDB instead of JSON files provides:

1. **Better Performance**: Indexed queries are much faster than scanning files
2. **Concurrency**: Multiple users can access the database simultaneously
3. **Scalability**: Can handle larger data volumes without performance issues
4. **Data Integrity**: ACID transactions prevent data corruption
5. **Query Capabilities**: Complex queries and aggregations are supported