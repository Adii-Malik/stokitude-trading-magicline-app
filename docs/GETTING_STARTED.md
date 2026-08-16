# Financial Reading - Getting Started

Installation guide, database setup, email configuration, and deployment instructions.

---

## Database Setup

### Option 1: MongoDB Atlas (Recommended)

**Free tier: 512MB storage**

#### Setup Steps

1. Go to https://cloud.mongodb.com
2. Create free cluster
3. Create TWO databases:
   - `psx-trading-local` (Development)
   - `psx-trading-prod` (Production)

#### Benefits
- ✅ Free
- ✅ Same cluster, different databases
- ✅ Easy sync between local/prod
- ✅ Cloud-based (access from anywhere)

#### Connection Strings

**Local:**
```env
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/psx-trading-local
```

**Production:**
```env
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/psx-trading-prod
```

### Option 2: Local MongoDB

**Setup:**
1. Install MongoDB: https://www.mongodb.com/try/download/community
2. Use local MongoDB for development
3. Use Atlas for production

**Connection Strings:**
```env
# Local
MONGODB_URI=mongodb://localhost:27017/psx-trading-local

# Production
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/psx-trading-prod
```

---

## Email Setup

### Provider Options

#### 1. Resend ⭐ (Recommended)

**Free tier:** 3,000 emails/month, 100/day  
**Setup time:** 2 minutes

**Setup:**
1. Sign up at https://resend.com
2. Get API key from dashboard
3. Add to `.env`:

```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM_NAME=Financial Reading
EMAIL_FROM_EMAIL=onboarding@resend.dev
FRONTEND_URL=http://localhost:5173
```

**Note:** Use `onboarding@resend.dev` for testing, then verify your own domain.

#### 2. SendGrid

**Free tier:** 100 emails/day  
**Requires:** `npm install @sendgrid/mail`

```env
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
EMAIL_FROM_NAME=Financial Reading
EMAIL_FROM_EMAIL=noreply@yourdomain.com
FRONTEND_URL=http://localhost:5173
```

#### 3. Gmail SMTP

**Free tier:** 500 emails/day  
**⚠️ Warning:** Blocked on Railway Free/Hobby, Vercel, Netlify

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-16-char-app-password
EMAIL_FROM_NAME=Financial Reading
EMAIL_FROM_EMAIL=your-email@gmail.com
FRONTEND_URL=http://localhost:5173
```

**Gmail App Password:**
1. Enable 2-Factor Authentication
2. Generate App Password: https://myaccount.google.com/apppasswords

### Email Configuration

The system automatically:
1. Loops through providers in order
2. Checks if configured (env vars present)
3. Tries to initialize the first configured provider
4. Uses it for all emails

**No provider configured?** → Logs to console only (perfect for local dev)

---

## Environment Configuration

### Backend .env

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/psx_smartdesk

# JWT Authentication (REQUIRED - Change in production!)
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long
JWT_EXPIRES_IN=7d

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# Email (Choose ONE provider)
RESEND_API_KEY=re_xxxxxxxxxxxxx
# OR
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
# OR
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# Email Settings
EMAIL_FROM_NAME=Financial Reading
EMAIL_FROM_EMAIL=onboarding@resend.dev

# Price Polling (Optional)
POLLING_INTERVAL=15  # minutes

# Python Core Engine (for Trading Bot)
PYTHON_CORE_ENGINE_URL=http://localhost:8000
```

### Frontend .env (Optional)

```env
VITE_API_URL=http://localhost:5000/api
```

---

## Initial Setup

### 1. Install Dependencies

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd frontend
npm install
```

### 2. Create Super Admin

```bash
cd backend
npm run create-admin
```

Follow the prompts to create your first super admin account.

### 3. Start Development

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

---

## Production Deployment

### Railway Deployment

1. **Create Project:**
   - Connect GitHub repository
   - Railway auto-detects Node.js

2. **Configure Environment Variables:**
```
MONGODB_URI=mongodb+srv://user:pass@cluster/psx-trading-prod
JWT_SECRET=your-production-secret-key
NODE_ENV=production
FRONTEND_URL=https://your-app.railway.app
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM_NAME=Financial Reading
EMAIL_FROM_EMAIL=onboarding@resend.dev
```

3. **Deploy:**
   - Push to main branch
   - Railway auto-deploys

### Fly.io Deployment

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Launch app
fly launch

# Set secrets
fly secrets set JWT_SECRET=your-secret-here
fly secrets set MONGODB_URI=your-mongo-connection-string
fly secrets set RESEND_API_KEY=your-resend-key

# Deploy
fly deploy

# Check status
fly status

# View logs
fly logs
```

---

## Database Synchronization

### When to Sync

1. Initial setup: Copy prod → local
2. Major updates: When prod has new symbols/data
3. Testing: When you need real data for backtesting

### Sync Script

```bash
# Export from production
mongodump --uri="mongodb+srv://user:pass@cluster/psx-trading-prod" --out=./db-backup

# Import to local
mongorestore --uri="mongodb://localhost:27017/psx-trading-local" --drop ./db-backup/psx-trading-prod

# Cleanup
rm -rf ./db-backup
```

### Selective Sync (Recommended)

```bash
# Only sync reference data, not logs/executions
mongodump --uri="prod-uri" --collection=stocks --out=./temp
mongodump --uri="prod-uri" --collection=magiclines --out=./temp
mongodump --uri="prod-uri" --collection=tradeplans --out=./temp

mongorestore --uri="local-uri" ./temp --drop
rm -rf ./temp
```

---

## Security Checklist

### MongoDB Security

1. **Different passwords** for local/prod users
2. **IP Whitelist** in production (not 0.0.0.0/0)
3. **Separate database users** with different permissions

### Application Security

1. **Change JWT_SECRET** in production (use strong random string)
2. **Use HTTPS** in production
3. **Secure MongoDB** with authentication
4. **Never commit** `.env` files
5. **Use secrets** for production credentials (Railway/Fly.io)

---

## Monitoring

### Local Development
- MongoDB Compass: https://www.mongodb.com/products/compass
- View data visually
- Run queries
- Monitor performance

### Production
- MongoDB Atlas Dashboard
- Set up alerts for:
  - High CPU usage
  - Storage > 80%
  - Connection spikes
  - Slow queries

---

## Troubleshooting

### MongoDB Connection Issues

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

### Email Issues

**"No provider configured":**
- Add env vars for at least one provider

**Gmail: "Less secure app" error:**
- Use App Password, not regular password (requires 2FA)

**SMTP timeout on Railway:**
- SMTP is blocked on Free/Hobby plans
- Use Resend instead

**SendGrid/Brevo package error:**
- Run `npm install @sendgrid/mail` or `npm install @sendinblue/client`

**Reset link not working:**
- Check `FRONTEND_URL` matches your actual domain

---

## Benefits of Separate Databases

| Feature | Benefit |
|---------|---------|
| **Separate Data** | No contamination between dev/prod |
| **Independent Jobs** | No dual execution issues |
| **Safe Testing** | Break things locally without fear |
| **Real Backtesting** | Sync prod data when needed |
| **Team Ready** | Each developer can have own local DB |
| **Scalable** | Easy to add staging environment later |

---

## Cost Summary

| Component | Service | Free Tier | Cost |
|-----------|---------|-----------|------|
| **Database** | MongoDB Atlas | 512MB | $0 |
| **Email** | Resend | 3,000/month | $0 |
| **Hosting** | Railway/Fly.io | Varies | $0-5/month |
| **Total** | | | **$0-5/month** |

---

## Next Steps

1. ✅ Complete environment configuration
2. ✅ Choose and configure email provider
3. ✅ Set up separate local/prod databases
4. ✅ Create super admin account
5. ✅ Test email functionality
6. ✅ Deploy to production
7. ✅ Configure monitoring and alerts

