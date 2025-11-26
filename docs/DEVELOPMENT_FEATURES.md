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

### 1. Testing Page
**Location**: `/testing` route (or via DevToolsPanel button)

**Access**:
- Navigate to `/testing` directly
- Click "Open Testing Page" button in DevToolsPanel (bottom-right)

### 2. Notification Testing
**Location**: Testing Page → Notification Testing tab

**Features**:
- 🔔 Basic System Notification
- 🎯 Magic Line Alert (simulates OGDC reaching Rs. 85.50)
- 💰 Trade Plan Buy Level (simulates PSO buy at Rs. 200-202)
- 🎉 Trade Plan Target Hit (simulates PSO TP1 at Rs. 210)
- ⚠️ Trade Plan Stop Loss (simulates PSO SL at Rs. 195)
- 👨‍💼 Admin Signal (admin only, simulates ENGRO signal)
- 📧 Email Testing with debug info

### 3. Magic Line Testing
**Location**: Testing Page → Magic Line Testing tab

**Features**:
- 🔄 **Trigger Magic Line Check** - Manually run the monitoring process to check all symbols
- 🎯 **Mock Magic Line Met** - Simulate a symbol reaching its magic line using actual production logic
- 📊 View all active magic lines with current status
- 📝 Real-time test results log

**How Mock Testing Works**:
The mock test simulates **actual production behavior** with a 2-step process:
1. **Step 1 - Set Pending**: Price set below magic line → Handler runs → Status becomes "pending"
2. **Step 2 - Trigger Met**: Price set above magic line → Handler runs → Status becomes "met" & notification sent
3. **Cleanup**: Original price and status restored after test

This ensures tests match the complete pending→met cycle exactly as it happens in production.

**Benefits**:
- ✅ Tests use the same code path as production
- ✅ Simulates complete status transition cycle
- ✅ No manual status manipulation needed
- ✅ Always triggers notification regardless of current state
- ✅ Safe - original data restored after test

**Use Cases**:
- Test if magic line notifications work without waiting for market hours
- Verify notification delivery for specific symbols
- Debug magic line monitoring logic without altering production data
- Validate status transitions and notification triggers

### 4. Trade Plan Testing
**Location**: Testing Page → Trade Plan Testing tab

**Features**:
- 🔄 **Trigger Trade Plan Check** - Manually run monitoring for all active trade plans
- 💰 **Mock Buy Level** - Simulate price entering a buy level range
- 🎯 **Mock Target** - Simulate price reaching a target level
- ⚠️ **Mock Stop Loss** - Simulate price hitting stop loss
- 🔄 **Reset Plan** - Clear all hits to test the same plan multiple times
- 📊 View active trade plans with status
- 📝 Real-time test results log

**How Mock Testing Works**:
Each scenario test uses **actual production logic**:
1. **Buy Level**: Sets price within unhit buy level range → Runs handler → Triggers buy notification
2. **Target**: Sets price to meet target (requires buy level hit) → Runs handler → Triggers target notification  
3. **Stop Loss**: Sets price to trigger SL (requires buy level hit) → Runs handler → Closes trade & sends notification

The tests temporarily set mock prices and execute the real trade plan handler, ensuring tests match production behavior exactly.

**Testing Workflow**:
1. Select a trade plan from dropdown
2. Test scenarios in sequence (Buy Level → Target/Stop Loss)
3. Use "Reset Plan" button to clear all hits
4. Test the same plan again with different scenarios

**Test Requirements**:
- Targets and Stop Loss can only be tested after a buy level is hit (matches production logic)
- Use Reset button to unmark all levels and test multiple cycles on the same plan
- Each test validates the complete flow including notifications, status updates, and trade closure logic
- Original prices are always restored after tests

**Use Cases**:
- Test all trade plan scenarios without waiting for market conditions
- Verify buy level, target, and stop loss notifications
- Validate trade closure logic when SL hits or all targets complete
- Debug trade plan monitoring without affecting real data

**Backend Endpoints** (auto-mounted in dev):
- `POST /api/notifications/test` - Basic notification
- `POST /api/notifications/test-magic-line` - Magic line alert
- `POST /api/notifications/test-trade-plan` - Trade plan signals
- `POST /api/notifications/test-admin` - Admin signal (admin only)
- `POST /api/notifications/test-email` - Direct email test
- `GET /api/notifications/email-debug` - Email config viewer
- `POST /api/notifications/test-magic-line-trigger` - Trigger magic line check
- `POST /api/notifications/test-magic-line-mock` - Mock magic line met for symbol

### 4. Dev Tools Panel
**Location**: Floating panel (bottom-right corner)

**Shows**:
- Current MODE (development/production)
- Feature flag status
- Quick link to Testing Page
- Environment info

### 5. Job Testing
**Location**: Jobs page

**Features**:
- "Run Now" buttons for manual job execution
- Real-time job status monitoring

**Note**: Future test features can be added as tabs to the Testing Page.

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
