// utils/cache.ts
interface CacheItem {
  data: any;
  timestamp: number;
}

const scanCache = new Map<string, CacheItem>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const getCachedResult = (url: string): any => {
  const cached = scanCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('📦 Using cached result for:', url);
    return cached.data;
  }
  return null;
};

export const setCachedResult = (url: string, data: any): void => {
  scanCache.set(url, {
    data,
    timestamp: Date.now()
  });
};