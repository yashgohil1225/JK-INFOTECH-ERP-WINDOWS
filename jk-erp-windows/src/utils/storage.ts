// =============================================================
// JK INFOTECH ERP — AsyncStorage Cache Wrapper
// File : src/utils/storage.ts
// =============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

// In-memory cache for synchronous token retrieval
const cache: Record<string, string | null> = {};

export const storage = {
  /**
   * Preloads critical keys into memory. Must be called at app startup.
   */
  preload: async (keys: string[]): Promise<void> => {
    try {
      const pairs = await AsyncStorage.multiGet(keys);
      for (const [key, value] of pairs) {
        cache[key] = value;
      }
    } catch (e) {
      console.error("[Storage] Failed to preload keys:", e);
    }
  },

  getItemSync: (key: string): string | null => {
    return cache[key] || null;
  },

  setItem: async (key: string, value: string): Promise<void> => {
    cache[key] = value;
    try {
      await AsyncStorage.setItem(key, value);
    } catch (e) {
      console.error("[Storage] Failed to save key:", key, e);
    }
  },

  getItem: async (key: string): Promise<string | null> => {
    try {
      const val = await AsyncStorage.getItem(key);
      cache[key] = val;
      return val;
    } catch (e) {
      return cache[key] || null;
    }
  },

  removeItem: async (key: string): Promise<void> => {
    cache[key] = null;
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.error("[Storage] Failed to remove key:", key, e);
    }
  },

  clear: async (): Promise<void> => {
    Object.keys(cache).forEach((k) => {
      cache[k] = null;
    });
    try {
      await AsyncStorage.clear();
    } catch (e) {
      console.error("[Storage] Failed to clear storage:", e);
    }
  }
};
