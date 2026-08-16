# Notification System Guide

## Overview
Production-ready notification system for Financial Reading with in-app, email, and real-time delivery.

## Features

### User-Facing
- **In-App Notifications** - Bell icon with unread badge
- **Email Notifications** - HTML templates with priority styling
- **Real-time Updates** - WebSocket delivery for instant alerts
- **Notification History** - Full page with filtering and pagination
- **User Preferences** - Granular control over notification types and channels

### Notification Types
1. **Magic Line Alerts** - Strategic price level reached
2. **Trade Plan Signals** - Buy level, Target hit, Stop Loss triggered
3. **System Alerts** - Important system notifications
4. **Admin Notifications** - Trading signals and system events

## Architecture

### Backend (`backend/src/`)
```
models/
├── Notification.js          # Notification storage
└── NotificationPreference.js # User preferences

services/
├── notificationService.js   # Core notification logic
└── emailService.js          # Email delivery

routes/
└── notifications.js         # API endpoints
```

### Frontend (`frontend/src/`)
```
components/
├── NotificationBell.jsx     # Header bell icon
├── Notifications.jsx        # Full page view
└── NotificationPreferences.jsx # Settings UI

services/
└── notifications.js         # API client
```

## API Endpoints

### User Endpoints
- `GET /api/notifications` - List with filters (page, limit, read, type, priority)
- `GET /api/notifications/unread-count` - Get badge count
- `PUT /api/notifications/:id/read` - Mark single as read
- `PUT /api/notifications/mark-all-read` - Bulk mark as read
- `DELETE /api/notifications/:id` - Delete single notification
- `DELETE /api/notifications/clear-read` - Clear all read notifications
- `GET /api/notifications/preferences` - Get user preferences
- `PUT /api/notifications/preferences` - Update preferences
- `GET /api/notifications/features` - Get available notification features

## Usage

### Sending Notifications (Backend)
```javascript
import notificationService from '../services/notificationService.js';

// Magic Line alert
await notificationService.notifyStrategicLevelMet(
  'OGDC',    // symbol
  85.00,     // currentPrice
  85.50,     // strategicLevel
  userId     // optional: specific user, omit for all users
);

// Trade Plan buy level
await notificationService.notifyTradePlanBuyLevel(
  tradePlan,  // trade plan object
  buyLevel,   // { level: 1, priceFrom: 200, priceTo: 202 }
  userId      // optional
);

// Trade Plan target hit
await notificationService.notifyTradePlanTarget(
  tradePlan,
  target,     // { level: 1, price: 210 }
  userId
);

// Trade Plan stop loss
await notificationService.notifyTradePlanStopLoss(
  tradePlan,
  stopLoss,   // { price: 195 }
  userId
);

// Admin signal
await notificationService.notifySignalGenerated(
  signal,     // signal object
  userId
);
```

### User Preferences
Users can control:
- **Channels**: In-app, Email, SMS (future)
- **Features**: Enable/disable specific notification types
- **Quiet Hours**: Suppress non-critical notifications during specified hours
- **Digest Mode**: Batch notifications into periodic summaries

### Priority Levels
- **high** - Critical alerts (stop loss, urgent admin)
- **medium** - Important updates (targets, buy levels)
- **low** - Info notifications (system updates)

## Email Configuration

Supports multiple email providers:

### Resend (Recommended)
```env
RESEND_API_KEY=re_your_key_here
EMAIL_FROM_EMAIL=notifications@yourdomain.com
EMAIL_FROM_NAME="Financial Reading"
```

### SMTP (Gmail, etc.)
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM_EMAIL=your-email@gmail.com
EMAIL_FROM_NAME="Financial Reading"
```

## Testing
See [DEVELOPMENT_FEATURES.md](./DEVELOPMENT_FEATURES.md) for test tools available in development mode.
