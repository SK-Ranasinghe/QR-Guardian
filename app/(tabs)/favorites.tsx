import { GlassCard } from '@/components/ui/premium-ui';
import { clearFavorites, FavoriteItem, getFavorites, removeFromFavorites } from '@/utils/favoritesService';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function FavoritesScreen() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isCompactLayout = width < 390;
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    accentColor: string;
    action: 'remove' | 'clear';
    domain?: string;
  } | null>(null);
  const [feedbackModal, setFeedbackModal] = useState<{
    title: string;
    message: string;
    icon: 'star-outline' | 'trash-outline';
    accentColor: string;
  } | null>(null);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    setRefreshing(true);
    const data = await getFavorites();
    setFavorites(data);
    setRefreshing(false);
  };

  const handleRemoveFavorite = async (domain: string) => {
    setConfirmModal({
      title: 'Remove from Trusted Sites',
      message: `Are you sure you want to remove ${domain} from trusted sites?`,
      confirmLabel: 'Remove',
      accentColor: '#F87171',
      action: 'remove',
      domain,
    });
  };

  const handleCloseConfirmModal = () => {
    setConfirmModal(null);
  };

  const handleCloseFeedbackModal = () => {
    setFeedbackModal(null);
  };

  const handleConfirmAction = async () => {
    if (!confirmModal) return;

    if (confirmModal.action === 'remove' && confirmModal.domain) {
      await removeFromFavorites(confirmModal.domain);
      await loadFavorites();
      setFeedbackModal({
        title: 'Trusted Site Removed',
        message: `${confirmModal.domain} was removed from your trusted list.`,
        icon: 'star-outline',
        accentColor: '#94A3B8',
      });
    }

    if (confirmModal.action === 'clear') {
      await clearFavorites();
      await loadFavorites();
      setFeedbackModal({
        title: 'Trusted Sites Cleared',
        message: 'All trusted sites were removed successfully.',
        icon: 'trash-outline',
        accentColor: '#F87171',
      });
    }

    setConfirmModal(null);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderItem = ({ item }: { item: FavoriteItem }) => (
    <View style={styles.favoriteCard}>
      <View style={styles.favoriteHeader}>
        <View style={styles.domainContainer}>
          <Ionicons name="shield-checkmark" size={20} color="#34C759" />
          <Text style={styles.domainText} numberOfLines={1}>{item.domain}</Text>
        </View>
        <TouchableOpacity 
          onPress={() => handleRemoveFavorite(item.domain)}
          style={styles.removeButton}
        >
          <Ionicons name="close-circle" size={22} color="#FF3B30" />
        </TouchableOpacity>
      </View>
      
      <Text style={styles.urlText} numberOfLines={1}>{item.url}</Text>
      
      <View style={styles.favoriteFooter}>
        <Text style={styles.dateText}>Added: {formatDate(item.addedAt)}</Text>
        {item.safetyRating && (
          <View style={[styles.ratingBadge, 
            { backgroundColor: item.safetyRating === 'SAFE' ? '#34C759' : 
                            item.safetyRating === 'CAUTION' ? '#FF9500' : '#FF3B30' }]}>
            <Text style={styles.ratingText}>{item.safetyRating}</Text>
          </View>
        )}
      </View>
    </View>
  );

  const handleClearAll = async () => {
    if (favorites.length === 0) return;

    setConfirmModal({
      title: 'Clear All Trusted Sites',
      message: 'Are you sure you want to remove all trusted sites?',
      confirmLabel: 'Clear All',
      accentColor: '#F87171',
      action: 'clear',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#000000', '#020617', '#000000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={[styles.header, isCompactLayout && styles.headerCompact, { marginTop: Math.max(insets.top + 8, 18) }]}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>Trusted Sites</Text>
          <Text style={styles.subtitle}>Sites you&apos;ve marked as safe</Text>
        </View>
        {favorites.length > 0 && (
          <TouchableOpacity onPress={handleClearAll} style={[styles.clearButton, isCompactLayout && styles.clearButtonCompact]}>
            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            <Text style={styles.clearText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {favorites.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="star-outline" size={80} color="#8E8E93" />
          <Text style={styles.emptyTitle}>No Trusted Sites Yet</Text>
          <Text style={styles.emptyText}>
            When you scan a safe QR code, tap &quot;Trust This Site&quot; to add it here
          </Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          refreshing={refreshing}
          onRefresh={loadFavorites}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      )}

      <View style={[styles.infoCard, isCompactLayout && styles.infoCardCompact]}>
        <Ionicons name="information-circle" size={24} color="#007AFF" />
        <View style={[styles.infoContent, isCompactLayout && styles.infoContentCompact]}>
          <Text style={styles.infoTitle}>How Trusted Sites Work</Text>
          <Text style={styles.infoText}>
            Trusted sites won&apos;t show security warnings when scanned.
            {' '}
            The app remembers domains you&apos;ve marked as safe.
          </Text>
        </View>
      </View>

      {confirmModal && (
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.modalCardShell} glowColor={`${confirmModal.accentColor}88`} contentStyle={styles.modalCard}>
            <View style={[styles.modalIconWrapper, { backgroundColor: `${confirmModal.accentColor}22` }]}>
              <Ionicons name="warning" size={24} color={confirmModal.accentColor} />
            </View>
            <Text style={styles.modalTitle}>{confirmModal.title}</Text>
            <Text style={styles.modalMessage}>{confirmModal.message}</Text>
            <View style={[styles.modalButtonsRow, isCompactLayout && styles.modalButtonsRowCompact]}>
              <TouchableOpacity style={[styles.modalCancelButton, isCompactLayout && styles.modalButtonCompact]} onPress={handleCloseConfirmModal} activeOpacity={0.9}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirmButton, isCompactLayout && styles.modalButtonCompact, { backgroundColor: confirmModal.accentColor }]} onPress={handleConfirmAction} activeOpacity={0.9}>
                <Text style={styles.modalConfirmText}>{confirmModal.confirmLabel}</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        </View>
      )}

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
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginHorizontal: 18,
    marginTop: 18,
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
  headerCompact: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  headerTextWrap: {
    flexShrink: 1,
    paddingRight: 12,
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
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(127,29,29,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.18)',
  },
  clearButtonCompact: {
    marginTop: 12,
  },
  clearText: {
    color: '#F87171',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    marginHorizontal: 18,
    marginTop: 40,
    paddingVertical: 44,
    borderRadius: 24,
    backgroundColor: 'rgba(9,12,28,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.12)',
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 20,
  },
  favoriteCard: {
    backgroundColor: 'rgba(9,12,28,0.9)',
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,255,65,0.12)',
    shadowColor: '#00FF41',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  favoriteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  domainContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  domainText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
    flex: 1,
  },
  removeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(127,29,29,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.18)',
  },
  urlText: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 10,
    fontFamily: 'monospace',
  },
  favoriteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  dateText: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 6,
  },
  ratingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  ratingText: {
    color: '#03120B',
    fontSize: 10,
    fontWeight: '800',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(9,12,28,0.92)',
    marginHorizontal: 18,
    marginBottom: 20,
    padding: 16,
    borderRadius: 24,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.12)',
  },
  infoCardCompact: {
    flexDirection: 'column',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoContentCompact: {
    marginLeft: 0,
    marginTop: 10,
  },
  infoTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  infoText: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
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
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalButtonsRowCompact: {
    flexDirection: 'column-reverse',
    alignItems: 'stretch',
  },
  modalCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#334155',
    marginRight: 8,
  },
  modalButtonCompact: {
    marginRight: 0,
    marginTop: 8,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  modalConfirmButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: {
    color: '#03120B',
    fontSize: 13,
    fontWeight: '800',
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