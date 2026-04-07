import { GlassCard } from '@/components/ui/premium-ui';
import { ScanHistoryItem, clearHistory, deleteHistoryItem, getScanHistory } from '@/utils/historyService';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function HistoryScreen() {
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setRefreshing(true);
    const data = await getScanHistory();
    setHistory(data);
    setRefreshing(false);
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

  const renderItem = ({ item, index }: { item: ScanHistoryItem; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(320)}>
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
    </Animated.View>
  );

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
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Scan History</Text>
          <Text style={styles.subtitle}>Review all QR safety checks you&apos;ve done</Text>
        </View>
        {history.length > 0 && (
          <TouchableOpacity onPress={handleClearHistory} style={styles.clearButton} activeOpacity={0.9}>
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

      <GlassCard style={styles.statsBarShell} glowColor="rgba(56,189,248,0.14)" contentStyle={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{history.length}</Text>
          <Text style={styles.statLabel}>Total Scans</Text>
        </View>
        
        <View style={styles.statDivider} />
        
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {history.filter(h => h.safetyRating === 'SAFE').length}
          </Text>
          <Text style={styles.statLabel}>Safe</Text>
        </View>
        
        <View style={styles.statDivider} />
        
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {history.filter(h => h.safetyRating !== 'SAFE').length}
          </Text>
          <Text style={styles.statLabel}>Risky</Text>
        </View>
      </GlassCard>
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
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
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
  },
  scoreText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  timeText: {
    color: '#94A3B8',
    fontSize: 12,
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
  statItem: {
    flex: 1,
    alignItems: 'center',
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
});