import { TRAMITES_CATALOG } from '../data/tramitesCatalog';
import { SearchResult, TramiteCategory, TramiteRecord } from '../types/vozGuia';
import { createVectorIndex, IndexedTramite, searchVectorIndex } from './vectorSearch';

let cachedIndex: IndexedTramite[] | null = null;
const MESH_CACHE_STORAGE_KEY = 'vozguia:mesh_cache';

export async function initDatabase(): Promise<void> {
  if (!cachedIndex) {
    cachedIndex = createVectorIndex(TRAMITES_CATALOG);
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
