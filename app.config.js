// app.config.js
require('dotenv').config();

export default {
  name: "QR Guardian",
  slug: "qr-guardian", 
  version: "1.0.0",
  orientation: "portrait",
  extra: {
    googleSafeBrowsingApiKey: process.env.GOOGLE_SAFE_BROWSING_API_KEY,
    virusTotalApiKey: process.env.VIRUSTOTAL_API_KEY,
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL,
    ip2LocationApiKey: process.env.IP2LOCATION_API_KEY,
  },
  plugins: [
      "expo-router",
      "expo-camera",
      "expo-web-browser"
    ]
};