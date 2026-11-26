import Storage from 'expo-sqlite/kv-store';
import { AppSettings } from '../types/vozGuia';
import { DEFAULT_GEMINI_MODEL, resolveGeminiModel } from './geminiService';

const DEFAULT_SETTINGS: AppSettings = {
  geminiApiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '',
  geminiModel: DEFAULT_GEMINI_MODEL,
  speechRate: 0.92,
  largeTextMode: true,
  meshEnabled: true,
  maxHops: 4,
};

const SETTINGS_KEY = 'vozguia:settings';
const NODE_ID_KEY = 'vozguia:node_id';
const RECENT_QUERIES_KEY = 'vozguia:recent_queries';

const memoryCache = new Map<string, string>();

function getSyncRaw(key: string): string | null {
  if (memoryCache.has(key)) {
    return memoryCache.get(key) ?? null;
  }
  try {
    if (Storage && typeof Storage.getItemSync === 'function') {
      const val = Storage.getItemSync(key);
      if (val !== null) {
        memoryCache.set(key, val);
      }
      return val;
    }
  } catch {
    // fallback
  }
  return null;
}

function setSyncRaw(key: string, value: string): void {
  memoryCache.set(key, value);
  try {
    if (Storage && typeof Storage.setItemSync === 'function') {
      Storage.setItemSync(key, value);
    }
  } catch {
    // fallback
  }
}

export const kvStore = {
  getString(key: string): string | null {
    return getSyncRaw(key);
  },

  setString(key: string, value: string): void {
    setSyncRaw(key, value);
  },

  getOrCreateNodeId(): string {
    const existing = getSyncRaw(NODE_ID_KEY);
    if (existing) return existing;
    const generated = `VG-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    setSyncRaw(NODE_ID_KEY, generated);
    return generated;
  },

  getSettings(): AppSettings {
    const raw = getSyncRaw(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    try {
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        geminiApiKey: parsed.geminiApiKey ?? DEFAULT_SETTINGS.geminiApiKey,
        geminiModel: resolveGeminiModel(parsed.geminiModel),
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  },

  saveSettings(partial: Partial<AppSettings>): AppSettings {
    const merged: AppSettings = {
      ...this.getSettings(),
      ...partial,
      geminiModel: resolveGeminiModel(partial.geminiModel ?? this.getSettings().geminiModel),
    };
    setSyncRaw(SETTINGS_KEY, JSON.stringify(merged));
    return merged;
  },

  getRecentQueries(): string[] {
    const raw = getSyncRaw(RECENT_QUERIES_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(0, 8) : [];
    } catch {
      return [];
    }
  },

  pushRecentQuery(query: string): string[] {
    const clean = query.trim();
    if (!clean) return this.getRecentQueries();
    const current = this.getRecentQueries().filter(
      (q) => q.toLowerCase() !== clean.toLowerCase()
    );
    const next = [clean, ...current].slice(0, 8);
    setSyncRaw(RECENT_QUERIES_KEY, JSON.stringify(next));
    return next;
  },
};
