import {
    initializeNotifications,
    isNotificationsEnabled,
    requestNotificationPermissions,
    setNotificationsEnabled
} from '@/utils/notificationService';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

export default function NotificationsScreen() {
  const [notificationsEnabled, setNotificationsEnabledState] = useState(true);
  const [threatAlerts, setThreatAlerts] = useState(true);
  const [weeklyReports, setWeeklyReports] = useState(true);
  const [securityTips, setSecurityTips] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const enabled = await isNotificationsEnabled();
    setNotificationsEnabledState(enabled);
    
    // Check if we have permission
    const { status } = await Notifications.getPermissionsAsync();
    setPermissionGranted(status === 'granted');
  };

  const handleNotificationsToggle = async (value: boolean) => {
    if (value) {
      // Turning ON
      let granted = permissionGranted;

      if (!granted) {
        granted = await requestNotificationPermissions();
        setPermissionGranted(granted);
      }

      if (!granted) {
        // Permission denied: keep toggle OFF and ensure notifications are disabled
        setNotificationsEnabledState(false);
        await setNotificationsEnabled(false);
        return;
      }

      await setNotificationsEnabled(true);
      await initializeNotifications();
      setNotificationsEnabledState(true);
    } else {
      // Turning OFF
      await setNotificationsEnabled(false);
      setNotificationsEnabledState(false);
    }
  };

  const requestPermission = async () => {
    const granted = await requestNotificationPermissions();
    setPermissionGranted(granted);
    if (granted) {
      setNotificationsEnabledState(true);
      await setNotificationsEnabled(true);
    }
  };

  const handleSendTestNotification = async () => {
    // Reuse existing permission state when possible
    let granted = permissionGranted;

    if (!granted) {
      granted = await requestNotificationPermissions();
      setPermissionGranted(granted);
    }

    if (!granted) {
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'QR Guardian Test Notification',
        body: 'This is a test alert from QR Guardian.',
        data: { type: 'test_notification' },
      },
      trigger: null,
    });
  };

  const NotificationOption = ({ 
    icon, 
    title, 
    description, 
    enabled, 
    onToggle,
    disabled,
  }: any) => (
    <View style={styles.optionCard}>
      <View style={styles.optionHeader}>
        <Ionicons name={icon} size={24} color="#007AFF" />
        <View style={styles.optionText}>
          <Text style={styles.optionTitle}>{title}</Text>
          <Text style={styles.optionDescription}>{description}</Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={onToggle}
          disabled={disabled}
          trackColor={{ false: '#3A3A3C', true: '#007AFF' }}
          ios_backgroundColor="#3A3A3C"
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>Stay updated on your security</Text>
        </View>

        {!permissionGranted && (
          <View style={styles.permissionCard}>
            <Ionicons name="notifications-off" size={40} color="#FF9500" />
            <Text style={styles.permissionTitle}>Notifications Disabled</Text>
            <Text style={styles.permissionText}>
              Enable notifications to get security alerts and weekly reports.
            </Text>
            <TouchableOpacity 
              style={styles.permissionButton}
              onPress={requestPermission}
            >
              <Text style={styles.permissionButtonText}>Enable Notifications</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Global Settings</Text>
          <NotificationOption
            icon="notifications"
            title="Enable All Notifications"
            description="Receive all security alerts and updates"
            enabled={notificationsEnabled}
            onToggle={handleNotificationsToggle}
            disabled={false}
          />
        </View>

        {notificationsEnabled && permissionGranted && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Alert Types</Text>
              <NotificationOption
                icon="alert-circle"
                title="Threat Alerts"
                description="Get notified when scanned sites become dangerous"
                enabled={threatAlerts}
                onToggle={setThreatAlerts}
                disabled={!notificationsEnabled}
              />
              <NotificationOption
                icon="stats-chart"
                title="Weekly Reports"
                description="Receive weekly scan statistics every Sunday"
                enabled={weeklyReports}
                onToggle={setWeeklyReports}
                disabled={!notificationsEnabled}
              />
              <NotificationOption
                icon="bulb"
                title="Security Tips"
                description="Daily tips to improve your security habits"
                enabled={securityTips}
                onToggle={setSecurityTips}
                disabled={!notificationsEnabled}
              />
            </View>

            <View style={styles.infoCard}>
              <Ionicons name="information-circle" size={24} color="#007AFF" />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>How Notifications Work</Text>
                <Text style={styles.infoText}>
                  • Threat alerts: Sent when a previously scanned site becomes dangerous
                  {'\n'}• Weekly reports: Sent every Sunday at 10 AM
                  {'\n'}• Security tips: Random tips sent once per day
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.testButton} onPress={handleSendTestNotification}>
              <Ionicons name="send" size={20} color="#FFFFFF" />
              <Text style={styles.testButtonText}>Send Test Notification</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  scrollContent: {
    paddingBottom: 30,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#8E8E93',
    fontSize: 14,
    marginTop: 2,
  },
  permissionCard: {
    backgroundColor: '#2C2C2E',
    marginHorizontal: 20,
    marginVertical: 10,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  permissionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 6,
  },
  permissionText: {
    color: '#8E8E93',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginTop: 10,
  },
  sectionTitle: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginLeft: 20,
    marginBottom: 6,
  },
  optionCard: {
    backgroundColor: '#2C2C2E',
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionText: {
    flex: 1,
    marginLeft: 12,
  },
  optionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  optionDescription: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 2,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#2C2C2E',
    marginHorizontal: 20,
    marginTop: 20,
    padding: 16,
    borderRadius: 14,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoText: {
    color: '#8E8E93',
    fontSize: 12,
    lineHeight: 16,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34C759',
    marginHorizontal: 20,
    marginTop: 20,
    padding: 16,
    borderRadius: 14,
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});