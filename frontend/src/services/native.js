/**
 * Native shell wiring.
 * Every call is a no-op in a browser, so the web build is unaffected.
 */
import { Capacitor } from '@capacitor/core';

export const isNative = () => Capacitor.isNativePlatform();

/**
 * Android's hardware back button. Without this it closes the app from any
 * screen, which feels broken once there is history to go back through.
 */
async function wireBackButton(navigate) {
    const { App } = await import('@capacitor/app');
    App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack || window.history.length > 1) navigate(-1);
        else App.exitApp();
    });
}

async function wireStatusBar() {
    try {
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        await StatusBar.setStyle({ style: Style.Dark });
        // Draw under the bar ourselves; CSS safe-area insets handle the spacing.
        await StatusBar.setOverlaysWebView({ overlay: false });
    } catch {
        // Not present on every platform - not worth failing startup over.
    }
}

async function hideSplash() {
    try {
        const { SplashScreen } = await import('@capacitor/splash-screen');
        await SplashScreen.hide();
    } catch {
        // Ignore.
    }
}

export async function initNative(navigate) {
    if (!isNative()) return;
    document.documentElement.classList.add('is-native');
    await Promise.all([wireStatusBar(), wireBackButton(navigate), hideSplash()]);
}
