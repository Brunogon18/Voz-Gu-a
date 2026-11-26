import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MeshStats } from '../types/vozGuia';

interface MeshStatusBannerProps {
  stats: MeshStats;
  hasGeminiKey: boolean;
}

export function MeshStatusBanner({ stats, hasGeminiKey }: MeshStatusBannerProps) {
  return (
    <View style={styles.container} accessible accessibilityLabel="Estado de conexión y red mesh">
      <View style={styles.row}>
        <View
          style={[
            styles.dot,
            stats.isRunning && stats.foregroundActive ? styles.dotActive : styles.dotPaused,
          ]}
        />
        <Text style={styles.title}>
          {stats.isRunning && stats.foregroundActive
            ? `Red Mesh BLE activa • ${stats.connectedPeers} vecinos`
            : 'Red Mesh en pausa'}
        </Text>
      </View>
      <Text style={styles.subtitle}>
        Nodo {stats.nodeId} • Modo {hasGeminiKey ? 'Gemini AI + Offline' : '100% Offline (SQLite Vectorial)'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#E8F4F1',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#B8DDD4',
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 11,
    height: 11,
    borderRadius: 6,
  },
  dotActive: {
    backgroundColor: '#138A5B',
  },
  dotPaused: {
    backgroundColor: '#B45309',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0A3B30',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#2B5349',
  },
});
