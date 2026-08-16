# Financial Reading - Frontend Technical Documentation

## Technology Stack

- **Framework:** React 18+ with Vite
- **Routing:** React Router DOM v6
- **Styling:** Tailwind CSS v3
- **State Management:** React Context API
- **Real-time:** Socket.IO Client
- **HTTP Client:** Axios
- **Icons:** Lucide React
- **Notifications:** React Hot Toast
- **File Upload:** React Dropzone
- **Build Tool:** Vite

---

## Project Structure

```
frontend/
├── public/
├── src/
│   ├── components/
│   │   ├── AdminDashboard.jsx    # User management (admin)
│   │   ├── Dashboard.jsx         # Main overview page
│   │   ├── Header.jsx            # Navigation header
│   │   ├── Landing.jsx           # Public landing page
│   │   ├── Login.jsx             # Login form
│   │   ├── MagicLine.jsx         # Magic line feature
│   │   ├── Settings.jsx          # Settings page (admin)
│   │   ├── Signup.jsx            # Signup form
│   │   ├── StockManagement.jsx   # Stock management (admin)
│   │   ├── TradePlans.jsx        # Trade plans feature
│   │   └── UploadForm.jsx        # File upload component
│   ├── contexts/
│   │   ├── AuthContext.jsx       # Authentication state
│   │   └── ThemeContext.jsx      # Dark/Light theme
│   ├── services/
│   │   ├── admin.js              # Admin API calls
│   │   ├── api.js                # Main API client
│   │   ├── auth.js               # Auth API calls
│   │   ├── settings.js           # Settings API calls
│   │   ├── socket.js             # Socket.IO client
│   │   ├── stocks.js             # Stocks API calls
│   │   └── tradePlans.js         # Trade plans API calls
│   ├── App.jsx                   # Main app component
│   ├── main.jsx                  # Entry point
│   └── index.css                 # Global styles
├── index.html
├── package.json
├── tailwind.config.js
├── vite.config.js
└── postcss.config.js
```

---

## Application Architecture

### 1. Routing Structure

```
Public Routes:
  / → Landing Page
  /login → Login
  /signup → Signup

Authenticated Routes:
  /dashboard → Main Overview (Home)
  /magic-line → Magic Line Feature
  /trade-signals → Trade Plans Feature

Admin Only Routes:
  /stocks → Stock Management
  /admin → User Management
  /settings → System Settings
```

**Route Protection:**
- `ProtectedRoute` - Requires authentication
- `adminOnly` prop - Requires admin/super_admin role

---

### 2. State Management

**Context API Structure:**

```javascript
// AuthContext
{
  user: { username, email, role, isActive },
  loading: boolean,
  login: (email, password) => Promise,
  signup: (username, email, password) => Promise,
  logout: () => Promise,
  isAdmin: () => boolean
}

// ThemeContext
{
  theme: 'light' | 'dark',
  toggleTheme: () => void
}
```

**Usage:**
```javascript
const { user, isAdmin } = useAuth();
const { theme, toggleTheme } = useTheme();
```

---

### 3. Component Hierarchy

```
App (Router + Auth Provider)
  ├─ Landing (Public)
  ├─ Login (Public)
  ├─ Signup (Public)
  └─ ProtectedRoute
      ├─ Header (Navigation)
      ├─ Dashboard (Overview)
      │   └─ Quick Links Cards
      ├─ MagicLine
      │   ├─ UploadForm (Admin)
      │   ├─ Statistics Cards
      │   ├─ Search & Filters
      │   └─ Symbol Cards List
      ├─ TradePlans
      │   ├─ Create/Edit Form
      │   └─ Plans List
      ├─ StockManagement (Admin)
      ├─ AdminDashboard (Admin)
      └─ Settings (Admin)
```

---

### 4. API Integration

**Base API Client (`api.js`):**
```javascript
const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  withCredentials: true
});

// Interceptors
- Request: Add JWT token from localStorage
- Response: Handle 401 (redirect to login)
```

**API Services:**
- `auth.js` - Authentication endpoints
- `admin.js` - User management
- `settings.js` - Settings CRUD
- `stocks.js` - Stock operations
- `tradePlans.js` - Trade plan CRUD
- `api.js` - Magic line endpoints

**Example Usage:**
```javascript
import { getSymbols } from '../services/api';

const data = await getSymbols();
// data = { success: true, symbols: [...], stats: {...} }
```

---

### 5. Real-time Updates (Socket.IO)

**Socket Service (`socket.js`):**
```javascript
socketService.connect();           // Connect to server
socketService.on('event', handler); // Listen to event
socketService.emit('event', data);  // Emit event
socketService.off('event', handler); // Unsubscribe
socketService.disconnect();         // Disconnect
```

**Events Listened:**
```javascript
'initialData' → Set initial symbols/stats
'priceUpdate' → Update prices in real-time
'magicLineUpdate' → Update magic line status
'tradePlanUpdate' → Update trade plan status
```

**Implementation Pattern:**
```javascript
useEffect(() => {
  socketService.connect();
  
  const handlePriceUpdate = (data) => {
    // Update state
  };
  
  socketService.on('priceUpdate', handlePriceUpdate);
  
  return () => {
    socketService.off('priceUpdate', handlePriceUpdate);
  };
}, []);
```

---

### 6. Authentication Flow

**Login Flow:**
```
1. User enters credentials
2. Submit to /api/auth/login
3. Receive { user, token }
4. Store token in localStorage
5. Set user in AuthContext
6. Redirect to /dashboard
```

**Signup Flow:**
```
1. User enters details
2. Submit to /api/auth/signup
3. Receive { pendingApproval: true }
4. Show "Waiting for admin approval" message
5. User cannot login until admin approves
```

**Token Management:**
```javascript
// Store token
localStorage.setItem('token', token);

// Retrieve token
const token = localStorage.getItem('token');

// Add to requests (interceptor)
config.headers.Authorization = `Bearer ${token}`;

// Clear on logout
localStorage.removeItem('token');
```

**Protected Route Logic:**
```javascript
if (loading) return <LoadingSpinner />;
if (!user) return <Navigate to="/login" />;
if (adminOnly && !isAdmin()) return <Navigate to="/dashboard" />;
return children;
```

---

### 7. Theme System

**Dark Mode Implementation:**
```javascript
// ThemeContext
const [theme, setTheme] = useState('light');

// Toggle theme
const toggleTheme = () => {
  const newTheme = theme === 'light' ? 'dark' : 'light';
  setTheme(newTheme);
  localStorage.setItem('theme', newTheme);
  document.documentElement.classList.toggle('dark');
};

// Initialize from localStorage
useEffect(() => {
  const savedTheme = localStorage.getItem('theme') || 'light';
  setTheme(savedTheme);
  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark');
  }
}, []);
```

**Usage in Components:**
```javascript
className="bg-white dark:bg-gray-800"
className="text-gray-900 dark:text-white"
```

---

### 8. File Upload

**React Dropzone Integration:**
```javascript
const { getRootProps, getInputProps, isDragActive } = useDropzone({
  onDrop: handleDrop,
  accept: {
    'text/csv': ['.csv'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png']
  },
  maxFiles: 1
});
```

**Upload Flow:**
```
1. User drops/selects file
2. Show progress bar
3. Upload to /api/upload with FormData
4. Receive { success, message, data }
5. Trigger refresh (onUploadSuccess callback)
6. Display success message
```

---

### 9. Form Handling

**Controlled Components Pattern:**
```javascript
const [formData, setFormData] = useState({
  field1: '',
  field2: ''
});

const handleChange = (e) => {
  setFormData(prev => ({
    ...prev,
    [e.target.name]: e.target.value
  }));
};

const handleSubmit = async (e) => {
  e.preventDefault();
  // API call
};
```

---

### 10. Navigation

**React Router Navigation:**
```javascript
import { useNavigate } from 'react-router-dom';

const navigate = useNavigate();

// Navigate programmatically
navigate('/dashboard');
navigate('/magic-line', { replace: true });
navigate(-1); // Go back
```

**Header Navigation:**
```javascript
onNavigateToDashboard={() => navigate('/dashboard')}
onNavigateToMagicLine={() => navigate('/magic-line')}
onNavigateToTradeSignals={() => navigate('/trade-signals')}
```

---

### 11. Error Handling

**API Error Handling:**
```javascript
try {
  const response = await apiCall();
} catch (error) {
  const message = error.response?.data?.message || error.message;
  toast.error(message);
  console.error('Error:', error);
}
```

**React Error Boundaries:** (TODO)
- Not yet implemented
- Recommended for production

---

### 12. Loading States

**Pattern:**
```javascript
const [loading, setLoading] = useState(true);
const [data, setData] = useState(null);

useEffect(() => {
  loadData();
}, []);

const loadData = async () => {
  setLoading(true);
  try {
    const result = await fetchData();
    setData(result);
  } finally {
    setLoading(false);
  }
};

if (loading) return <Spinner />;
```

---

### 13. Notifications

**React Hot Toast:**
```javascript
import toast from 'react-hot-toast';

toast.success('Operation successful!');
toast.error('Something went wrong');
toast.loading('Processing...');
toast.dismiss(toastId);
```

**Configuration:**
```javascript
<Toaster 
  position="top-right"
  toastOptions={{
    duration: 3000,
    style: {
      background: '#363636',
      color: '#fff',
    }
  }}
/>
```

---

### 14. Responsive Design

**Tailwind Breakpoints:**
```
sm: 640px   - Small devices
md: 768px   - Medium devices
lg: 1024px  - Large devices
xl: 1280px  - Extra large devices
2xl: 1536px - 2X extra large
```

**Usage:**
```javascript
className="block lg:hidden"        // Show on mobile, hide on desktop
className="hidden lg:block"        // Hide on mobile, show on desktop
className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
```

---

### 15. Performance Optimizations

**1. Code Splitting:**
- Vite automatically handles code splitting
- Lazy loading can be added with React.lazy()

**2. Memoization:**
```javascript
import { useMemo, useCallback } from 'react';

const filtered = useMemo(() => 
  data.filter(item => item.active),
  [data]
);

const handleClick = useCallback(() => {
  // handler logic
}, [dependencies]);
```

**3. Virtual Scrolling:** (TODO)
- Recommended for large lists (1000+ items)
- Use react-window or react-virtual

---

### 16. Environment Variables

**Vite Environment Variables:**
```env
VITE_API_URL=http://localhost:5000/api
```

**Usage:**
```javascript
const API_URL = import.meta.env.VITE_API_URL || '/api';
```

**Build Modes:**
- Development: `npm run dev`
- Production: `npm run build`

---

### 17. Build & Deployment

**Build Command:**
```bash
npm run build
# Output: dist/
```

**Build Output:**
```
dist/
├── assets/
│   ├── index-[hash].js
│   └── index-[hash].css
└── index.html
```

**Deployment:**
- Static files in `dist/` directory
- Backend serves frontend from `frontend/dist/`
- Fly.io deployment includes frontend build

---

### 18. Key Components

### Dashboard (Overview)
- Quick access cards to all features
- Role-based visibility (admin features)
- Beautiful gradient cards with hover effects
- Click to navigate to features

### MagicLine
- Real-time symbol monitoring
- Upload CSV file (admin)
- Search & filter functionality
- Statistics cards (total, met, pending)
- Color-coded status (green=met, orange=pending)
- Socket.IO real-time updates

### TradePlans
- Create/edit trade plans
- Multiple buy levels, targets, stop loss
- Real-time price tracking
- Status indicators for met levels
- Form validation

### Header
- Responsive navigation
- User dropdown menu
- Theme toggle (dark/light)
- Market status indicator
- Last price update timestamp
- Mobile hamburger menu

### Landing Page
- Public marketing page
- Hero section with CTA
- Features showcase
- Why choose us section
- Footer with links

---

### 19. Common Patterns

**Fetch Data on Mount:**
```javascript
useEffect(() => {
  loadData();
}, []);
```

**Handle Form Submit:**
```javascript
const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  try {
    await submitData(formData);
    toast.success('Success!');
  } catch (error) {
    toast.error(error.message);
  } finally {
    setLoading(false);
  }
};
```

**Conditional Rendering:**
```javascript
{loading && <Spinner />}
{error && <ErrorMessage />}
{data && <DataDisplay />}
```

---

### 20. Testing (TODO)

**Recommended Stack:**
- Jest + React Testing Library
- Vitest (Vite's test runner)
- Cypress for E2E testing

**Not yet implemented**

---

### 21. Accessibility

**Current Implementation:**
- Semantic HTML elements
- ARIA labels on interactive elements
- Keyboard navigation support
- Focus states with Tailwind
- Dark mode for reduced eye strain

**TODO:**
- Screen reader testing
- ARIA roles and descriptions
- Skip navigation links
- Accessibility audit

---

### 22. Browser Compatibility

**Target Browsers:**
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

**Required Features:**
- ES6+ support
- LocalStorage
- WebSocket support
- Fetch API

---

### 23. Development Workflow

**Start Development:**
```bash
cd frontend
npm install
npm run dev
# Opens http://localhost:3000
```

**Code Style:**
- ES6+ JavaScript
- Functional components (no class components)
- Hooks for state management
- Arrow functions
- Async/await for promises

---

### 24. Common Issues & Solutions

**Issue:** CORS errors
- Solution: Ensure backend CORS is configured
- Check `withCredentials: true` in axios

**Issue:** Token expired
- Solution: Logout and re-login
- Implement token refresh (TODO)

**Issue:** Socket not connecting
- Solution: Check backend URL
- Ensure Socket.IO server is running

**Issue:** Dark mode not persisting
- Solution: Check localStorage
- Ensure ThemeContext is initialized correctly

---

### 25. Future Enhancements

- [ ] Progressive Web App (PWA)
- [ ] Push notifications
- [ ] Offline support
- [ ] Advanced charts (TradingView integration)
- [ ] Export data to PDF/Excel
- [ ] Mobile app (React Native)
- [ ] Multi-language support
- [ ] Advanced filtering & sorting
- [ ] Customizable dashboard widgets
- [ ] Real-time chat support

