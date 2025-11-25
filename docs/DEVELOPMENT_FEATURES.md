# Development Features & Testing

## Overview
Test and debug features automatically enabled in development mode, hidden in production.

## Quick Setup

### Development Mode (Enable All Test Features)
```env
# Backend
NODE_ENV=development

# Frontend (automatic via Vite)
npm run dev  # MODE=development
```

### Production Mode (Disable All Test Features)
```env
# Backend
NODE_ENV=production

# Frontend
npm run build  # MODE=production
```

### Manual Override (Dev Only)
Force disable test features even in dev mode:
```env
# Frontend .env.local
VITE_ENABLE_DEV_FEATURES=false
```

## Test Features Available in Development

### 1. Notification Testing
**Location**: Profile → Test Notifications tab

**Features**:
- 🔔 Basic System Notification
- 🎯 Magic Line Alert (simulates OGDC reaching Rs. 85.50)
- 💰 Trade Plan Buy Level (simulates PSO buy at Rs. 200-202)
- 🎉 Trade Plan Target Hit (simulates PSO TP1 at Rs. 210)
- ⚠️ Trade Plan Stop Loss (simulates PSO SL at Rs. 195)
- 👨‍💼 Admin Signal (admin only, simulates ENGRO signal)
- 📧 Email Testing with debug info

**Backend Endpoints** (auto-mounted in dev):
- `POST /api/notifications/test` - Basic notification
- `POST /api/notifications/test-magic-line` - Magic line alert
- `POST /api/notifications/test-trade-plan` - Trade plan signals
- `POST /api/notifications/test-admin` - Admin signal (admin only)
- `POST /api/notifications/test-email` - Direct email test
- `GET /api/notifications/email-debug` - Email config viewer

### 2. Dev Tools Panel
**Location**: Floating panel (bottom-right corner)

**Shows**:
- Current MODE (development/production)
- Feature flag status
- Environment info

### 3. Job Testing
**Location**: Jobs page

**Features**:
- "Run Now" buttons for manual job execution
- Real-time job status monitoring

## Code Organization

### Test Code Location
```
backend/src/test/
├── routes/
│   └── notificationTests.js    # All test endpoints
└── (future test utilities)

frontend/src/test/
├── components/
│   ├── NotificationTester.jsx  # Test UI
│   └── DevToolsPanel.jsx       # Dev tools
└── (future test components)
```

### Conditional Loading
**Backend** (`backend/src/index.js`):
```javascript
// Test routes only mounted in development
if (process.env.NODE_ENV === 'development') {
  const testRoutes = await import('./test/routes/notificationTests.js');
  app.use('/api/notifications', testRoutes.default);
}
```

**Frontend** (`frontend/src/components/Profile.jsx`):
```javascript
// Lazy load test component only in development
const NotificationTester = import.meta.env.MODE === 'development' 
  ? lazy(() => import('../test/components/NotificationTester'))
  : null;
```

## Adding New Test Features

### Backend Test Endpoint
1. Add endpoint to `backend/src/test/routes/notificationTests.js`:
```javascript
router.post('/test-my-feature', authenticate, requireFeature('test'), async (req, res) => {
  try {
    // Your test logic
    res.json({ success: true, message: 'Test completed' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

2. `requireFeature('test')` automatically returns 403 in production

### Frontend Test Component
1. Create component in `frontend/src/test/components/`:
```javascript
export default function MyTestComponent() {
  // Your test UI
}
```

2. Import conditionally:
```javascript
const MyTestComponent = import.meta.env.MODE === 'development' 
  ? lazy(() => import('../test/components/MyTestComponent'))
  : null;
```

3. Render with check:
```javascript
{MyTestComponent && (
  <Suspense fallback={<div>Loading...</div>}>
    <MyTestComponent />
  </Suspense>
)}
```

## Production Safety

### What Happens in Production
✅ Test tabs completely hidden (not rendered)  
✅ Test components excluded from build (tree-shaking)  
✅ Test endpoints return 403 Forbidden  
✅ Dev tools panel not rendered  
✅ No test code in production bundle

### Verification
1. Set `NODE_ENV=production` in backend
2. Run `npm run build` for frontend
3. Check:
   - Test tab not visible in Profile
   - DevToolsPanel not rendered
   - Test endpoints return 403
   - Production bundle size smaller (no test code)

## Best Practices

1. **Never put test logic in production files** - Keep test code isolated in `test/` folders
2. **Use conditional imports** - Lazy load test components only in dev mode
3. **Protect endpoints** - Always use `requireFeature('test')` middleware
4. **No production dependencies** - Test features shouldn't affect production functionality
5. **Document test features** - Add to this file when creating new test tools
