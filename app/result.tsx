import { addToFavorites, isDomainFavorited, removeFromFavorites } from '@/utils/favoritesService';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Linking, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    url?: string;
    rating?: string;
    score?: string;
    issues?: string;
  }>();

  const url = (params.url as string) || '';
  const rating = (params.rating as string) || 'SAFE';
  const score = params.score ? Number(params.score) : 100;
  const issues: string[] = params.issues ? JSON.parse(params.issues as string) : [];

  const [isFavorited, setIsFavorited] = useState(false);
  const [showRiskModal, setShowRiskModal] = useState(false);

  useEffect(() => {
    if (!url) return;

    const checkFavorite = async () => {
      const favorited = await isDomainFavorited(url);
      setIsFavorited(favorited);
    };

    checkFavorite();
  }, [url]);

  const extractDomain = (value: string): string => {
    try {
      let cleanUrl = value.toLowerCase().trim();
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = 'http://' + cleanUrl;
      }
      const urlObj = new URL(cleanUrl);
      let domain = urlObj.hostname;
      if (domain.startsWith('www.')) {
        domain = domain.substring(4);
      }
      return domain;
    } catch {
      const cleanUrl = value.toLowerCase().trim();
      const match = cleanUrl.match(/(?:https?:\/\/)?(?:www\.)?([^\/:\?]+)/);
      return match ? match[1] : cleanUrl;
    }
  };

  const getRatingColor = (value: string) => {
    switch (value) {
      case 'SAFE':
        return '#34C759';
      case 'CAUTION':
        return '#FF9500';
      case 'DANGEROUS':
        return '#FF3B30';
      default:
        return '#8E8E93';
    }
  };

  const getRatingIcon = (value: string) => {
    switch (value) {
      case 'SAFE':
        return 'shield-checkmark';
      case 'CAUTION':
        return 'warning';
      case 'DANGEROUS':
        return 'skull';
      default:
        return 'help';
    }
  };

  const handleFavoriteToggle = async () => {
    if (!url) return;

    const domain = extractDomain(url);

    if (isFavorited) {
      const removed = await removeFromFavorites(domain);
      if (removed) {
        setIsFavorited(false);
        Alert.alert('Removed from Trusted Sites', 'Domain removed from your trusted list.');
      }
    } else {
      const added = await addToFavorites(domain, rating);
      if (added) {
        setIsFavorited(true);
        Alert.alert('Added to Trusted Sites', 'Domain added to your trusted list.');
      }
    }
  };

  const handleScanAgain = () => {
    router.replace('/(tabs)');
  };

  const getOpenAction = (value: string) => {
    const raw = value.trim();
    const lower = raw.toLowerCase();

    // Explicit schemes first
    if (lower.startsWith('smsto:')) {
      const smsPayload = raw.slice(6);
      const [number, ...messageParts] = smsPayload.split(':');
      const message = messageParts.join(':');
      return { type: 'sms' as const, number, message };
    }

    if (lower.startsWith('tel:')) {
      return { type: 'tel' as const, number: raw.substring(4) };
    }

    if (lower.startsWith('http://') || lower.startsWith('https://')) {
      return { type: 'web' as const, url: raw };
    }

    // Fallback: SMS-style two-line payload (e.g., "1337\nSUBSCRIBE $50")
    const smsLines = raw.split(/\r?\n/);
    const firstLine = smsLines[0]?.trim() || '';
    const restLines = smsLines.slice(1).join(' ').trim();
    const phoneLike = /^\+?[0-9]{3,}$/.test(firstLine);

    if (phoneLike && restLines.length > 0) {
      return { type: 'sms' as const, number: firstLine, message: restLines };
    }

    // Fallback: plain phone number
    if (/^\+?[0-9]{6,}$/.test(raw)) {
      return { type: 'tel' as const, number: raw };
    }

    // Default: treat as web URL, add http:// if missing
    const webUrl = raw.startsWith('http://') || raw.startsWith('https://')
      ? raw
      : `http://${raw}`;
    return { type: 'web' as const, url: webUrl };
  };

  const performOpen = async () => {
    if (!url) return;

    try {
      const action = getOpenAction(url);

      if (action.type === 'web') {
        await Linking.openURL(action.url);
      } else if (action.type === 'tel') {
        await Linking.openURL(`tel:${action.number}`);
      } else if (action.type === 'sms') {
        const base = `sms:${action.number}`;
        const link = action.message
          ? `${base}?body=${encodeURIComponent(action.message)}`
          : base;
        await Linking.openURL(link);
      }
    } catch (error) {
      Alert.alert('Unable to open', 'Your device could not handle this QR action.');
    }
  };

  const handleOpen = () => {
    if (!url) return;

    // If score is below 90, show custom premium confirmation modal
    if (score < 90) {
      setShowRiskModal(true);
      return;
    }

    void performOpen();
  };

  const handleRiskCancel = () => {
    setShowRiskModal(false);
  };

  const handleRiskConfirm = () => {
    setShowRiskModal(false);
    void performOpen();
  };

  if (!url) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle" size={60} color="#FF3B30" />
          <Text style={styles.emptyTitle}>No Result Data</Text>
          <Text style={styles.emptyText}>
            Scan a QR code from the Home tab to see detailed safety results here.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={handleScanAgain}>
            <Ionicons name="scan-outline" size={20} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Back to Scanner</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Ionicons name="shield" size={26} color="#FFFFFF" />
            <View style={styles.headerTextGroup}>
              <Text style={styles.title}>Scan Result</Text>
              <Text style={styles.subtitle}>Security analysis for this QR link</Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleScanAgain} style={styles.headerAction}>
            <Ionicons name="scan-outline" size={18} color="#0A84FF" />
            <Text style={styles.headerActionText}>Scan Again</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.ratingCard, { borderColor: getRatingColor(rating) }]}>
          <View style={[styles.ratingBadge, { backgroundColor: getRatingColor(rating) }]}>
            <Ionicons name={getRatingIcon(rating)} size={22} color="#FFFFFF" />
            <Text style={styles.ratingLabel}>{rating}</Text>
          </View>
          <Text style={styles.scoreValue}>{score}</Text>
          <Text style={styles.scoreSuffix}>/ 100 safety score</Text>
          <Text style={styles.scoreHint}>
            Higher scores indicate safer destinations based on multiple security checks.
          </Text>
        </View>

        {issues.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Security notes</Text>
              <Text style={styles.sectionCount}>{issues.length} issue{issues.length === 1 ? '' : 's'}</Text>
            </View>
            {issues.map((issue, index) => (
              <View key={index} style={styles.issueRow}>
                <Ionicons name="information-circle" size={16} color="#FF9500" />
                <Text style={styles.issueText}>{issue}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Scanned URL</Text>
          <Text style={styles.urlText} numberOfLines={3}>
            {url}
          </Text>
        </View>

        <TouchableOpacity style={styles.openButton} onPress={handleOpen}>
          <Ionicons name="open-outline" size={20} color="#FFFFFF" />
          <Text style={styles.openButtonText}>Open</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.trustButton} onPress={handleFavoriteToggle}>
          <Ionicons
            name={isFavorited ? 'star' : 'star-outline'}
            size={22}
            color={isFavorited ? '#FFD700' : '#FFFFFF'}
          />
          <View style={styles.trustTextGroup}>
            <Text style={styles.trustTitle}>{isFavorited ? 'Trusted site' : 'Trust this site'}</Text>
            <Text style={styles.trustSubtitle}>
              {isFavorited
                ? 'This domain is marked as trusted in QR Guardian.'
                : 'Mark this domain as trusted to reduce future warnings.'}
            </Text>
          </View>
        </TouchableOpacity>

        {showRiskModal && (
          <View style={styles.riskOverlay}>
            <View style={styles.riskCard}>
              <View style={styles.riskIconWrapper}>
                <Ionicons name="warning" size={26} color="#FFCC00" />
              </View>
              <Text style={styles.riskTitle}>Proceed with caution</Text>
              <Text style={styles.riskMessage}>
                This QR scored {score}/100 in QR Guardian.
                {'\n'}
                {'\n'}Lower scores can indicate phishing, hidden charges, or risky destinations.
              </Text>
              <View style={styles.riskButtonsRow}>
                <TouchableOpacity style={styles.riskCancelButton} onPress={handleRiskCancel}>
                  <Text style={styles.riskCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.riskConfirmButton} onPress={handleRiskConfirm}>
                  <Text style={styles.riskConfirmText}>Open anyway</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
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
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTextGroup: {
    marginLeft: 10,
    flexShrink: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 2,
  },
  headerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(10,132,255,0.12)',
    marginLeft: 8,
  },
  headerActionText: {
    color: '#0A84FF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  ratingCard: {
    backgroundColor: '#111111',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
  },
  ratingBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 12,
  },
  ratingLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  scoreValue: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '800',
  },
  scoreSuffix: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 2,
  },
  scoreHint: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 8,
    lineHeight: 16,
  },
  sectionCard: {
    backgroundColor: '#111111',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionCount: {
    color: '#8E8E93',
    fontSize: 12,
  },
  issueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 6,
  },
  issueText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  urlText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 4,
  },
  trustButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#111111',
    marginBottom: 14,
  },
  trustTextGroup: {
    marginLeft: 10,
    flex: 1,
  },
  trustTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  trustSubtitle: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 2,
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C1C1E',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    marginBottom: 12,
  },
  openButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  riskOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  riskCard: {
    width: '85%',
    backgroundColor: '#1C1C1E',
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 22,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  riskIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,204,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  riskTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  riskMessage: {
    color: '#F2F2F7',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 18,
  },
  riskButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  riskCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#3A3A3C',
    marginRight: 8,
  },
  riskCancelText: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '500',
  },
  riskConfirmButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#FF3B30',
  },
  riskConfirmText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A84FF',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: '#000000',
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 18,
  },
});
