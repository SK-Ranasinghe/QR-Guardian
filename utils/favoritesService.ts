// utils/favoritesService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface FavoriteItem {
  id: string;
  domain: string;
  url: string;
  addedAt: Date;
  safetyRating?: 'SAFE' | 'CAUTION' | 'DANGEROUS';
}

const FAVORITES_KEY = '@qrguardian_favorites';

export const addToFavorites = async (url: string, safetyRating?: string) => {
  try {
    const favorites = await getFavorites();
    const domain = extractDomain(url);
    
    // Check if already in favorites
    if (favorites.some(fav => fav.domain === domain)) {
      return false; // Already favorited
    }
    
    const newFavorite: FavoriteItem = {
      id: Date.now().toString(),
      domain,
      url,
      addedAt: new Date(),
      safetyRating: safetyRating as any,
    };
    
    const newFavorites = [newFavorite, ...favorites];
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
    return true;
  } catch (error) {
    console.error('Error adding to favorites:', error);
    return false;
  }
};

export const removeFromFavorites = async (domain: string) => {
  try {
    const favorites = await getFavorites();
    const newFavorites = favorites.filter(fav => fav.domain !== domain);
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
    return true;
  } catch (error) {
    console.error('Error removing from favorites:', error);
    return false;
  }
};

export const getFavorites = async (): Promise<FavoriteItem[]> => {
  try {
    const favorites = await AsyncStorage.getItem(FAVORITES_KEY);
    return favorites ? JSON.parse(favorites) : [];
  } catch (error) {
    console.error('Error reading favorites:', error);
    return [];
  }
};

export const isDomainFavorited = async (url: string): Promise<boolean> => {
  try {
    const favorites = await getFavorites();
    const domain = extractDomain(url);
    return favorites.some(fav => fav.domain === domain);
  } catch (error) {
    console.error('Error checking favorite:', error);
    return false;
  }
};

export const clearFavorites = async () => {
  try {
    await AsyncStorage.removeItem(FAVORITES_KEY);
  } catch (error) {
    console.error('Error clearing favorites:', error);
  }
};


// Helper function to extract domain from URL
const extractDomain = (url: string): string => {
  try {
    // Clean the URL first
    let cleanUrl = url.toLowerCase().trim();
    
    // Add protocol if missing (for URL parsing)
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'http://' + cleanUrl;
    }
    
    const urlObj = new URL(cleanUrl);
    let domain = urlObj.hostname;
    
    // Remove www. prefix for consistency
    if (domain.startsWith('www.')) {
      domain = domain.substring(4);
    }
    
    return domain;
  } catch {
    // Fallback: try to extract domain manually
    const cleanUrl = url.toLowerCase().trim();
    const match = cleanUrl.match(/(?:https?:\/\/)?(?:www\.)?([^\/:\?]+)/);
    return match ? match[1] : cleanUrl;
  }
};