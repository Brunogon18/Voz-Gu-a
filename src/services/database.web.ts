import { TRAMITES_CATALOG } from '../data/tramitesCatalog';
import { SearchResult, TramiteCategory, TramiteRecord } from '../types/vozGuia';
import {
  buildNormalizedVector,
  buildTramiteSearchText,
  createVectorIndex,
  IndexedTramite,
  searchVectorIndex,
} from './vectorSearch';

let cachedIndex: IndexedTramite[] | null = null;
const MESH_CACHE_STORAGE_KEY = 'vozguia:mesh_cache';
const CUSTOM_TRAMITES_STORAGE_KEY = 'vozguia:custom_tramites';

function loadStoredCustomTramites(): TramiteRecord[] {
  try {
    if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) return [];
    const raw = globalThis.localStorage.getItem(CUSTOM_TRAMITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TramiteRecord[]) : [];
  } catch {
    return [];
  }
}

function persistCustomTramites(list: TramiteRecord[]): void {
  try {
    if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) return;
    globalThis.localStorage.setItem(CUSTOM_TRAMITES_STORAGE_KEY, JSON.stringify(list.slice(0, 30)));
  } catch {
    // Ignore storage quota or private-mode errors on web
  }
}

export async function initDatabase(): Promise<void> {
  if (!cachedIndex) {
    const custom = loadStoredCustomTramites();
    const mergedMap = new Map<string, TramiteRecord>();
    for (const item of TRAMITES_CATALOG) {
      mergedMap.set(item.id, item);
    }
    for (const item of custom) {
      mergedMap.set(item.id, item);
    }
    cachedIndex = createVectorIndex(Array.from(mergedMap.values()));
  }
}

export function isSqliteVecActive(): boolean {
  return false;
}

export async function getAllTramites(): Promise<TramiteRecord[]> {
  await initDatabase();
  return (cachedIndex ?? createVectorIndex(TRAMITES_CATALOG)).map((item) => item.tramite);
}

export async function getTramiteById(id: string): Promise<TramiteRecord | null> {
  await initDatabase();
  const list = cachedIndex ?? createVectorIndex(TRAMITES_CATALOG);
  return list.find((item) => item.tramite.id === id)?.tramite ?? null;
}

export async function searchTramitesLocal(
  query: string,
  options?: { category?: TramiteCategory; limit?: number }
): Promise<SearchResult[]> {
  await initDatabase();
  const index = cachedIndex ?? createVectorIndex(TRAMITES_CATALOG);
  return searchVectorIndex(index, query, {
    category: options?.category,
    limit: options?.limit ?? 5,
  });
}

export async function saveCustomTramite(tramite: TramiteRecord): Promise<void> {
  await initDatabase();
  const vector = buildNormalizedVector(buildTramiteSearchText(tramite));
  const current = cachedIndex ?? createVectorIndex(TRAMITES_CATALOG);
  const filtered = current.filter((item) => item.tramite.id !== tramite.id);
  cachedIndex = [{ tramite, vector }, ...filtered];

  const custom = loadStoredCustomTramites().filter((item) => item.id !== tramite.id);
  persistCustomTramites([tramite, ...custom]);
}

export async function saveMeshCachedResponse(
  packetId: string,
  query: string,
  responseJson: string
): Promise<void> {
  try {
    if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) return;
    const raw = globalThis.localStorage.getItem(MESH_CACHE_STORAGE_KEY);
    const cache = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    cache[packetId] = { query, responseJson, createdAt: Date.now() };
    globalThis.localStorage.setItem(MESH_CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage quota or private-mode errors on web
  }
}
