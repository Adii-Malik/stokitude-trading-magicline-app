# PSX SmartDesk - Design System

## 🎨 Color Palette

> **Theme Toggle**: Users can switch between light and dark themes using the sun/moon icon in the header. Theme preference is stored in localStorage.

### Dark Theme
```
Background: 
- Primary: from-gray-900 via-gray-800 to-gray-900
- Cards: bg-gray-800/50 backdrop-blur-sm
- Borders: border-gray-700

Text:
- Primary: text-white
- Secondary: text-gray-300
- Muted: text-gray-400

Accents:
- Cyan (Primary): bg-cyan-500 (Interactive elements)
- Blue: bg-blue-600 hover:bg-blue-700
- Green (Success): bg-green-600 hover:bg-green-700
- Red (Danger): bg-red-600 hover:bg-red-700
- Yellow (Warning): bg-yellow-600 hover:bg-yellow-700
- Purple (Admin): bg-purple-600 hover:bg-purple-700
```

### Light Theme
```
Background:
- Primary: from-gray-50 to-gray-100
- Cards: bg-white with shadow-md
- Borders: border-gray-200

Text:
- Primary: text-gray-900
- Secondary: text-gray-700
- Muted: text-gray-600

Accents:
- Cyan (Primary): bg-cyan-500 (Interactive elements)
- Blue: bg-blue-600 hover:bg-blue-700
- Green (Success): bg-green-600 hover:bg-green-700
- Red (Danger): bg-red-600 hover:bg-red-700
- Yellow (Warning): bg-yellow-600 hover:bg-yellow-700
- Purple (Admin): bg-purple-600 hover:bg-purple-700
```

### Auth Pages (Gradient Backgrounds)
```
Login: from-blue-50 to-indigo-100
Signup: from-purple-50 to-pink-100
Cards: bg-white with shadow-xl
```

---

## 📐 Layout Structure

### Navigation System
```
Header (Fixed Top)
├── Logo/Brand
├── Navigation Links (Main Features)
│   ├── Dashboard (Magic Line)
│   ├── Trade Signals
│   ├── Watchlist (Future)
│   └── Admin Panel (Admin/Super Admin Only)
└── User Menu
    ├── Profile
    ├── Settings
    └── Logout
```

### Page Layout
```
<div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
  <Header />
  <main className="container mx-auto px-4 py-8">
    <PageContent />
  </main>
  <Footer /> (Optional)
</div>
```

---

## 🔘 Button Styles

### Primary Button
```jsx
className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg 
transition-colors duration-200 flex items-center gap-2 disabled:opacity-50 
disabled:cursor-not-allowed"
```

### Success Button
```jsx
className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg 
transition-colors duration-200"
```

### Danger Button
```jsx
className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg 
transition-colors duration-200"
```

### Ghost Button (Theme-Aware)
```jsx
className="px-4 py-2 bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 
dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 hover:text-gray-900 
dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg 
transition-all duration-200"
```

### Theme Toggle Button
```jsx
<button
  onClick={toggleTheme}
  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800/50 hover:bg-gray-200 
  dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 transition-all duration-200"
>
  {theme === 'dark' ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-gray-700" />}
</button>
```

---

## 📦 Card Styles

### Standard Card (Theme-Aware)
```jsx
className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 
dark:border-gray-700 rounded-lg p-6 shadow-md"
```

### Highlighted Card (Met Threshold - Theme-Aware)
```jsx
className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-500/10 
dark:to-emerald-500/10 border-2 border-green-400 dark:border-green-500/50 
ring-2 ring-green-200 dark:ring-green-500/20 rounded-lg p-6"
```

---

## 🎯 Component Patterns

### Stats Card (Theme-Aware)
```jsx
<div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 
dark:border-gray-700 rounded-lg p-6 shadow-md">
  <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">Label</div>
  <div className="text-3xl font-bold text-gray-900 dark:text-white">Value</div>
</div>
```

### Inline Stats Badge (Theme-Aware)
```jsx
<div className="bg-gray-100 dark:bg-white/10 backdrop-blur px-4 py-2 rounded-lg 
border border-gray-200 dark:border-gray-700">
  <div className="text-xl font-bold text-gray-900 dark:text-white">Value</div>
  <div className="text-xs text-gray-600 dark:text-gray-300">Label</div>
</div>
```

### Table (Theme-Aware)
```jsx
<div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 
dark:border-gray-700 rounded-lg overflow-hidden shadow-md">
  <table className="w-full">
    <thead className="bg-gray-50 dark:bg-gray-900/50">
      <tr>
        <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 
        dark:text-gray-400 uppercase">...</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
      <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
        <td className="px-6 py-4 text-gray-900 dark:text-gray-300">...</td>
      </tr>
    </tbody>
  </table>
</div>
```

### Filter Tabs (Theme-Aware)
```jsx
<div className="flex gap-2">
  <button className={`px-4 py-2 rounded-lg font-medium transition-colors ${
    active 
      ? 'bg-cyan-500 text-white shadow-md' 
      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
  }`}>
    Label
  </button>
</div>
```

---

## 🧭 Navigation Structure (Current + Future)

### Level 1: Main Navigation
```
1. Dashboard (Magic Line Feature)
2. Trade Signals
3. Watchlist (Future)
4. Admin Panel (Role-based)
```

### Level 2: Sub-Navigation (Trade Signals Example)
```
Trade Signals Page:
├── Active Signals Tab
└── Historical Signals Tab
```

### Level 3: Admin Sub-Menu
```
Admin Panel:
├── Users Management
├── Stock Database (Feature 2)
├── Trade Plans Management
└── System Settings (Future)
```

---

## 📱 Responsive Breakpoints

```
Mobile: < 640px
Tablet: 640px - 1024px  
Desktop: > 1024px

Usage:
- Stack navigation on mobile
- Show full navigation on desktop
- Use hamburger menu for mobile (if needed)
```

---

## 🎭 Animation Standards

### Transitions
```css
transition-colors duration-200  /* For color changes */
transition-all duration-200     /* For size/position */
transition-transform duration-300 /* For hover effects */
```

### Hover Effects
```jsx
hover:scale-105         /* Cards */
hover:shadow-lg         /* Elevation */
hover:-translate-y-1    /* Lift effect */
```

### Loading States
```jsx
<RefreshCw className="w-5 h-5 animate-spin" />
```

---

## 🔔 Notification Styles (Theme-Aware)

### Success Toast
```jsx
Light: bg-green-50 border border-green-200 text-green-700
Dark: bg-green-500/10 border border-green-500/50 text-green-400
```

### Error Toast
```jsx
Light: bg-red-50 border border-red-200 text-red-700
Dark: bg-red-500/10 border border-red-500/50 text-red-400
```

### Info Toast
```jsx
Light: bg-cyan-50 border border-cyan-200 text-cyan-700
Dark: bg-cyan-500/10 border border-cyan-500/50 text-cyan-400
```

---

## 📋 Form Inputs (Theme-Aware)

### Text Input
```jsx
className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 
dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 
dark:placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
```

### Select Dropdown
```jsx
className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 
dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 
focus:ring-cyan-500 focus:border-transparent"
```

---

## ✅ Implementation Checklist

- [x] ThemeContext - Theme management with localStorage
- [x] Theme Toggle - Sun/Moon button in Header
- [x] AdminDashboard - Theme-aware styling
- [x] Dashboard (Magic Line) - Theme-aware styling
- [x] UploadForm - Theme-aware styling
- [x] Header - Theme-aware with navigation system
- [ ] Trade Signals Page - Theme-aware (Feature 3)
- [ ] Stock Management Page - Theme-aware (Feature 2)
- [ ] Settings Page - Theme-aware (Future)

---

## 🎨 Brand Identity

**App Name:** PSX SmartDesk
**Tagline:** Real-time Stock Monitoring & Trading Signals
**Primary Color:** Blue (#2563eb)
**Accent Color:** Cyan (#06b6d4)
**Theme:** Dual (Light/Dark) with Toggle
**Vibe:** Modern, Clean, Professional Trading Platform
**Default Theme:** Light (Clean, accessible interface)
**Theme Persistence:** localStorage (user preference saved)

