# Progressive Web App (PWA) Guide

## Overview
Transform Financial Reading into an installable Progressive Web App that works offline, sends push notifications, and provides a native-like experience.

## What is a PWA?

A Progressive Web App provides:
- **Installable** - Users install directly from website (no app store)
- **App Icon** - Gets its own icon on home screen/desktop
- **Full-Screen** - Runs like a native app
- **Offline Mode** - Works without internet connection
- **Push Notifications** - Send alerts even when app is closed
- **Auto-Updates** - Seamlessly updates when new code is deployed
- **Same Codebase** - Uses existing web app code

## Benefits

### For Users
- 📱 One-tap access from home screen
- 🚀 Faster performance (cached assets)
- 📶 Works offline
- 🔔 Receive push notifications
- 💾 No app store download required
- 🔄 Always up-to-date automatically

### For Development
- ✅ Zero code changes to existing app
- ✅ Same deployment workflow
- ✅ No app store approval process
- ✅ Updates deploy instantly
- ✅ Works on Android, iOS, Desktop

## Implementation

### 1. Web App Manifest

Create `frontend/public/manifest.json`:

```json
{
  "name": "Financial Reading - Pakistan Stock Exchange",
  "short_name": "Financial Reading",
  "description": "Real-time trading platform for Pakistan Stock Exchange",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#06b6d4",
  "orientation": "portrait-primary",
  "categories": ["finance", "productivity"],
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "shortcuts": [
    {
      "name": "Trade Plans",
      "url": "/trade-plans",
      "description": "View active trade plans",
      "icons": [{ "src": "/icons/shortcut-trade.png", "sizes": "96x96" }]
    },
    {
      "name": "Magic Line",
      "url": "/magic-line",
      "description": "Monitor magic line levels",
      "icons": [{ "src": "/icons/shortcut-magic.png", "sizes": "96x96" }]
    },
    {
      "name": "Notifications",
      "url": "/notifications",
      "description": "View all notifications",
      "icons": [{ "src": "/icons/shortcut-notif.png", "sizes": "96x96" }]
    }
  ]
}
```

Link in `frontend/index.html`:
```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#06b6d4">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="apple-touch-icon" href="/icons/icon-192x192.png">
```

### 2. Service Worker (Vite PWA Plugin)

Install:
```bash
npm install vite-plugin-pwa -D
```

Configure `frontend/vite.config.js`:
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'icons/*.png'],
      manifest: false, // Use public/manifest.json instead
      workbox: {
        // Cache strategies
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 5 * 60 // 5 minutes
              },
              networkTimeoutSeconds: 10
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
              }
            }
          },
          {
            urlPattern: /\.(?:js|css|woff|woff2|ttf|eot)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'static-resources',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
              }
            }
          }
        ],
        // Clean old caches
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true
      },
      devOptions: {
        enabled: false // Disable in development
      }
    })
  ]
});
```

### 3. Generate Icons

Create all required icon sizes in `frontend/public/icons/`:

**Sizes needed:**
- 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512

**Tools:**
- [PWA Asset Generator](https://github.com/onderceylan/pwa-asset-generator) - CLI tool
- [RealFaviconGenerator](https://realfavicongenerator.net/) - Web-based
- [Favicon.io](https://favicon.io/) - Simple PNG to icon converter

Example with PWA Asset Generator:
```bash
npx pwa-asset-generator logo.svg frontend/public/icons \
  --icon-only \
  --padding "10%" \
  --background "#0f172a"
```

### 4. Install Prompt (Optional)

Add install button in app:

```javascript
// frontend/src/components/InstallPWA.jsx
import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowInstall(false);
    }
    
    setDeferredPrompt(null);
  };

  if (!showInstall) return null;

  return (
    <button
      onClick={handleInstall}
      className="fixed bottom-4 right-4 bg-cyan-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 hover:bg-cyan-700 transition z-50"
    >
      <Download className="w-4 h-4" />
      Install App
    </button>
  );
}
```

## Updates & Deployment

### How Auto-Updates Work

1. You deploy new code to server
2. User opens PWA or it runs in background
3. Service worker detects new version
4. Downloads new files in background
5. Next time user opens app → New version loads automatically

### What Updates Automatically

| Change Type | Auto-Updates? | When? |
|-------------|---------------|-------|
| React components | ✅ Yes | Next app launch |
| New features | ✅ Yes | Next app launch |
| Bug fixes | ✅ Yes | Next app launch |
| Styles/CSS | ✅ Yes | Next app launch |
| API endpoints | ✅ Yes | Immediately |
| Service worker | ✅ Yes | Next app launch |
| Icons/manifest | ⚠️ Rare | May need reinstall |

### Your Workflow (Unchanged!)

```bash
# Same as always:
git push
# Server deploys
# Users get updates automatically (no action needed)
```

## Push Notifications

Push notifications require additional backend setup. See [NOTIFICATIONS_GUIDE.md](./NOTIFICATIONS_GUIDE.md) for the implemented notification system.

**Future Enhancement:** Web Push API integration for notifications when app is closed.

## Testing

### Development
```bash
npm run dev
# PWA features disabled in dev mode (faster development)
```

### Production Build
```bash
npm run build
npm run preview
```

Test checklist:
- [ ] Manifest loads correctly
- [ ] Icons display properly
- [ ] Install prompt appears (desktop Chrome/Edge)
- [ ] App installs successfully
- [ ] App icon appears on home screen
- [ ] App opens in standalone mode
- [ ] Offline mode works (disconnect network)
- [ ] Updates apply on next launch

### Browser Testing

**Desktop:**
- ✅ Chrome/Edge - Full support
- ✅ Safari - Partial (no install prompt)
- ❌ Firefox - No install support

**Mobile:**
- ✅ Chrome Android - Full support
- ✅ Safari iOS 11.3+ - Full support
- ✅ Samsung Internet - Full support

### Lighthouse Audit

Check PWA score:
```bash
npm run build
npm run preview
# Open DevTools → Lighthouse → Progressive Web App
```

Target score: 100/100

## Platform-Specific Notes

### iOS Safari
- Install via Share → Add to Home Screen
- No install prompt (user-initiated only)
- Manifest support since iOS 11.3
- Push notifications require Apple Developer account

### Android Chrome
- Automatic install prompt after engagement criteria met
- Full PWA support
- Push notifications work out of the box

### Desktop (Chrome/Edge)
- Install via address bar icon or Settings
- Runs as standalone window
- Full feature parity with mobile

## Resources

- [MDN: Progressive Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Vite PWA Plugin](https://vite-pwa-org.netlify.app/)
- [Web.dev PWA Guide](https://web.dev/progressive-web-apps/)
- [PWA Builder](https://www.pwabuilder.com/) - Test your PWA
- [Workbox Documentation](https://developers.google.com/web/tools/workbox)
