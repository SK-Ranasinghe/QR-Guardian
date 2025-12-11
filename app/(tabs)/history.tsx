import { ScanHistoryItem, clearHistory, getScanHistory } from '@/utils/historyService';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
      case 'SAFE': return '#34C759';
      case 'CAUTION': return '#FF9500';
      case 'DANGEROUS': return '#FF3B30';
      default: return '#8E8E93';
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

  const renderItem = ({ item }: { item: ScanHistoryItem }) => (
    <View style={styles.historyCard}>
      <View style={[styles.ratingBadge, { backgroundColor: getRatingColor(item.safetyRating) }]}>
        <Ionicons name={getRatingIcon(item.safetyRating)} size={16} color="#FFFFFF" />
        <Text style={styles.ratingText}>{item.safetyRating}</Text>
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
    </View>
  );

  const handleClearHistory = async () => {
    await clearHistory();
    loadHistory();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Scan History</Text>
          <Text style={styles.subtitle}>Review all QR safety checks you&apos;ve done</Text>
        </View>
        {history.length > 0 && (
          <TouchableOpacity onPress={handleClearHistory} style={styles.clearButton}>
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

      <View style={styles.statsBar}>
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1E',
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
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#8E8E93',
    fontSize: 14,
    marginTop: 2,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  clearText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
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
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  historyCard: {
    backgroundColor: '#2C2C2E',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 8,
  },
  ratingText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  urlText: {
    color: '#FFFFFF',
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
    color: '#8E8E93',
    fontSize: 12,
  },
  timeText: {
    color: '#8E8E93',
    fontSize: 12,
  },
  issuesText: {
    color: '#FF9500',
    fontSize: 12,
    fontStyle: 'italic',
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#2C2C2E',
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 14,
    paddingVertical: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    color: '#8E8E93',
    fontSize: 12,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#3A3A3C',
  },
});