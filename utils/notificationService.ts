// utils/notificationService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const NOTIFICATION_KEY = '@qrguardian_notifications_enabled';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  } as Notifications.NotificationBehavior),
});

export const requestNotificationPermissions = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('qr-security', {
      name: 'QR Security Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF3B30',
    });
  }

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
};

export const scheduleWeeklyReport = async () => {
  try {
    // Schedule for every Sunday at 10 AM - FIXED TRIGGER
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📊 Your Weekly Security Report',
        body: 'Check your scan history for this week\'s security insights!',
        data: { type: 'weekly_report' },
      },
      trigger: {
        repeats: true,
        weekday: 0, // Sunday
        hour: 10,
        minute: 0,
      } as any, // Type workaround
    });
  } catch (error) {
    console.error('Error scheduling weekly report:', error);
  }
};

export const sendThreatUpdateNotification = async (domain: string, previousRating: string, newRating: string) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🚨 Security Status Changed!',
        body: `${domain} changed from ${previousRating} to ${newRating}. Tap to review.`,
        data: { 
          type: 'threat_update',
          domain,
          previousRating,
          newRating 
        },
        sound: 'default',
      },
      trigger: null, // Send immediately
    });
  } catch (error) {
    console.error('Error sending threat update:', error);
  }
};

export const sendSecurityTip = async () => {
  const tips = [
    "🔐 Always check for HTTPS in URLs before scanning!",
    "👀 Look for tampering around QR code stickers!",
    "📱 Use QR Guardian for all public QR code scans!",
    "⭐ Mark trusted sites to skip security warnings!",
    "🔄 Update your app regularly for latest security!",
  ];

  const randomTip = tips[Math.floor(Math.random() * tips.length)];

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🎯 Security Tip',
      body: randomTip,
      data: { type: 'security_tip' },
    },
    trigger: {
      seconds: 86400, // 24 hours from now
    } as any, // Type workaround
  });
};

export const isNotificationsEnabled = async (): Promise<boolean> => {
  const enabled = await AsyncStorage.getItem(NOTIFICATION_KEY);
  return enabled !== 'false'; // Default to true if not set
};

export const setNotificationsEnabled = async (enabled: boolean) => {
  await AsyncStorage.setItem(NOTIFICATION_KEY, enabled.toString());
  
  if (!enabled) {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } else {
    await scheduleWeeklyReport();
    await sendSecurityTip();
  }
};

export const initializeNotifications = async () => {
  const enabled = await isNotificationsEnabled();
  if (enabled) {
    await scheduleWeeklyReport();
    await sendSecurityTip();
  }
};