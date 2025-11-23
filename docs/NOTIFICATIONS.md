# Notification System Documentation

## Overview

A comprehensive, modular notification system for PSX SmartDesk that alerts users about important trading events and system updates.

## Architecture

### Backend Components

#### 1. **Notification Model** (`backend/src/models/Notification.js`)
Stores notification records with:
- **Types**: strategic_level_met, trade_plan_buy_level, trade_plan_target, trade_plan_stop_loss, trade_plan_created, signal_generated, strategy_opportunity, system_alert, price_alert, admin_announcement
- **Priority Levels**: low, medium, high, urgent
- **Delivery Channels**: email, push (future), inApp
- **Status Tracking**: read/unread, delivery status per channel
- **Auto-expiry**: TTL index for automatic cleanup

#### 2. **NotificationPreference Model** (`backend/src/models/NotificationPreference.js`)
User-specific notification preferences:
- Global enable/disable toggle
- Per-channel preferences (email, push, in-app)
- Per-type preferences (granular control)
- Quiet hours (no notifications during sleep time)
- Digest settings (batch notifications - future)

#### 3. **NotificationService** (`backend/src/services/notificationService.js`)
Central service for sending notifications:
- **Methods**:
  - `send()` - Send to single or multiple users
  - `notifyAdmins()` - Send to all admins
  - `notifyAll()` - Send to all users
  - `notifyStrategicLevelMet()` - Strategic level hit
  - `notifyTradePlanBuyLevel()` - Buy level hit
  - `notifyTradePlanTarget()` - Target hit
  - `notifyTradePlanStopLoss()` - Stop loss hit
  - `notifyTradePlanCreated()` - New trade plan
  - `notifySignalGenerated()` - Trading signal generated

#### 4. **Email Integration**
Enhanced email service with notification support:
- Priority-based styling (color coding)
- Action buttons (deep links to specific pages)
- Responsive HTML templates
- Preference management links

### API Endpoints (`backend/src/routes/notifications.js`)

```
GET    /api/notifications              - Get user's notifications (paginated, filterable)
GET    /api/notifications/unread-count - Get unread notification count
PUT    /api/notifications/:id/read     - Mark notification as read
PUT    /api/notifications/mark-all-read - Mark all as read
DELETE /api/notifications/:id          - Delete a notification
DELETE /api/notifications/clear-read   - Delete all read notifications
GET    /api/notifications/preferences  - Get notification preferences
PUT    /api/notifications/preferences  - Update preferences
POST   /api/notifications/test         - Send test notification
```

### Integration Points

#### 1. **Magic Line Handler**
- Sends notification when strategic level is met
- Notifies all users by default

#### 2. **Trade Plan Handler**
- Buy level hit → High priority notification
- Target hit → High priority notification  
- Stop loss hit → Urgent priority notification
- Notifies all users by default

#### 3. **Trade Plan Creation**
- New trade plan → Medium priority notification
- Notifies all users

#### 4. **Signal Generation** (Future)
- New signal → High priority notification
- Notifies admins only by default

## Notification Types & Defaults

| Type | Email | Push | In-App | Priority | Default Recipients |
|------|-------|------|--------|----------|-------------------|
| Strategic Level Met | ✓ | ✗ | ✓ | High | All Users |
| Buy Level Hit | ✓ | ✗ | ✓ | High | All Users |
| Target Hit | ✓ | ✗ | ✓ | High | All Users |
| Stop Loss Hit | ✓ | ✗ | ✓ | Urgent | All Users |
| Trade Plan Created | ✗ | ✗ | ✓ | Medium | All Users |
| Signal Generated | ✓ | ✗ | ✓ | High | Admins Only |
| Strategy Opportunity | ✗ | ✗ | ✓ | Medium | Admins Only |
| System Alert | ✓ | ✗ | ✓ | High | All Users |
| Price Alert | ✓ | ✗ | ✓ | High | Specific User |
| Admin Announcement | ✓ | ✗ | ✓ | Medium | All Users |

## User Preferences

Users can customize notifications per their preferences:

### Global Settings
- Enable/disable all notifications
- Set quiet hours (no notifications during sleep)
- Configure digest frequency (future)

### Per-Type Settings
For each notification type, users can:
- Enable/disable the notification type entirely
- Toggle email delivery
- Toggle push notifications (when available)
- Toggle in-app display

### Per-Channel Settings
- Email: Enable/disable, set custom email address
- Push: Enable/disable (future)
- In-App: Enable/disable

## Frontend Integration (To Be Implemented)

### Components Needed

1. **Notification Bell Icon** (Header)
   - Shows unread count badge
   - Opens notification dropdown/panel
   - Real-time updates via Socket.IO

2. **Notification Panel** (Dropdown/Sidebar)
   - List of recent notifications
   - Mark as read/unread
   - Delete notifications
   - Filter by type/priority
   - "Mark all as read" button
   - "View all" link to full page

3. **Notifications Page** (Full View)
   - Paginated list
   - Advanced filtering (type, priority, date range)
   - Bulk actions
   - Clear read notifications

4. **Notification Preferences** (Profile/Settings)
   - Global toggle
   - Channel toggles
   - Per-type preferences grid
   - Quiet hours settings
   - Test notification button

### Real-time Updates

Use Socket.IO to:
- Push new notifications instantly
- Update unread count in real-time
- Show toast/banner for urgent notifications

## Email Templates

Notifications are sent with styled HTML emails featuring:
- Priority color coding (gray=low, cyan=medium, yellow=high, red=urgent)
- Clear title and message
- Action button linking to relevant page
- Preference management link
- Responsive design

## Future Enhancements

### Phase 2 - Push Notifications
- Web Push API integration
- Service Worker implementation
- Push notification preferences
- Device registration

### Phase 3 - Advanced Features
- Notification digest (daily/weekly email summary)
- Custom price alerts (user-defined)
- SMS notifications (via Twilio)
- Telegram/Discord webhooks
- Notification templates (admin-customizable)
- Notification analytics (open rates, click rates)

### Phase 4 - Intelligence
- Smart notification bundling (group similar notifications)
- AI-powered notification prioritization
- Notification muting (snooze specific types)
- Do Not Disturb mode
- Notification scheduling

## Testing

### Backend Testing
```bash
# Send test notification
curl -X POST http://localhost:5000/api/notifications/test \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Manual Testing Checklist
- [ ] Strategic level met notification
- [ ] Buy level hit notification
- [ ] Target hit notification  
- [ ] Stop loss hit notification
- [ ] New trade plan notification
- [ ] Email delivery
- [ ] Preference changes respected
- [ ] Quiet hours working
- [ ] Mark as read/unread
- [ ] Delete notifications
- [ ] Unread count accuracy

## Database Maintenance

### Automatic Cleanup
- Notifications auto-expire based on `expiresAt` field (default: 30 days)
- MongoDB TTL index handles deletion automatically

### Manual Cleanup
```javascript
// Clean up old read notifications (30+ days)
const count = await Notification.cleanupOld(30);
console.log(`Deleted ${count} old notifications`);
```

## Security Considerations

1. **Authorization**: All endpoints require authentication
2. **User Isolation**: Users can only access their own notifications
3. **Admin Privileges**: Only admins can send system-wide announcements
4. **Rate Limiting**: Consider implementing rate limits for notification creation
5. **Email Validation**: Validate email addresses in preferences

## Performance Optimization

1. **Indexes**: Created on userId, read, type, createdAt for efficient queries
2. **Pagination**: All list endpoints support pagination
3. **Async Delivery**: Email sending doesn't block main thread
4. **TTL Index**: Auto-cleanup prevents database bloat
5. **Selective Loading**: Only load necessary fields in list views

## Configuration

### Environment Variables
```env
# Email settings (already configured)
EMAIL_PROVIDER=smtp|sendgrid|brevo|resend
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=PSX SmartDesk
FRONTEND_URL=https://yourdomain.com

# Future: Push notification settings
# VAPID_PUBLIC_KEY=...
# VAPID_PRIVATE_KEY=...
```

### Default Settings
- Notification expiry: 30 days
- Default quiet hours: 22:00 - 08:00 (disabled by default)
- Max notifications per page: 20
- Unread count badge max: 99+

## API Usage Examples

### Get Notifications
```javascript
// Get unread notifications
GET /api/notifications?read=false&page=1&limit=20

// Get high priority notifications
GET /api/notifications?priority=high

// Get trade plan notifications
GET /api/notifications?type=trade_plan_target
```

### Update Preferences
```javascript
PUT /api/notifications/preferences
{
  "types": {
    "strategic_level_met": {
      "enabled": true,
      "email": true,
      "inApp": true
    }
  },
  "quietHours": {
    "enabled": true,
    "startTime": "23:00",
    "endTime": "07:00"
  }
}
```

### Send Custom Notification (Admin)
```javascript
// Using notificationService in backend code
await notificationService.send({
  userId: '123...',  // or array of IDs
  type: 'admin_announcement',
  title: 'Scheduled Maintenance',
  message: 'System will be down for maintenance on Sunday',
  priority: 'high',
  actionUrl: '/announcements'
});
```

## Support

For issues or questions:
1. Check notification preferences
2. Verify email service configuration
3. Check browser console for errors
4. Review server logs for delivery failures
5. Test with `/api/notifications/test` endpoint

