// app.config.js
// Single source of truth for Expo SDK 55. Loads .env and merges static
// options that used to live in app.json.
require('dotenv').config();

export default {
  name: 'QRGuardian',
  slug: 'QRGuardian',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'qrguardian',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
  },
  android: {
    package: 'com.yourname.qrguardian',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-camera',
    'expo-web-browser',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
        dark: {
          backgroundColor: '#000000',
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    // Backwards compatible: support both old and new env var names
    googleSafeBrowsingApiKey: process.env.GOOGLE_SAFE_BROWSING_API_KEY,
    virusTotalApiKey: process.env.VIRUSTOTAL_API_KEY,
    geminiApiKey:
      process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL,
    ip2LocationApiKey: process.env.IP2LOCATION_API_KEY,
  },
};