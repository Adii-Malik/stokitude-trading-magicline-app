# Email Setup Guide

This guide explains how to configure email functionality for password reset and notifications.

## How Email Works

The email service checks if credentials are configured:

### Without Email Credentials (Default)
- No email configuration needed
- Emails are NOT actually sent
- Logs show what would be sent
- Password reset won't work (no email to get link)
- Perfect for development when not testing email

### With Email Credentials
- Emails are actually sent via SMTP
- Works in both development and production
- Users receive real password reset emails
- Required for production use

## Email Setup

### Option 1: Gmail

1. **Enable 2-Factor Authentication** on your Google account
2. **Generate App Password**:
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and your device
   - Copy the 16-character password

3. **Configure .env**:
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

For production, also set:
```env
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com
```

⚠️ **Important**: Use App Password, NOT your regular Gmail password

### Option 2: Custom SMTP
Use any SMTP service (SendGrid, Mailgun, AWS SES, etc.)

```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=apikey
EMAIL_PASSWORD=your-api-key
EMAIL_FROM_NAME=PSX SmartDesk
EMAIL_FROM_EMAIL=noreply@yourdomain.com
FRONTEND_URL=http://localhost:5173
```

For production, also set:
```env
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com
```

## Email Templates

### Password Reset Email
Sent when user requests password reset via "Forgot Password"

**Features**:
- Professional HTML design
- Reset button with direct link
- Token displayed as backup
- 1-hour expiration notice
- Security warnings

### Welcome Email (Optional)
Can be sent when admin activates a user account.

## Testing Emails

### Development Mode
1. Request password reset
2. Check console for preview URL
3. Open URL to see email in browser
4. Copy reset token from email or console

### Production Mode
1. Use a real email address
2. Check inbox (and spam folder)
3. Click reset link or copy token

## Troubleshooting

### Gmail: "Less secure app" error
- Enable 2FA and use App Password (see setup above)
- Don't use regular password

### Emails not sending
- Check console logs for errors
- Verify SMTP credentials
- Check firewall/network settings
- Test with Ethereal first (development mode)

### Reset link not working
- Verify `FRONTEND_URL` matches your actual frontend URL
- Token expires in 1 hour
- Token is single-use only

## Security Best Practices

1. **Never commit .env file** - already in .gitignore
2. **Use App Passwords** for Gmail, not regular passwords
3. **Use environment variables** in production
4. **Rotate credentials** regularly
5. **Monitor email logs** for suspicious activity

## Production Recommendations

For production, consider using a dedicated email service:

- **SendGrid**: 100 emails/day free
- **Mailgun**: 5000 emails/month free  
- **AWS SES**: $0.10 per 1000 emails
- **Postmark**: Excellent deliverability

These services provide:
- Better deliverability
- Email analytics
- Bounce handling
- Template management
- Higher sending limits

