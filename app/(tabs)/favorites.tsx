import { clearFavorites, FavoriteItem, getFavorites, removeFromFavorites } from '@/utils/favoritesService';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function FavoritesScreen() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

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
    Alert.alert(
      'Remove from Trusted Sites',
      `Are you sure you want to remove ${domain} from trusted sites?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: async () => {
            await removeFromFavorites(domain);
            loadFavorites();
          }
        },
      ]
    );
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
    
    Alert.alert(
      'Clear All Trusted Sites',
      'Are you sure you want to remove all trusted sites?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear All', 
          style: 'destructive',
          onPress: async () => {
            await clearFavorites();
            loadFavorites();
          }
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Trusted Sites</Text>
          <Text style={styles.subtitle}>Sites you've marked as safe</Text>
        </View>
        {favorites.length > 0 && (
          <TouchableOpacity onPress={handleClearAll} style={styles.clearButton}>
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
            When you scan a safe QR code, tap "Trust This Site" to add it here
          </Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          refreshing={refreshing}
          onRefresh={loadFavorites}
          contentContainerStyle={styles.listContent}
        />
      )}

      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={24} color="#007AFF" />
        <View style={styles.infoContent}>
          <Text style={styles.infoTitle}>How Trusted Sites Work</Text>
          <Text style={styles.infoText}>
            Trusted sites won't show security warnings when scanned. 
            The app remembers domains you've marked as safe.
          </Text>
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
  favoriteCard: {
    backgroundColor: '#2C2C2E',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  favoriteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  domainContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  domainText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  removeButton: {
    padding: 4,
  },
  urlText: {
    color: '#8E8E93',
    fontSize: 12,
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  favoriteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    color: '#8E8E93',
    fontSize: 12,
  },
  ratingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  ratingText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#2C2C2E',
    marginHorizontal: 16,
    marginBottom: 20,
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
    fontSize: 14,
    lineHeight: 18,
  },
});