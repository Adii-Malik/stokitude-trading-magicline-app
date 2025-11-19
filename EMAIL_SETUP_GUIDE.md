# Email Setup Guide

Dynamic multi-provider email system. Configure one provider and you're done!

## 🎯 Quick Start

### Step 1: Choose a Provider

Edit `backend/src/services/email/providers/index.js` to enable/disable providers:

```javascript
export default [
  ResendProvider,    // Recommended
  SendGridProvider,  // Optional
  SmtpProvider       // Optional
];
```

### Step 2: Configure Environment Variables

Add **ONE** of these to your `.env` file:

---

## 📧 Available Providers

### 1. Resend ⭐ (Recommended)

**Best for**: Railway, Vercel, any platform  
**Free tier**: 3,000 emails/month, 100/day  
**Setup time**: 2 minutes

#### Setup:
1. Sign up at https://resend.com
2. Get API key from dashboard
3. Add to `.env`:

```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM_NAME=PSX SmartDesk
EMAIL_FROM_EMAIL=onboarding@resend.dev
FRONTEND_URL=http://localhost:5173
```

**Note**: Use `onboarding@resend.dev` for testing, then verify your own domain.

---

### 2. SendGrid

**Best for**: High reliability  
**Free tier**: 100 emails/day (3,000/month)  
**Requires**: `npm install @sendgrid/mail`

#### Setup:
1. Sign up at https://sendgrid.com
2. Create API key
3. Add to `.env`:

```env
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
EMAIL_FROM_NAME=PSX SmartDesk
EMAIL_FROM_EMAIL=noreply@yourdomain.com
FRONTEND_URL=http://localhost:5173
```

---

### 3. Brevo (formerly SendInBlue)

**Best for**: High volume development  
**Free tier**: 300 emails/day (9,000/month)  
**Requires**: `npm install @sendinblue/client`

#### Setup:
1. Sign up at https://brevo.com
2. Get API key
3. Add to `.env`:

```env
BREVO_API_KEY=xkeysib-xxxxxxxxxxxxx
EMAIL_FROM_NAME=PSX SmartDesk
EMAIL_FROM_EMAIL=noreply@yourdomain.com
FRONTEND_URL=http://localhost:5173
```

---

### 4. Gmail / SMTP

**Best for**: VPS hosting, local development  
**Free tier**: 500 emails/day  
**⚠️ Warning**: Blocked on Railway Free/Hobby, Vercel, Netlify

#### Gmail Setup:
1. Enable 2-Factor Authentication
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Add to `.env`:

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-16-char-app-password
EMAIL_FROM_NAME=PSX SmartDesk
EMAIL_FROM_EMAIL=your-email@gmail.com
FRONTEND_URL=http://localhost:5173
```

#### Custom SMTP:
```env
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-username
EMAIL_PASSWORD=your-password
EMAIL_FROM_NAME=PSX SmartDesk
EMAIL_FROM_EMAIL=noreply@yourdomain.com
FRONTEND_URL=http://localhost:5173
```

---

## 🔧 How Provider Selection Works

The system automatically:
1. **Loops through providers** in order (from `index.js`)
2. **Checks if configured** (env vars present)
3. **Tries to initialize** the first configured provider
4. **Uses it** for all emails

**No provider configured?** → Logs to console only (perfect for local dev)

---

## 🚀 Production Setup

### Railway / Vercel / Netlify
**Use Resend** (SMTP is blocked on free plans)

Railway Dashboard → Variables:
```
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM_NAME=PSX SmartDesk
EMAIL_FROM_EMAIL=onboarding@resend.dev
FRONTEND_URL=https://yourdomain.com
```

### VPS / AWS / DigitalOcean
**Any provider works** (SMTP included)

---

## 🎨 Adding a New Provider

1. Create `backend/src/services/email/providers/YourProvider.js`:

```javascript
import BaseProvider from './BaseProvider.js';

export default class YourProvider extends BaseProvider {
  getName() { return 'YourService'; }
  
  isConfigured() {
    return !!this.config.yourApiKey;
  }
  
  async initialize() {
    // Setup code
    this.initialized = true;
    return true;
  }
  
  async send({ from, to, subject, html, text }) {
    // Send email logic
    return { success: true, messageId: '...' };
  }
}
```

2. Add to `index.js`:
```javascript
import YourProvider from './YourProvider.js';

export default [
  YourProvider,  // ← Add here
  ResendProvider
];
```

3. Add config to `backend/src/config/config.js`:
```javascript
yourApiKey: process.env.YOUR_API_KEY || ''
```

Done! No changes to `emailService.js` needed.

---

## 📊 Provider Comparison

| Provider | Free Tier | Protocol | Railway Free | VPS/AWS | Package Required |
|----------|-----------|----------|--------------|---------|------------------|
| **Resend** | 3000/month | HTTPS | ✅ Yes | ✅ Yes | ✅ Built-in |
| **SendGrid** | 100/day | HTTPS | ✅ Yes | ✅ Yes | `@sendgrid/mail` |
| **Brevo** | 300/day | HTTPS | ✅ Yes | ✅ Yes | `@sendinblue/client` |
| **Gmail/SMTP** | 500/day | SMTP | ❌ No | ✅ Yes | ✅ Built-in |

---

## 🧪 Testing

### Without Email (Console Only)
Don't configure any provider. Emails will be logged to console.

### With Email
1. Configure a provider
2. Request password reset
3. Check email or console logs
4. Click reset link

---

## ❌ Troubleshooting

### "No provider configured"
→ Add env vars for at least one provider

### Gmail: "Less secure app" error
→ Use App Password, not regular password (requires 2FA)

### SMTP timeout on Railway
→ SMTP is blocked on Free/Hobby plans. Use Resend instead.

### SendGrid/Brevo package error
→ Run `npm install @sendgrid/mail` or `npm install @sendinblue/client`

### Reset link not working
→ Check `FRONTEND_URL` matches your actual domain

---

## 🔒 Security

- ✅ Never commit `.env` file
- ✅ Use App Passwords for Gmail
- ✅ Rotate API keys regularly
- ✅ Monitor email logs
- ✅ Use HTTPS in production

---

## 🎯 Recommendations

| Scenario | Best Provider |
|----------|--------------|
| **Railway/Vercel/Netlify** | Resend |
| **High volume dev** | Brevo (300/day) |
| **VPS/self-hosted** | Gmail or Resend |
| **Enterprise** | SendGrid |
| **Zero config dev** | None (console only) |

