# Financial Reading - Design System

## Brand Identity

**Application Name:** Financial Reading  
**Tagline:** "Intelligent Trading Platform for Pakistan Stock Exchange"  
**Purpose:** Professional-grade stock monitoring and trading tools

---

## Color System

### Primary Color: Cyan

```
Cyan-50:  #ECFEFF  (Lightest - backgrounds)
Cyan-100: #CFFAFE  (Light backgrounds)
Cyan-400: #22D3EE  (Accents)
Cyan-500: #06B6D4  ★ PRIMARY ★ (Buttons, links, highlights)
Cyan-600: #0891B2  (Hover states)
Cyan-700: #0E7490  (Active states)
Cyan-900: #164E63  (Darkest)
```

**Usage:**
- Primary buttons
- Active navigation items
- Links and CTAs
- Icon highlights
- Progress indicators

---

### Neutral Colors

**Light Mode:**
```
Gray-50:  #F9FAFB  (Page backgrounds)
Gray-100: #F3F4F6  (Card backgrounds)
Gray-200: #E5E7EB  (Borders)
Gray-300: #D1D5DB  (Dividers)
Gray-600: #4B5563  (Secondary text)
Gray-700: #374151  (Body text)
Gray-900: #111827  (Headings)
```

**Dark Mode:**
```
Gray-700: #374151  (Borders)
Gray-800: #1F2937  (Card backgrounds)
Gray-900: #111827  (Page backgrounds)
White:    #FFFFFF  (Text)
Gray-300: #D1D5DB  (Secondary text)
```

---

### Semantic Colors

**Success:**
```
Green-400: #4ADE80  (Success text)
Green-500: #22C55E  (Success buttons)
Green-600: #16A34A  (Success hover)
```

**Warning:**
```
Yellow-400: #FACC15  (Warning text)
Orange-500: #F97316  (Warning buttons)
Orange-600: #EA580C  (Warning hover)
```

**Error:**
```
Red-400: #F87171    (Error text)
Red-500: #EF4444    (Error buttons)
Red-600: #DC2626    (Error hover)
```

**Info:**
```
Blue-400: #60A5FA   (Info text)
Blue-500: #3B82F6   (Info buttons)
Blue-600: #2563EB   (Info hover)
```

---

### Status Colors

**Magic Line Status:**
- **Met (Green):** Price >= Magic Line threshold
- **Pending (Orange):** Price < Magic Line threshold
- **No Data (Gray):** No price available

**Market Status:**
- **Open (Green):** Market is currently trading
- **Closed (Orange):** Market is closed

**Trade Plan Status:**
- **Buy Level Met (Green)**
- **Target Hit (Green)**
- **Stop Loss Hit (Red)**
- **Pending (Gray)**

---

## Typography

### Font Family

**Primary:** System Fonts
```css
font-family: 
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  'Segoe UI',
  Roboto,
  'Helvetica Neue',
  Arial,
  sans-serif;
```

**Monospace:** (for prices, numbers)
```css
font-family: 
  'Monaco',
  'Courier New',
  monospace;
```

---

### Font Sizes

```
text-xs:    0.75rem  (12px) - Small labels, captions
text-sm:    0.875rem (14px) - Body text, secondary info
text-base:  1rem     (16px) - Primary body text
text-lg:    1.125rem (18px) - Lead text
text-xl:    1.25rem  (20px) - Small headings
text-2xl:   1.5rem   (24px) - Card titles
text-3xl:   1.875rem (30px) - Section headers
text-4xl:   2.25rem  (36px) - Page titles
text-5xl:   3rem     (48px) - Hero text
text-6xl:   3.75rem  (60px) - Landing page hero
```

---

### Font Weights

```
font-normal:   400 - Body text
font-medium:   500 - Emphasized text
font-semibold: 600 - Subheadings
font-bold:     700 - Headings, buttons
font-extrabold: 800 - Hero headings
```

---

### Line Heights

```
leading-tight:  1.25  - Headings
leading-snug:   1.375 - Subheadings
leading-normal: 1.5   - Body text
leading-relaxed: 1.625 - Long-form content
```

---

## Spacing System

**Tailwind Spacing Scale:**
```
0:   0px
1:   0.25rem  (4px)
2:   0.5rem   (8px)
3:   0.75rem  (12px)
4:   1rem     (16px)
5:   1.25rem  (20px)
6:   1.5rem   (24px)
8:   2rem     (32px)
10:  2.5rem   (40px)
12:  3rem     (48px)
16:  4rem     (64px)
20:  5rem     (80px)
```

**Common Uses:**
- `gap-2` - Small spacing between items
- `gap-4` - Default spacing
- `gap-6` - Large spacing
- `p-4` - Card padding
- `p-6` - Large card padding
- `p-8` - Section padding
- `py-12` - Vertical section padding

---

## Border Radius

```
rounded-none: 0px
rounded-sm:   0.125rem (2px)
rounded:      0.25rem  (4px)  - Default
rounded-md:   0.375rem (6px)
rounded-lg:   0.5rem   (8px)  - Cards, buttons
rounded-xl:   0.75rem  (12px) - Large cards
rounded-2xl:  1rem     (16px) - Hero cards
rounded-full: 9999px          - Badges, avatars
```

**Usage:**
- Buttons: `rounded-lg`
- Cards: `rounded-xl` or `rounded-2xl`
- Inputs: `rounded-lg`
- Badges: `rounded-full`
- Images: `rounded-xl`

---

## Shadows

```
shadow-sm:  Small shadow - Subtle elevation
shadow:     Default shadow - Cards at rest
shadow-md:  Medium shadow - Elevated cards
shadow-lg:  Large shadow - Dropdowns, modals
shadow-xl:  Extra large - Sticky headers
shadow-2xl: Huge shadow - Hero sections
```

**Dark Mode Shadows:**
- Shadows are less prominent in dark mode
- Use border highlights instead for elevation

---

## Components

### 1. Buttons

**Primary Button:**
```jsx
<button className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-lg transition-colors shadow-lg">
  Click Me
</button>
```

**Secondary Button:**
```jsx
<button className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors">
  Click Me
</button>
```

**Danger Button:**
```jsx
<button className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors">
  Delete
</button>
```

**Button Sizes:**
- Small: `px-3 py-1.5 text-sm`
- Medium: `px-4 py-2 text-base` (default)
- Large: `px-6 py-3 text-lg`

---

### 2. Cards

**Basic Card:**
```jsx
<div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
  {/* Content */}
</div>
```

**Hover Card (Interactive):**
```jsx
<div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-2xl p-6 border border-gray-200 dark:border-gray-700 transition-all hover:-translate-y-1 cursor-pointer">
  {/* Content */}
</div>
```

**Gradient Card:**
```jsx
<div className="bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 rounded-xl border border-cyan-200 dark:border-cyan-800 p-6">
  {/* Content */}
</div>
```

---

### 3. Inputs

**Text Input:**
```jsx
<input 
  type="text"
  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
  placeholder="Enter text"
/>
```

**Input with Icon:**
```jsx
<div className="relative">
  <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
  <input className="pl-10 ..." />
</div>
```

---

### 4. Badges

**Status Badge:**
```jsx
<span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
  Active
</span>
```

**Badge Colors:**
- Success: `bg-green-100 text-green-700`
- Warning: `bg-orange-100 text-orange-700`
- Error: `bg-red-100 text-red-700`
- Info: `bg-blue-100 text-blue-700`
- Neutral: `bg-gray-100 text-gray-700`

---

### 5. Navigation

**Header:**
- Height: `py-3` or `py-4`
- Background: `bg-white dark:bg-gray-900`
- Border: `border-b border-gray-200 dark:border-gray-700`
- Shadow: `shadow-lg`
- Sticky: `sticky top-0 z-50`

**Nav Button (Active):**
```jsx
<button className="px-3 py-2 rounded-lg font-medium bg-cyan-500 text-white transition-all flex items-center gap-2 text-sm">
  <Icon />
  <span>Label</span>
</button>
```

**Nav Button (Inactive):**
```jsx
<button className="px-3 py-2 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all flex items-center gap-2 text-sm">
  <Icon />
  <span>Label</span>
</button>
```

---

### 6. Modals & Dropdowns

**Dropdown:**
```jsx
<div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
  {/* Dropdown items */}
</div>
```

**Modal Backdrop:**
```jsx
<div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" />
```

---

### 7. Loading States

**Spinner:**
```jsx
<div className="w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin" />
```

**Skeleton:**
```jsx
<div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-4 rounded" />
```

---

### 8. Icons

**Library:** Lucide React

**Common Icons:**
- `Home` - Home/Dashboard
- `BarChart3` - Magic Line
- `Target` - Trade Plans
- `TrendingUp` - Stocks/Logo
- `Settings` - Settings
- `Users` - User Management
- `Database` - Data Management
- `LogOut` - Logout
- `Sun/Moon` - Theme toggle

**Icon Sizes:**
- Small: `w-4 h-4`
- Medium: `w-5 h-5` (default)
- Large: `w-6 h-6`
- Extra Large: `w-8 h-8`

**Icon Colors:**
- Primary: `text-cyan-500`
- Success: `text-green-500`
- Warning: `text-orange-500`
- Error: `text-red-500`
- Neutral: `text-gray-500`

---

## Layout Patterns

### 1. Page Layout

```jsx
<div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
  <Header />
  <main className="container mx-auto px-4 py-8">
    {/* Content */}
  </main>
  <Footer />
</div>
```

---

### 2. Grid Layouts

**Responsive Grid:**
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {/* Items */}
</div>
```

**Common Grid Patterns:**
- 1 column: Mobile
- 2 columns: Tablet
- 3 columns: Desktop
- 4 columns: Large desktop

---

### 3. Flexbox Layouts

**Center Content:**
```jsx
<div className="flex items-center justify-center min-h-screen">
  {/* Centered content */}
</div>
```

**Space Between:**
```jsx
<div className="flex items-center justify-between">
  {/* Content */}
</div>
```

---

## Dark Mode

### Implementation

**Tailwind Config:**
```javascript
darkMode: 'class'  // Use class-based dark mode
```

**Toggle:**
```javascript
document.documentElement.classList.toggle('dark');
```

**Usage:**
```jsx
className="bg-white dark:bg-gray-800"
className="text-gray-900 dark:text-white"
```

### Dark Mode Color Adjustments

**Backgrounds:**
- Light: `bg-white` / `bg-gray-50`
- Dark: `bg-gray-800` / `bg-gray-900`

**Text:**
- Light: `text-gray-900` / `text-gray-700`
- Dark: `text-white` / `text-gray-300`

**Borders:**
- Light: `border-gray-200` / `border-gray-300`
- Dark: `border-gray-700` / `border-gray-600`

---

## Transitions & Animations

**Standard Transition:**
```jsx
className="transition-colors duration-300"
className="transition-all duration-200"
```

**Hover Effects:**
```jsx
className="hover:shadow-xl hover:-translate-y-1 transition-all"
```

**Animations:**
- `animate-spin` - Loading spinner
- `animate-pulse` - Skeleton loading
- `animate-bounce` - Attention grabber

---

## Responsive Breakpoints

**Mobile First Approach:**
```jsx
// Base: Mobile
className="text-sm"

// Tablet
className="md:text-base"

// Desktop
className="lg:text-lg"
```

**Visibility:**
```jsx
className="block lg:hidden"        // Mobile only
className="hidden lg:block"        // Desktop only
className="hidden md:block"        // Tablet and up
```

---

## Accessibility

**Focus States:**
```jsx
className="focus:ring-2 focus:ring-cyan-500 focus:outline-none"
```

**Screen Readers:**
```jsx
<span className="sr-only">Hidden text for screen readers</span>
```

**ARIA Labels:**
```jsx
<button aria-label="Close menu">
  <X className="w-5 h-5" />
</button>
```

---

## Brand Assets

**Logo:** TrendingUp icon in cyan-500  
**App Icon:** Cyan gradient with TrendingUp symbol  
**Favicon:** Simple chart icon  

---

## Design Principles

1. **Consistency:** Use the same patterns throughout
2. **Hierarchy:** Clear visual hierarchy with typography and spacing
3. **Contrast:** Ensure text is readable (WCAG AA minimum)
4. **Feedback:** Provide visual feedback for all interactions
5. **Performance:** Optimize for fast loading and smooth transitions
6. **Responsive:** Mobile-first, works on all screen sizes
7. **Accessibility:** Keyboard navigation and screen reader support

---

## Future Design Enhancements

- [ ] Custom illustrations
- [ ] Advanced data visualizations (charts)
- [ ] Micro-interactions and animations
- [ ] Custom icon set
- [ ] Print stylesheet
- [ ] High contrast mode
- [ ] Reduced motion preferences
