// app.config.js
require('dotenv').config();

export default {
  name: "QR Guardian",
  slug: "qr-guardian", 
  version: "1.0.0",
  orientation: "portrait",
  extra: {
    googleSafeBrowsingApiKey: process.env.GOOGLE_SAFE_BROWSING_API_KEY,
  },
  plugins: [
      "expo-router",
      "expo-camera",
      "expo-web-browser"
    ]
};