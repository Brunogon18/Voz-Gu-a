import { SearchResult, TramiteCategory, TramiteRecord } from '../types/vozGuia';

const SPANISH_STOPWORDS = new Set([
  'el',
  'la',
  'los',
  'las',
  'un',
  'una',
  'unos',
  'unas',
  'de',
  'del',
  'al',
  'a',
  'en',
  'y',
  'o',
  'que',
  'como',
  'para',
  'por',
  'con',
  'sin',
  'sobre',
  'mi',
  'tu',
  'su',
  'me',
  'te',
  'se',
  'es',
  'son',
  'quiero',
  'necesito',
  'saber',
  'puedo',
  'hacer',
  'tramitar',
  'pedir',
  'informacion',
  'ayuda',
]);

export type SparseVector = Record<string, number>;

export function normalizeSpanishText(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeSpanish(input: string): string[] {
  const normalized = normalizeSpanishText(input);
  if (!normalized) return [];
  const words = normalized.split(' ').filter((w) => w.length >= 2 && !SPANISH_STOPWORDS.has(w));
  const features: string[] = [];

  for (const word of words) {
    features.push(`w:${word}`);
    // Character 3-grams give resilience against typos and speech-to-text variations
    if (word.length >= 4) {
      for (let i = 0; i <= word.length - 3; i += 1) {
        features.push(`g:${word.slice(i, i + 3)}`);
      }
    }
  }
  return features;
}

export function buildTramiteSearchText(tramite: TramiteRecord): string {
  return [
    tramite.title,
    tramite.title,
    tramite.category,
    tramite.institution,
    tramite.summary,
    tramite.simpleSummary,
    ...tramite.keywords,
    ...tramite.keywords,
    ...tramite.requirements,
    ...tramite.steps.map((s) => `${s.title} ${s.simpleExplanation}`),
  ].join(' ');
}

export function buildNormalizedVector(text: string): SparseVector {
  const tokens = tokenizeSpanish(text);
  const counts: SparseVector = {};
  for (const token of tokens) {
    const weight = token.startsWith('w:') ? 2.0 : 0.65;
    counts[token] = (counts[token] ?? 0) + weight;
  }

  let normSquared = 0;
  for (const val of Object.values(counts)) {
    normSquared += val * val;
  }
  const norm = Math.sqrt(normSquared);
  if (norm === 0) return {};

  const normalized: SparseVector = {};
  for (const [key, val] of Object.entries(counts)) {
    normalized[key] = Number((val / norm).toFixed(6));
  }
  return normalized;
}

export function cosineSimilarity(a: SparseVector, b: SparseVector): number {
  let dot = 0;
  for (const [key, valA] of Object.entries(a)) {
    const valB = b[key];
    if (valB !== undefined) {
      dot += valA * valB;
    }
  }
  return Number(dot.toFixed(6));
}

export interface IndexedTramite {
  tramite: TramiteRecord;
  vector: SparseVector;
}

export function createVectorIndex(tramites: TramiteRecord[]): IndexedTramite[] {
  return tramites.map((tramite) => ({
    tramite,
    vector: buildNormalizedVector(buildTramiteSearchText(tramite)),
  }));
}

export function searchVectorIndex(
  index: IndexedTramite[],
  query: string,
  options?: { category?: TramiteCategory; limit?: number; minScore?: number }
): SearchResult[] {
  const limit = options?.limit ?? 5;
  const minScore = options?.minScore ?? 0.05;
  const filtered = options?.category
    ? index.filter((item) => item.tramite.category === options.category)
    : index;

  if (!query.trim()) {
    return filtered.slice(0, limit).map((item) => ({
      tramite: item.tramite,
      score: 1,
      matchedTerms: [],
      source: 'local-sqlite',
    }));
  }

  const queryVec = buildNormalizedVector(query);
  const queryWords = tokenizeSpanish(query).filter((t) => t.startsWith('w:'));

  const results: SearchResult[] = [];
  for (const item of filtered) {
    const score = cosineSimilarity(queryVec, item.vector);
    if (score >= minScore) {
      const matchedTerms = queryWords
        .filter((w) => item.vector[w] !== undefined)
        .map((w) => w.slice(2));
      results.push({
        tramite: item.tramite,
        score,
        matchedTerms,
        source: 'local-sqlite',
      });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
