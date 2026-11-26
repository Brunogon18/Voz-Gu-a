import * as SQLite from 'expo-sqlite';
import { TRAMITES_CATALOG } from '../data/tramitesCatalog';
import { SearchResult, TramiteCategory, TramiteRecord } from '../types/vozGuia';
import {
  buildNormalizedVector,
  buildTramiteSearchText,
  createVectorIndex,
  IndexedTramite,
  searchVectorIndex,
} from './vectorSearch';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let cachedIndex: IndexedTramite[] | null = null;
let sqliteVecLoaded = false;

export async function initDatabase(): Promise<void> {
  if (cachedIndex && dbInstance) return;

  try {
    const db = await SQLite.openDatabaseAsync('voz_guia.db');
    dbInstance = db;

    const bundled = (SQLite as unknown as {
      bundledExtensions?: Record<string, { libPath: string; entryPoint?: string }>;
    }).bundledExtensions;
    const vecExt = bundled?.['sqlite-vec'];
    if (vecExt && !sqliteVecLoaded) {
      try {
        await db.loadExtensionAsync(vecExt.libPath, vecExt.entryPoint);
        sqliteVecLoaded = true;
      } catch {
        // Fallback to TypeScript sparse vector cosine search when native extension is unavailable
      }
    }

    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS tramites (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        institution TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        vector_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS mesh_cache (
        packet_id TEXT PRIMARY KEY NOT NULL,
        query TEXT NOT NULL,
        response_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);

    const upsertStmt = await db.prepareAsync(`
      INSERT OR REPLACE INTO tramites (id, title, category, institution, payload_json, vector_json, updated_at)
      VALUES ($id, $title, $category, $institution, $payloadJson, $vectorJson, $updatedAt);
    `);

    try {
      for (const tramite of TRAMITES_CATALOG) {
        const vector = buildNormalizedVector(buildTramiteSearchText(tramite));
        await upsertStmt.executeAsync({
          $id: tramite.id,
          $title: tramite.title,
          $category: tramite.category,
          $institution: tramite.institution,
          $payloadJson: JSON.stringify(tramite),
          $vectorJson: JSON.stringify(vector),
          $updatedAt: tramite.updatedAt,
        });
      }
    } finally {
      await upsertStmt.finalizeAsync();
    }

    const rows = await db.getAllAsync<{ payload_json: string; vector_json: string }>(
      'SELECT payload_json, vector_json FROM tramites;'
    );

    cachedIndex = rows.map((row) => ({
      tramite: JSON.parse(row.payload_json) as TramiteRecord,
      vector: JSON.parse(row.vector_json) as Record<string, number>,
    }));
  } catch {
    // Graceful in-memory fallback (e.g. Web or tests)
    cachedIndex = createVectorIndex(TRAMITES_CATALOG);
  }
}

export function isSqliteVecActive(): boolean {
  return sqliteVecLoaded;
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
  if (!dbInstance) return;
  try {
    await dbInstance.runAsync(
      'INSERT OR REPLACE INTO mesh_cache (packet_id, query, response_json, created_at) VALUES (?, ?, ?, ?)',
      packetId,
      query,
      responseJson,
      Date.now()
    );
  } catch {
    // Ignore cache persistence errors
  }
}
