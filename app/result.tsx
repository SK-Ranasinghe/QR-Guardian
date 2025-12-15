import { addToFavorites, isDomainFavorited, removeFromFavorites } from '@/utils/favoritesService';
import { GeminiAiInsight, runGeminiAnalysis } from '@/utils/geminiAiService';
import { fetchDomainIntel, Ip2LocationDomainInfo } from '@/utils/ip2LocationService';
import { runVirusTotalScan, VirusTotalSummary } from '@/utils/virusTotalService';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Linking, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const formatWhoisValue = (value: any): string => {
  if (value === null || value === undefined) return '-';

  if (Array.isArray(value)) {
    return value.map((v) => formatWhoisValue(v)).join(', ');
  }

  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([k, v]) => `${k}=${formatWhoisValue(v)}`)
      .join(', ');
  }

  return String(value);
};

interface WhoisEntry {
  key: string;
  value: string;
}

const buildWhoisEntries = (raw: Record<string, any>): WhoisEntry[] => {
  const entries: WhoisEntry[] = [];

  for (const [key, value] of Object.entries(raw)) {
    if (key === 'admin' || key === 'tech' || key === 'billing') {
      continue;
    }

    if (key === 'registrant' && value && typeof value === 'object' && !Array.isArray(value)) {
      const registrant = value as Record<string, any>;

      const pushIfPresent = (fieldKey: string, label: string) => {
        if (registrant[fieldKey]) {
          entries.push({ key: `registrant_${label}`, value: formatWhoisValue(registrant[fieldKey]) });
        }
      };

      pushIfPresent('name', 'name');
      pushIfPresent('organization', 'organization');
      pushIfPresent('email', 'email');
      pushIfPresent('phone', 'phone');
      pushIfPresent('street_address', 'street_address');
      pushIfPresent('city', 'city');
      pushIfPresent('region', 'region');
      pushIfPresent('country', 'country');
      pushIfPresent('zip_code', 'zip_code');

      const remaining = Object.fromEntries(
        Object.entries(registrant).filter(
          ([k]) =>
            ![
              'name',
              'organization',
              'email',
              'phone',
              'street_address',
              'city',
              'region',
              'country',
              'zip_code',
            ].includes(k),
        ),
      );

      if (Object.keys(remaining).length > 0) {
        entries.push({ key: 'registrant_other', value: formatWhoisValue(remaining) });
      }

      continue;
    }

    entries.push({ key, value: formatWhoisValue(value) });
  }

  return entries;
};

const getEngineVerdictLabel = (category: string, result: string): string => {
  const cat = (category || '').toUpperCase();

  if (cat === 'MALICIOUS') {
    return 'MALICIOUS';
  }

  if (cat === 'SUSPICIOUS') {
    return 'SUSPICIOUS';
  }

  if (cat === 'SAFE' || cat === 'UNDETECTED') {
    return 'SAFE';
  }

  return result || category || 'UNKNOWN';
};

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
  const baseScore = params.score ? Number(params.score) : 100;
  const issues: string[] = params.issues ? JSON.parse(params.issues as string) : [];

  const [isFavorited, setIsFavorited] = useState(false);
  const [showRiskModal, setShowRiskModal] = useState(false);
  const [isDeepScanLoading, setIsDeepScanLoading] = useState(false);
  const [virusTotalResult, setVirusTotalResult] = useState<VirusTotalSummary | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState<GeminiAiInsight | null>(null);
  const [isDomainIntelLoading, setIsDomainIntelLoading] = useState(false);
  const [domainIntel, setDomainIntel] = useState<Ip2LocationDomainInfo | null>(null);

  const vtPenalty = React.useMemo(() => {
    if (!virusTotalResult || !virusTotalResult.engines || virusTotalResult.engines.length === 0) {
      return 0;
    }

    const totalEngines = virusTotalResult.engines.length;
    const maliciousEngines = virusTotalResult.engines.filter(
      (engine) => engine.category === 'MALICIOUS',
    ).length;

    if (totalEngines === 0) return 0;

    const maliciousPercentage = (maliciousEngines / totalEngines) * 100;
    return Math.round(maliciousPercentage);
  }, [virusTotalResult]);

  const adjustedScore = React.useMemo(() => {
    let value = baseScore;

    if (domainIntel?.isVeryNew) {
      value -= 30;
    }

    value -= vtPenalty;

    return Math.max(0, Math.min(100, value));
  }, [baseScore, domainIntel?.isVeryNew, vtPenalty]);

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

    // If adjusted score is below 90, show custom premium confirmation modal
    if (adjustedScore < 90) {
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

  const handleDeepScan = async () => {
    if (!url) return;

    if (isDeepScanLoading) {
      Alert.alert(
        'Deep Scan in progress',
        'We\'re still syncing with VirusTotal. Your deep scan is running in the background. Hang tight for a few seconds while we finish the analysis.',
      );
      return;
    }

    try {
      setIsDeepScanLoading(true);
      setVirusTotalResult(null);

      const result = await runVirusTotalScan(url);

      if (!result) {
        Alert.alert(
          'Deep Scan unavailable',
          'We could not complete the VirusTotal deep scan. Please check your connection or try again later.'
        );
      } else {
        setVirusTotalResult(result);
      }
    } catch (error) {
      Alert.alert(
        'Deep Scan error',
        'Something went wrong while running the deep scan. Please try again.'
      );
    } finally {
      setIsDeepScanLoading(false);
    }
  };

  const handleAiAnalysis = async () => {
    if (!url) return;

    try {
      setIsAiLoading(true);
      setAiInsight(null);

      const insight = await runGeminiAnalysis(url);

      if (!insight) {
        Alert.alert(
          'AI Analysis unavailable',
          'We could not complete the AI analysis. Check your connection or try again later.'
        );
      } else {
        setAiInsight(insight);
      }
    } catch (error) {
      Alert.alert(
        'AI Analysis error',
        'Something went wrong while contacting the AI service.'
      );
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleDomainIntel = async () => {
    if (!url) return;

    if (isDomainIntelLoading) {
      Alert.alert(
        'Domain intelligence in progress',
        'We\'re still pulling WHOIS-style details from IP2LOCATION for this domain. Give it a moment while we finish building the full profile.',
      );
      return;
    }

    try {
      setIsDomainIntelLoading(true);
      setDomainIntel(null);

      const intel = await fetchDomainIntel(url);

      if (!intel) {
        Alert.alert(
          'Domain intelligence unavailable',
          'We could not retrieve domain details from IP2LOCATION. Please check your connection or try again later.',
        );
      } else {
        setDomainIntel(intel);
      }
    } catch (error) {
      Alert.alert(
        'Domain intelligence error',
        'Something went wrong while contacting the IP2LOCATION service.',
      );
    } finally {
      setIsDomainIntelLoading(false);
    }
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
          <Text style={styles.scoreValue}>{adjustedScore}</Text>
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

        {domainIntel && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Domain profile - IP2LOCATION</Text>
              {typeof domainIntel.ageDays === 'number' && (
                <Text style={styles.sectionCount}>
                  Age: {domainIntel.ageDays} day{domainIntel.ageDays === 1 ? '' : 's'}
                </Text>
              )}
            </View>

            {domainIntel.isVeryNew && (
              <View style={styles.domainIntelWarningPill}>
                <Ionicons name="warning" size={14} color="#F97316" />
                <Text style={styles.domainIntelWarningText}>
                  Very new domain detected (&#60;= 7 days). Fresh domains are commonly used in phishing and scam campaigns.
                </Text>
              </View>
            )}

            <View style={styles.domainIntelRow}>
              <Text style={styles.domainIntelLabel}>Domain</Text>
              <Text style={styles.domainIntelValue}>{domainIntel.domain}</Text>
            </View>

            {domainIntel.createdAt && (
              <View style={styles.domainIntelRow}>
                <Text style={styles.domainIntelLabel}>Created</Text>
                <Text style={styles.domainIntelValue}>
                  {new Date(domainIntel.createdAt).toLocaleDateString()}
                </Text>
              </View>
            )}

            {domainIntel.expiresAt && (
              <View style={styles.domainIntelRow}>
                <Text style={styles.domainIntelLabel}>Expires</Text>
                <Text style={styles.domainIntelValue}>
                  {new Date(domainIntel.expiresAt).toLocaleDateString()}
                </Text>
              </View>
            )}

            {domainIntel.registrar && (
              <View style={styles.domainIntelRow}>
                <Text style={styles.domainIntelLabel}>Registrar</Text>
                <Text style={styles.domainIntelValue}>{domainIntel.registrar}</Text>
              </View>
            )}

            {(domainIntel.countryName || domainIntel.countryCode) && (
              <View style={styles.domainIntelRow}>
                <Text style={styles.domainIntelLabel}>Country</Text>
                <Text style={styles.domainIntelValue}>
                  {domainIntel.countryName || domainIntel.countryCode}
                </Text>
              </View>
            )}

            {domainIntel.nameservers && domainIntel.nameservers.length > 0 && (
              <View style={styles.domainIntelRowColumn}>
                <Text style={styles.domainIntelLabel}>Nameservers</Text>
                <Text style={styles.domainIntelValue}>
                  {domainIntel.nameservers.join(', ')}
                </Text>
              </View>
            )}

            {domainIntel.raw && (
              <View style={styles.domainIntelRawBlock}>
                <Text style={styles.domainIntelRawTitle}>Full WHOIS data</Text>
                {buildWhoisEntries(domainIntel.raw).map((entry) => (
                  <View key={entry.key} style={styles.domainIntelRawRow}>
                    <Text style={styles.domainIntelRawKey}>{entry.key}</Text>
                    <Text style={styles.domainIntelRawValue}>{entry.value}</Text>
                  </View>
                ))}
              </View>
            )}
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

        <TouchableOpacity style={styles.deepScanButton} onPress={handleDeepScan}>
          <Ionicons name="shield-checkmark" size={20} color="#22C55E" />
          <View style={styles.deepScanTextGroup}>
            <Text style={styles.deepScanTitle}>Deep Scan</Text>
            <Text style={styles.deepScanSubtitle}>
              Run an advanced security scan with VirusTotal for this link.
            </Text>
          </View>
          {isDeepScanLoading ? (
            <Ionicons name="time-outline" size={18} color="#FACC15" />
          ) : (
            <Ionicons name="chevron-forward" size={18} color="#6B7280" />
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.domainIntelButton} onPress={handleDomainIntel}>
          <Ionicons name="globe-outline" size={20} color="#38BDF8" />
          <View style={styles.domainIntelTextGroup}>
            <Text style={styles.domainIntelTitle}>Domain intelligence</Text>
            <Text style={styles.domainIntelSubtitle}>
              Check domain age, registrar and WHOIS-style details via IP2LOCATION.
            </Text>
          </View>
          {isDomainIntelLoading ? (
            <Ionicons name="time-outline" size={18} color="#FACC15" />
          ) : (
            <Ionicons name="chevron-forward" size={18} color="#6B7280" />
          )}
        </TouchableOpacity>

        {virusTotalResult && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Deep Scan - VirusTotal</Text>
              <Text style={styles.sectionCount}>External threat database</Text>
            </View>

            <View style={styles.vtRow}>
              <View style={styles.vtPillHarmless}>
                <Text style={styles.vtPillLabel}>Harmless</Text>
                <Text style={styles.vtPillValue}>{virusTotalResult.harmless}</Text>
              </View>
              <View style={styles.vtPillSuspicious}>
                <Text style={styles.vtPillLabel}>Suspicious</Text>
                <Text style={styles.vtPillValue}>{virusTotalResult.suspicious}</Text>
              </View>
              <View style={styles.vtPillMalicious}>
                <Text style={styles.vtPillLabel}>Malicious</Text>
                <Text style={styles.vtPillValue}>{virusTotalResult.malicious}</Text>
              </View>
            </View>

            <View style={styles.vtRowSecondary}>
              <Text style={styles.vtSecondaryText}>
                Undetected: {virusTotalResult.undetected} • Timeouts: {virusTotalResult.timeout}
              </Text>
              {virusTotalResult.scanDate && (
                <Text style={styles.vtSecondaryText}>
                  Last analysis: {new Date(virusTotalResult.scanDate).toLocaleString()}
                </Text>
              )}
              <Text style={styles.vtSourceText}>Data from VirusTotal API</Text>
              <Text style={styles.vtNoteText}>
                Verdict: {virusTotalResult.verdict}
              </Text>
              <Text style={styles.vtNoteText}>
                VirusTotal reports only known threats. QR Guardian can still flag new or lookalike domains even when external databases show zero detections.
              </Text>
            </View>

            {virusTotalResult.detections && virusTotalResult.detections.length > 0 && (
              <View style={styles.domainIntelRawBlock}>
                <Text style={styles.domainIntelRawTitle}>Engines that flagged this URL</Text>
                {virusTotalResult.detections.map((detection) => (
                  <View key={`${detection.engine}-${detection.result}`} style={styles.domainIntelRawRow}>
                    <Text style={styles.domainIntelRawKey}>{detection.engine}</Text>
                    <Text style={styles.domainIntelRawValue}>
                      {getEngineVerdictLabel(detection.category, detection.result)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {virusTotalResult.engines && virusTotalResult.engines.length > 0 && (
              <View style={styles.domainIntelRawBlock}>
                <Text style={styles.domainIntelRawTitle}>All security vendors</Text>
                <ScrollView style={styles.vtEnginesScroll} nestedScrollEnabled>
                  {[...virusTotalResult.engines]
                    .sort((a, b) => {
                      const weight = (category: string) => {
                        const cat = (category || '').toUpperCase();
                        if (cat === 'MALICIOUS') return 0;
                        if (cat === 'SUSPICIOUS') return 1;
                        return 2; // SAFE / UNDETECTED / UNKNOWN
                      };
                      return weight(a.category) - weight(b.category);
                    })
                    .map((engine) => (
                    <View key={`${engine.engine}-${engine.result}`} style={styles.domainIntelRawRow}>
                      <Text style={styles.domainIntelRawKey}>{engine.engine}</Text>
                      <Text style={styles.domainIntelRawValue}>
                        {getEngineVerdictLabel(engine.category, engine.result)}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {virusTotalResult.permalink && (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.vtSourceText} numberOfLines={2}>
                  Report URL: {virusTotalResult.permalink}
                </Text>
              </View>
            )}
          </View>
        )}

        <TouchableOpacity style={styles.aiButton} onPress={handleAiAnalysis}>
          <Ionicons name="sparkles-outline" size={20} color="#38BDF8" />
          <View style={styles.aiButtonTextGroup}>
            <Text style={styles.aiButtonTitle}>Run AI Analysis</Text>
            <Text style={styles.aiButtonSubtitle}>
              Let AI inspect semantics & patterns for zero-day style threats.
            </Text>
          </View>
          {isAiLoading ? (
            <Text style={styles.aiLoadingText}>AI is analyzing semantics & pattern matching...</Text>
          ) : (
            <Ionicons name="chevron-forward" size={18} color="#6B7280" />
          )}
        </TouchableOpacity>

        {aiInsight && (
          <View style={styles.aiCardWrapper}>
            <BlurView intensity={40} tint="dark" style={styles.aiBlurCard}>
              <View style={styles.aiHeaderRow}>
                <View style={styles.aiIconCircle}>
                  <Ionicons name="shield" size={18} color="#38BDF8" />
                </View>
                <View style={styles.aiHeaderTextGroup}>
                  <Text style={styles.aiTitle}>AI Insight</Text>
                  <Text style={styles.aiSubtitle}>Gemini 1.5 Flash analysis</Text>
                </View>
                <View
                  style={[
                    styles.aiVerdictPill,
                    aiInsight.verdict === 'SAFE'
                      ? styles.aiVerdictSafe
                      : aiInsight.verdict === 'SUSPICIOUS'
                      ? styles.aiVerdictSuspicious
                      : styles.aiVerdictDangerous,
                  ]}
                >
                  <Text style={styles.aiVerdictText}>{aiInsight.verdict}</Text>
                </View>
              </View>

              <View style={styles.aiReasonBlock}>
                <Text style={styles.aiReasonLabel}>Why</Text>
                <Text style={styles.aiReasonText}>{aiInsight.reason}</Text>
              </View>

              <View style={styles.aiRiskRow}>
                <Text style={styles.aiRiskLabel}>Risk score</Text>
                <Text style={styles.aiRiskValue}>{Math.round(aiInsight.riskScore)}/100</Text>
              </View>
              <View style={styles.aiRiskBarTrack}>
                <View
                  style={[
                    styles.aiRiskBarFill,
                    {
                      width: `${Math.max(0, Math.min(100, aiInsight.riskScore))}%`,
                      backgroundColor:
                        aiInsight.riskScore < 40
                          ? '#22C55E'
                          : aiInsight.riskScore < 70
                          ? '#FACC15'
                          : '#EF4444',
                    },
                  ]}
                />
              </View>

              <Text style={styles.aiThreatTypeText}>Threat type: {aiInsight.threatType}</Text>
            </BlurView>
          </View>
        )}

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
                This QR scored {adjustedScore}/100 in QR Guardian.
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
  deepScanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 14,
  },
  deepScanTextGroup: {
    flex: 1,
    marginLeft: 10,
  },
  deepScanTitle: {
    color: '#E5E7EB',
    fontSize: 15,
    fontWeight: '600',
  },
  deepScanSubtitle: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  vtRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  vtRowSecondary: {
    marginTop: 10,
  },
  vtPillBase: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    marginRight: 8,
  },
  vtPillHarmless: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flex: 1,
    marginRight: 6,
  },
  vtPillSuspicious: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flex: 1,
    marginHorizontal: 3,
  },
  vtPillMalicious: {
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flex: 1,
    marginLeft: 6,
  },
  vtPillLabel: {
    color: '#9CA3AF',
    fontSize: 11,
    marginBottom: 2,
  },
  vtPillValue: {
    color: '#F9FAFB',
    fontSize: 18,
    fontWeight: '700',
  },
  vtSecondaryText: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  vtSourceText: {
    color: '#6B7280',
    fontSize: 10,
    marginTop: 4,
  },
  vtNoteText: {
    color: '#6B7280',
    fontSize: 10,
    marginTop: 4,
    lineHeight: 14,
  },
  vtEnginesScroll: {
    maxHeight: 160,
    marginTop: 6,
  },
  domainIntelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#0F172A',
    marginBottom: 14,
  },
  domainIntelTextGroup: {
    flex: 1,
    marginLeft: 10,
  },
  domainIntelTitle: {
    color: '#E5E7EB',
    fontSize: 15,
    fontWeight: '600',
  },
  domainIntelSubtitle: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  domainIntelWarningPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(248, 153, 50, 0.12)',
    marginBottom: 10,
  },
  domainIntelWarningText: {
    marginLeft: 6,
    color: '#FBBF24',
    fontSize: 11,
    flex: 1,
  },
  domainIntelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  domainIntelRowColumn: {
    marginTop: 6,
  },
  domainIntelLabel: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  domainIntelValue: {
    color: '#F9FAFB',
    fontSize: 13,
    marginLeft: 12,
    flexShrink: 1,
    textAlign: 'right',
  },
  domainIntelRawBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1F2933',
  },
  domainIntelRawTitle: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  domainIntelRawRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
  },
  domainIntelRawKey: {
    color: '#6B7280',
    fontSize: 11,
    width: 110,
  },
  domainIntelRawValue: {
    color: '#E5E7EB',
    fontSize: 11,
    flex: 1,
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#0F172A',
    marginBottom: 14,
  },
  aiButtonTextGroup: {
    flex: 1,
    marginLeft: 10,
  },
  aiButtonTitle: {
    color: '#E5E7EB',
    fontSize: 15,
    fontWeight: '600',
  },
  aiButtonSubtitle: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  aiLoadingText: {
    color: '#FACC15',
    fontSize: 10,
    maxWidth: 120,
    textAlign: 'right',
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
  aiCardWrapper: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },
  aiBlurCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    backgroundColor: 'rgba(15,23,42,0.85)',
  },
  aiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aiIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(56,189,248,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  aiHeaderTextGroup: {
    flex: 1,
  },
  aiTitle: {
    color: '#E5E7EB',
    fontSize: 15,
    fontWeight: '600',
  },
  aiSubtitle: {
    color: '#9CA3AF',
    fontSize: 11,
    marginTop: 2,
  },
  aiVerdictPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  aiVerdictSafe: {
    backgroundColor: 'rgba(34,197,94,0.18)',
  },
  aiVerdictSuspicious: {
    backgroundColor: 'rgba(250,204,21,0.18)',
  },
  aiVerdictDangerous: {
    backgroundColor: 'rgba(248,113,113,0.18)',
  },
  aiVerdictText: {
    color: '#F9FAFB',
    fontSize: 11,
    fontWeight: '700',
  },
  aiReasonBlock: {
    marginTop: 14,
  },
  aiReasonLabel: {
    color: '#9CA3AF',
    fontSize: 11,
    marginBottom: 4,
  },
  aiReasonText: {
    color: '#F9FAFB',
    fontSize: 13,
    lineHeight: 18,
  },
  aiRiskRow: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aiRiskLabel: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  aiRiskValue: {
    color: '#F9FAFB',
    fontSize: 13,
    fontWeight: '600',
  },
  aiRiskBarTrack: {
    marginTop: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(31,41,55,1)',
    overflow: 'hidden',
  },
  aiRiskBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  aiThreatTypeText: {
    marginTop: 10,
    color: '#9CA3AF',
    fontSize: 11,
  },
});
