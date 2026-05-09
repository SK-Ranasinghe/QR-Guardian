import { GlassCard } from '@/components/ui/premium-ui';
import { addToFavorites, getFavorites } from '@/utils/favoritesService';
import { ScanHistoryItem, clearHistory, deleteHistoryItem, getScanHistory } from '@/utils/historyService';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HistoryScreen() {
  const router = useRouter();
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [favoriteDomains, setFavoriteDomains] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isCompactLayout = width < 390;
  const [feedbackModal, setFeedbackModal] = useState<{
    title: string;
    message: string;
    icon: 'star' | 'star-outline';
    accentColor: string;
  } | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setRefreshing(true);
    const [data, favorites] = await Promise.all([getScanHistory(), getFavorites()]);
    setHistory(data);
    setFavoriteDomains(favorites.map((favorite) => favorite.domain));
    setRefreshing(false);
  };

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

  const handleCloseFeedbackModal = () => {
    setFeedbackModal(null);
  };

  const handleTrustFromHistory = async (item: ScanHistoryItem) => {
    await Haptics.selectionAsync();

    const domain = extractDomain(item.url);

    if (favoriteDomains.includes(domain)) {
      setFeedbackModal({
        title: 'Already in Trusted Sites',
        message: `${domain} is already saved in your trusted list.`,
        icon: 'star',
        accentColor: '#FFD700',
      });
      return;
    }

    const added = await addToFavorites(item.url, item.safetyRating);

    if (added) {
      setFavoriteDomains((current) => [domain, ...current]);
      setFeedbackModal({
        title: 'Added to Trusted Sites',
        message: `${domain} was added from your scan history.`,
        icon: 'star',
        accentColor: '#FFD700',
      });
    }
  };

  const handleOpenHistoryItem = async (item: ScanHistoryItem) => {
    await Haptics.selectionAsync();
    router.push({
      pathname: '/result',
      params: {
        url: item.url,
        rating: item.safetyRating,
        score: String(item.score),
        issues: JSON.stringify(item.issues ?? []),
      },
    });
  };

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'SAFE': return '#00FF41';
      case 'CAUTION': return '#FFD700';
      case 'DANGEROUS': return '#FF0000';
      default: return '#38BDF8';
    }
  };

  const getRatingIcon = (rating: string) => {
    switch (rating) {
      case 'SAFE': return 'shield-checkmark';
      case 'CAUTION': return 'warning';
      case 'DANGEROUS': return 'skull';
      default: return 'help';
    }
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString();
  };

  const renderItem = ({ item, index }: { item: ScanHistoryItem; index: number }) => {
    const domain = extractDomain(item.url);
    const isFavorited = favoriteDomains.includes(domain);

    return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(320)}>
      <TouchableOpacity onPress={() => handleOpenHistoryItem(item)} activeOpacity={0.92}>
        <GlassCard style={styles.historyCardShell} glowColor={`${getRatingColor(item.safetyRating)}33`} contentStyle={styles.historyCard}>
          <LinearGradient
            colors={[
              `${getRatingColor(item.safetyRating)}1F`,
              'rgba(255,255,255,0.03)',
              'rgba(2,6,23,0.12)',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.historyCardTopRow}>
            <View style={[styles.ratingBadge, { backgroundColor: getRatingColor(item.safetyRating) }]}>
              <Ionicons name={getRatingIcon(item.safetyRating)} size={16} color="#03120B" />
              <Text style={styles.ratingText}>{item.safetyRating}</Text>
            </View>
            <View style={styles.itemActionsRow}>
              <TouchableOpacity
                onPress={() => handleTrustFromHistory(item)}
                style={[styles.itemTrustButton, isFavorited && styles.itemTrustButtonActive]}
                activeOpacity={0.85}
              >
                <Ionicons name={isFavorited ? 'star' : 'star-outline'} size={15} color={isFavorited ? '#FFD700' : '#E5E7EB'} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  await deleteHistoryItem(item.id);
                  await loadHistory();
                }}
                style={styles.itemDeleteButton}
                activeOpacity={0.85}
              >
                <Ionicons name="trash-outline" size={15} color="#F87171" />
              </TouchableOpacity>
            </View>
          </View>
          
          <Text style={styles.urlText} numberOfLines={1}>{item.url}</Text>
          
          <View style={styles.historyDetails}>
            <Text style={styles.scoreText}>Score: {item.score}/100</Text>
            <Text style={styles.timeText}>
              {formatDate(item.timestamp)} • {formatTime(item.timestamp)}
            </Text>
          </View>

          {item.issues.length > 0 && (
            <Text style={styles.issuesText} numberOfLines={1}>
              Issues: {item.issues.slice(0, 2).join(', ')}
              {item.issues.length > 2 ? `... (+${item.issues.length - 2})` : ''}
            </Text>
          )}
        </GlassCard>
      </TouchableOpacity>
    </Animated.View>
    );
  };

  const handleClearHistory = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await clearHistory();
    loadHistory();
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#000000', '#020617', '#000000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={[styles.header, isCompactLayout && styles.headerCompact, { paddingTop: Math.max(insets.top + 12, 20) }]}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>Scan History</Text>
          <Text style={styles.subtitle}>Review all QR safety checks you&apos;ve done</Text>
        </View>
        {history.length > 0 && (
          <TouchableOpacity onPress={handleClearHistory} style={[styles.clearButton, isCompactLayout && styles.clearButtonCompact]} activeOpacity={0.9}>
            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            <Text style={styles.clearText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {history.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="time-outline" size={60} color="#8E8E93" />
          <Text style={styles.emptyTitle}>No Scan History</Text>
          <Text style={styles.emptyText}>
            Your scanned QR codes will appear here once you start using QR Guardian.
          </Text>
        </View>
      ) : (
        <FlatList
          data={history}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          refreshing={refreshing}
          onRefresh={loadHistory}
          contentContainerStyle={styles.listContent}
        />
      )}

      <GlassCard style={styles.statsBarShell} glowColor="rgba(56,189,248,0.14)" contentStyle={[styles.statsBar, isCompactLayout && styles.statsBarCompact]}>
        <View style={[styles.statItem, isCompactLayout && styles.statItemCompact]}>
          <Text style={styles.statNumber}>{history.length}</Text>
          <Text style={styles.statLabel}>Total Scans</Text>
        </View>
        
        <View style={[styles.statDivider, isCompactLayout && styles.statDividerCompact]} />
        
        <View style={[styles.statItem, isCompactLayout && styles.statItemCompact]}>
          <Text style={styles.statNumber}>
            {history.filter(h => h.safetyRating === 'SAFE').length}
          </Text>
          <Text style={styles.statLabel}>Safe</Text>
        </View>
        
        <View style={[styles.statDivider, isCompactLayout && styles.statDividerCompact]} />
        
        <View style={[styles.statItem, isCompactLayout && styles.statItemCompact]}>
          <Text style={styles.statNumber}>
            {history.filter(h => h.safetyRating !== 'SAFE').length}
          </Text>
          <Text style={styles.statLabel}>Risky</Text>
        </View>
      </GlassCard>

      {feedbackModal && (
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.modalCardShell} glowColor={`${feedbackModal.accentColor}88`} contentStyle={[styles.modalCard, styles.feedbackCard]}>
            <View style={[styles.modalIconWrapper, { backgroundColor: `${feedbackModal.accentColor}22` }]}>
              <Ionicons name={feedbackModal.icon} size={24} color={feedbackModal.accentColor} />
            </View>
            <Text style={styles.modalTitle}>{feedbackModal.title}</Text>
            <Text style={styles.modalMessage}>{feedbackModal.message}</Text>
            <TouchableOpacity style={[styles.modalConfirmButton, styles.feedbackButton, { backgroundColor: feedbackModal.accentColor }]} onPress={handleCloseFeedbackModal} activeOpacity={0.9}>
              <Text style={styles.feedbackButtonText}>Got it</Text>
            </TouchableOpacity>
          </GlassCard>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
  },
  headerCompact: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  headerTextWrap: {
    flexShrink: 1,
    paddingRight: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 2,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(127,29,29,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.18)',
  },
  clearButtonCompact: {
    marginTop: 12,
  },
  clearText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  historyCardShell: {
    marginBottom: 12,
  },
  historyCard: {
    backgroundColor: 'rgba(5,10,20,0.84)',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
  },
  historyCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  itemTrustButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(250,204,21,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.18)',
    marginRight: 8,
  },
  itemTrustButtonActive: {
    backgroundColor: 'rgba(250,204,21,0.22)',
    borderColor: 'rgba(250,204,21,0.34)',
  },
  itemDeleteButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(127,29,29,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.18)',
  },
  ratingText: {
    color: '#03120B',
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 4,
  },
  urlText: {
    color: '#E2E8F0',
    fontSize: 14,
    marginBottom: 8,
  },
  historyDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  scoreText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  timeText: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
  issuesText: {
    color: '#FBBF24',
    fontSize: 12,
    fontStyle: 'italic',
  },
  statsBarShell: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(5,10,20,0.82)',
    borderRadius: 20,
    paddingVertical: 16,
  },
  statsBarCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statItemCompact: {
    paddingVertical: 8,
  },
  statNumber: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: {
    color: '#94A3B8',
    fontSize: 12,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(148,163,184,0.14)',
  },
  statDividerCompact: {
    width: '100%',
    height: 1,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCardShell: {
    width: '100%',
    maxWidth: 360,
  },
  modalCard: {
    backgroundColor: 'rgba(5,10,20,0.92)',
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalIconWrapper: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  modalMessage: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 18,
  },
  modalConfirmButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackCard: {
    alignItems: 'center',
  },
  feedbackButton: {
    alignSelf: 'stretch',
  },
  feedbackButtonText: {
    color: '#03120B',
    fontSize: 13,
    fontWeight: '800',
  },
});