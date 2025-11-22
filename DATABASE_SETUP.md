# Database Setup Guide

Separate database strategy for local development and production.

## 🎯 Architecture

```
┌─────────────────┐         ┌─────────────────┐
│  Local Server   │         │  Prod Server    │
│  (Development)  │         │  (Railway)      │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │                           │
    ┌────▼─────┐              ┌──────▼──────┐
    │ Local DB │              │  Prod DB    │
    │  (Test)  │              │  (Live)     │
    └──────────┘              └─────────────┘
         ▲                           ▲
         │                           │
         │                           │
    ┌────┴─────────┐          ┌──────┴──────────┐
    │ Python Core  │          │  Python Core    │
    │   (Local)    │          │  (Production)   │
    └──────────────┘          └─────────────────┘
```

## 📦 Database Options

### Option 1: MongoDB Atlas (Recommended)
**Free tier: 512MB storage**

**Setup:**
1. Go to https://cloud.mongodb.com
2. Create free cluster
3. Create TWO databases:
   - `psx-trading-local`
   - `psx-trading-prod`

**Pros:**
- ✅ Free
- ✅ Same cluster, different databases
- ✅ Easy sync between local/prod
- ✅ Cloud-based (access from anywhere)

**Connection Strings:**
```env
# Local
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/psx-trading-local

# Production
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/psx-trading-prod
```

### Option 2: Local MongoDB + Atlas Production
**Local: Free | Prod: Atlas Free**

**Setup:**
1. Install MongoDB locally: https://www.mongodb.com/try/download/community
2. Use local MongoDB for development
3. Use Atlas for production

**Pros:**
- ✅ Local dev works offline
- ✅ Faster local queries
- ✅ No cloud costs for dev

**Cons:**
- ❌ Need to install MongoDB
- ❌ Different setup for team members

**Connection Strings:**
```env
# Local
MONGODB_URI=mongodb://localhost:27017/psx-trading-local

# Production
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/psx-trading-prod
```

### Option 3: Railway PostgreSQL
**If you want to switch from MongoDB**

**Pros:**
- ✅ Railway provides free PostgreSQL
- ✅ Relational database (better for structured data)

**Cons:**
- ❌ Requires migration from MongoDB
- ❌ More work upfront

## 🔧 Setup Instructions

### Step 1: Create MongoDB Atlas Cluster (Recommended)

1. **Sign up**: https://cloud.mongodb.com
2. **Create free cluster** (M0 Sandbox)
3. **Create database user**:
   - Username: `psx-admin`
   - Password: Generate strong password
   - Role: Atlas Admin

4. **Whitelist IP**:
   - Add `0.0.0.0/0` (allow from anywhere)
   - Or specific IPs for security

5. **Get connection string**:
   ```
   mongodb+srv://psx-admin:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

### Step 2: Configure Environment Variables

**Local `.env`:**
```env
# Database
MONGODB_URI=mongodb+srv://psx-admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/psx-trading-local?retryWrites=true&w=majority

# Environment
NODE_ENV=development

# Frontend
FRONTEND_URL=http://localhost:5173

# JWT
JWT_SECRET=your-local-secret-key

# Email (optional for local)
# RESEND_API_KEY=re_xxxxx

# Python Core Engine
PYTHON_CORE_ENGINE_URL=http://localhost:8000
```

**Railway (Production) Variables:**
```env
# Database
MONGODB_URI=mongodb+srv://psx-admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/psx-trading-prod?retryWrites=true&w=majority

# Environment
NODE_ENV=production

# Frontend
FRONTEND_URL=https://psx-trading-app-production.up.railway.app

# JWT
JWT_SECRET=your-production-secret-key

# Email
RESEND_API_KEY=re_xxxxx
EMAIL_FROM_NAME=PSX SmartDesk
EMAIL_FROM_EMAIL=onboarding@resend.dev

# Python Core Engine
PYTHON_CORE_ENGINE_URL=https://your-python-core-url.railway.app
```

### Step 3: Initial Data Population

**Option A: Start Fresh (Recommended for Clean Separation)**
```bash
# Local will auto-create database on first run
npm run dev

# Jobs will populate data from scratch
```

**Option B: Copy Production Data to Local**
```bash
# Export from production
mongodump --uri="mongodb+srv://user:pass@cluster/psx-trading-prod" --out=./db-backup

# Import to local
mongorestore --uri="mongodb+srv://user:pass@cluster/psx-trading-local" --nsFrom="psx-trading-prod.*" --nsTo="psx-trading-local.*" ./db-backup/psx-trading-prod

# Cleanup
rm -rf ./db-backup
```

**Option C: Automated Sync Script**

Create `scripts/sync-db.sh`:
```bash
#!/bin/bash
echo "🔄 Syncing production DB to local..."

# Load env vars
source .env

# Export prod
mongodump --uri="$PROD_DB_URI" --out=./temp-backup

# Import to local
mongorestore --uri="$MONGODB_URI" --drop ./temp-backup/psx-trading-prod

# Cleanup
rm -rf ./temp-backup

echo "✅ Sync complete!"
```

Usage:
```bash
chmod +x scripts/sync-db.sh
./scripts/sync-db.sh
```

## 🐍 Python Core Engine Configuration

Update your Python Core Engine to use the same database as Node.js backend.

**Local Python `.env`:**
```env
MONGODB_URI=mongodb+srv://psx-admin:pass@cluster/psx-trading-local
```

**Production Python `.env`:**
```env
MONGODB_URI=mongodb+srv://psx-admin:pass@cluster/psx-trading-prod
```

This ensures:
- ✅ Local Python → Local DB
- ✅ Prod Python → Prod DB
- ✅ No cross-contamination

## 🔐 Security Best Practices

1. **Different passwords** for local/prod users
2. **IP Whitelist** in production (not 0.0.0.0/0)
3. **Separate database users** with different permissions:
   ```javascript
   // Production: read/write
   db.createUser({
     user: "prod-app",
     pwd: "strong-password",
     roles: [{ role: "readWrite", db: "psx-trading-prod" }]
   })

   // Local: read/write + admin
   db.createUser({
     user: "local-dev",
     pwd: "dev-password",
     roles: [
       { role: "readWrite", db: "psx-trading-local" },
       { role: "dbAdmin", db: "psx-trading-local" }
     ]
   })
   ```

4. **Never commit** `.env` files
5. **Use Railway secrets** for production credentials

## 🎯 Job Scheduling Strategy

With separate databases, jobs run independently:

**Local (Development):**
- Price Polling: Every 30 minutes (less frequent)
- TradingView Update: Once daily
- Purpose: Enough data for testing

**Production (Live):**
- Price Polling: Every 5 minutes (real-time)
- TradingView Update: Daily at 5 PM
- Purpose: Serve real users

Configure different schedules in each environment via the UI.

## 🔄 Data Sync Strategy

### When to Sync:

1. **Initial setup**: Copy prod → local
2. **Major updates**: When prod has new symbols/data structure
3. **Testing**: When you need real data for backtesting

### How to Sync:

**Quick Sync (Collections Only):**
```bash
# Sync specific collections
mongodump --uri="prod-uri" --collection=symbols --out=./temp
mongorestore --uri="local-uri" ./temp --drop
rm -rf ./temp
```

**Full Sync:**
```bash
# Use Option B script above
```

**Selective Sync (Recommended):**
```bash
# Only sync reference data, not logs/executions
mongodump --uri="prod-uri" --collection=symbols --out=./temp
mongodump --uri="prod-uri" --collection=ohlcvdata --out=./temp
mongodump --uri="prod-uri" --collection=strategies --out=./temp

mongorestore --uri="local-uri" ./temp --drop
rm -rf ./temp
```

## 📊 Monitoring

### Local Development:
- MongoDB Compass: https://www.mongodb.com/products/compass
- View data visually
- Run queries
- Monitor performance

### Production:
- MongoDB Atlas Dashboard
- Set up alerts for:
  - High CPU usage
  - Storage > 80%
  - Connection spikes
  - Slow queries

## 🚀 Benefits of This Setup

| Feature | Benefit |
|---------|---------|
| **Separate Data** | No contamination between dev/prod |
| **Independent Jobs** | No dual execution issues |
| **Safe Testing** | Break things locally without fear |
| **Real Backtesting** | Sync prod data when needed |
| **Team Ready** | Each developer can have own local DB |
| **Scalable** | Easy to add staging environment later |

## 🔮 Future: Add Staging Environment

```
Local → Staging → Production

Local DB → Staging DB → Prod DB
  ↓          ↓            ↓
Testing → Pre-prod → Live Users
```

Just add another database: `psx-trading-staging`

## ❓ FAQ

**Q: Will this double my costs?**
A: No! MongoDB Atlas free tier (512MB) is enough for both databases.

**Q: How do I keep local data current?**
A: Run sync script weekly, or let local jobs populate naturally.

**Q: What about backtesting on real data?**
A: Sync prod → local before backtesting, or create read-only connection to prod.

**Q: Can I use one MongoDB cluster?**
A: Yes! Same cluster, different database names. Same connection string, just change `/database-name`.

**Q: What if I run out of space on free tier?**
A: Upgrade to M2 ($9/month) or clean old data with Log Cleanup job.

## 🆘 Troubleshooting

**Connection refused:**
- Check IP whitelist in Atlas
- Verify credentials
- Check network/firewall

**Slow queries:**
- Add indexes (already in models)
- Limit result sets
- Use pagination

**Out of space:**
- Run Log Cleanup job
- Delete old job executions
- Archive historical data

---

**Next Steps:** Follow Step 1-3 above to set up separate databases! 🚀

