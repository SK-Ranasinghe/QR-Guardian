// utils/historyService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ScanHistoryItem {
  id: string;
  url: string;
  safetyRating: 'SAFE' | 'CAUTION' | 'DANGEROUS';
  score: number;
  timestamp: Date;
  issues: string[];
}

const HISTORY_KEY = '@qrguardian_history';

export const saveScanToHistory = async (item: Omit<ScanHistoryItem, 'id' | 'timestamp'>) => {
  try {
    const history = await getScanHistory();
    const newItem: ScanHistoryItem = {
      ...item,
      id: Date.now().toString(),
      timestamp: new Date(),
    };
    
    const newHistory = [newItem, ...history].slice(0, 50); // Keep last 50 scans
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
    return newItem;
  } catch (error) {
    console.error('Error saving to history:', error);
  }
};

export const getScanHistory = async (): Promise<ScanHistoryItem[]> => {
  try {
    const history = await AsyncStorage.getItem(HISTORY_KEY);
    return history ? JSON.parse(history) : [];
  } catch (error) {
    console.error('Error reading history:', error);
    return [];
  }
};

export const clearHistory = async () => {
  try {
    await AsyncStorage.removeItem(HISTORY_KEY);
  } catch (error) {
    console.error('Error clearing history:', error);
  }
};