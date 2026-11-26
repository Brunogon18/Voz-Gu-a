import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AccessibleButton } from '../../components/AccessibleButton';
import { isSqliteVecActive, searchTramitesLocal } from '../../services/database';
import { speakSpanish } from '../../services/voiceService';
import { SearchResult, TramiteCategory } from '../../types/vozGuia';

const CATEGORIES: { key: 'all' | TramiteCategory; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'salud', label: 'Salud' },
  { key: 'becas', label: 'Becas' },
  { key: 'educacion', label: 'Educación' },
];

export default function TramitesCatalogScreen() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | TramiteCategory>('all');
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const found = await searchTramitesLocal(query, {
        category: category === 'all' ? undefined : category,
        limit: 12,
      });
      if (mounted) {
        setResults(found);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [query, category]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.infoBanner}>
        <Text style={styles.infoTitle}>Buscador Semántico Offline</Text>
        <Text style={styles.infoText}>
          Motor local SQLite{isSqliteVecActive() ? ' + sqlite-vec' : ' + vectores TF-IDF'} listo
          para consultas sin internet.
        </Text>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar trámite (ej. doctor, beca, certificado)..."
        placeholderTextColor="#6E827C"
        style={styles.searchInput}
      />

      <View style={styles.filterRow}>
        {CATEGORIES.map((cat) => {
          const active = category === cat.key;
          return (
            <Pressable
              key={cat.key}
              onPress={() => setCategory(cat.key)}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {cat.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.list}>
        {results.map(({ tramite, score }) => (
          <View key={tramite.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.categoryTag}>{tramite.category.toUpperCase()}</Text>
              {query.trim() ? (
                <Text style={styles.scoreText}>Similitud: {Math.round(score * 100)}%</Text>
              ) : null}
            </View>
            <Text style={styles.cardTitle}>{tramite.title}</Text>
            <Text style={styles.institution}>{tramite.institution}</Text>
            <Text style={styles.summary}>{tramite.simpleSummary}</Text>

            <View style={styles.actions}>
              <AccessibleButton
                label="Abrir guía paso a paso"
                onPress={() =>
                  router.push({ pathname: '/(tabs)', params: { tramiteId: tramite.id } })
                }
                style={styles.flexBtn}
              />
              <AccessibleButton
                label="Escuchar"
                variant="outline"
                onPress={() =>
                  void speakSpanish(`${tramite.title}. ${tramite.simpleSummary}`)
                }
                style={styles.listenBtn}
              />
            </View>
          </View>
        ))}

        {results.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              No hay trámites coincidentes con &quot;{query}&quot; en esta categoría.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F3F8F6',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  infoBanner: {
    backgroundColor: '#E8F4F1',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#B8DDD4',
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0B5D4B',
  },
  infoText: {
    fontSize: 13,
    color: '#2A4F46',
    marginTop: 2,
  },
  searchInput: {
    minHeight: 54,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#B8DDD4',
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#102A24',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C5DBD5',
  },
  filterChipActive: {
    backgroundColor: '#0B5D4B',
    borderColor: '#0B5D4B',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E4037',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  list: {
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D6E2DF',
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryTag: {
    backgroundColor: '#E5F2EE',
    color: '#0B5D4B',
    fontWeight: '800',
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#134E8E',
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#102A24',
  },
  institution: {
    fontSize: 14,
    fontWeight: '600',
    color: '#46655D',
  },
  summary: {
    fontSize: 15,
    lineHeight: 22,
    color: '#223A34',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  flexBtn: {
    flex: 1,
  },
  listenBtn: {
    minWidth: 112,
  },
  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#34524A',
    textAlign: 'center',
  },
});
