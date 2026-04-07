import {
    initializeNotifications,
    isNotificationsEnabled,
    requestNotificationPermissions,
    setNotificationsEnabled
} from '@/utils/notificationService';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
          trackColor={{ false: '#0F172A', true: '#0EA5E9' }}
          thumbColor={enabled ? '#E0F2FE' : '#CBD5E1'}
          ios_backgroundColor="#0F172A"
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#000000', '#020617', '#000000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={['#0EA5E9', '#22D3EE', '#00FF41']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.permissionButtonGradient}
              >
                <Text style={styles.permissionButtonText}>Enable Notifications</Text>
              </LinearGradient>
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

            <TouchableOpacity style={styles.testButton} onPress={handleSendTestNotification} activeOpacity={0.9}>
              <LinearGradient
                colors={['#0EA5E9', '#22D3EE', '#00FF41']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.testButtonGradient}
              >
                <Ionicons name="send" size={20} color="#03120B" />
                <Text style={styles.testButtonText}>Send Test Notification</Text>
              </LinearGradient>
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
    backgroundColor: '#000000',
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 30,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 14,
    borderRadius: 24,
    backgroundColor: 'rgba(9,12,28,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.14)',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 3,
  },
  permissionCard: {
    backgroundColor: 'rgba(9,12,28,0.9)',
    marginVertical: 10,
    padding: 18,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.16)',
    shadowColor: '#FFD700',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  permissionTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 6,
  },
  permissionText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  permissionButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  permissionButtonGradient: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionButtonText: {
    color: '#03120B',
    fontSize: 14,
    fontWeight: '800',
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginLeft: 4,
    marginBottom: 8,
    letterSpacing: 0.8,
  },
  optionCard: {
    backgroundColor: 'rgba(9,12,28,0.9)',
    marginBottom: 10,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
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
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  optionDescription: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(9,12,28,0.92)',
    marginTop: 20,
    padding: 16,
    borderRadius: 24,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.12)',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  infoText: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
  },
  testButton: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#22D3EE',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  testButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  testButtonText: {
    color: '#03120B',
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 8,
  },
});