import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { AccessibleButton } from '../../components/AccessibleButton';
import {
  getNativeMeshCapabilities,
  requestAndroidRuntimePermissions,
} from '../../native/androidBridge';
import { kvStore } from '../../services/kvStore';
import { meshService } from '../../services/meshService';
import { AppSettings, MeshPeer, MeshStats } from '../../types/vozGuia';

export default function MeshAndSettingsScreen() {
  const [settings, setSettings] = useState<AppSettings>(() => kvStore.getSettings());
  const [stats, setStats] = useState<MeshStats>(() => meshService.getStats());
  const [peers, setPeers] = useState<MeshPeer[]>(() => meshService.getPeers());
  const [logs, setLogs] = useState<string[]>(() => meshService.getEventLog());
  const [capabilitiesNote, setCapabilitiesNote] = useState('');
  const [apiKeyDraft, setApiKeyDraft] = useState(settings.geminiApiKey);
  const [testQuery, setTestQuery] = useState('beca preparatoria');
  const [savedFeedback, setSavedFeedback] = useState('');

  const refreshState = useCallback(() => {
    setStats(meshService.getStats());
    setPeers(meshService.getPeers());
    setLogs(meshService.getEventLog());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshState();
    }, [refreshState])
  );

  useEffect(() => {
    void (async () => {
      const caps = await getNativeMeshCapabilities();
      setCapabilitiesNote(
        `Android SDK ${caps.androidSdkInt} • BLE físico: ${
          caps.hasBleHardware ? 'Sí' : 'No (Simulador)'
        } • Nearby: ${caps.hasNearbyConnections ? 'Disponible' : 'Modo BLE/Simulación'}`
      );
    })();
  }, []);

  const toggleMesh = async (enabled: boolean) => {
    const updated = kvStore.saveSettings({ meshEnabled: enabled });
    setSettings(updated);
    if (enabled) {
      await requestAndroidRuntimePermissions();
      await meshService.start();
    } else {
      await meshService.stop();
    }
    refreshState();
  };

  const handleSimulateMeshHop = async () => {
    await meshService.queryAcrossMesh(testQuery || 'cita médica');
    refreshState();
  };

  const handleSaveSettings = () => {
    const updated = kvStore.saveSettings({
      geminiApiKey: apiKeyDraft.trim(),
    });
    setSettings(updated);
    setSavedFeedback(
      updated.geminiApiKey
        ? 'API Key de Google AI Studio guardada en almacenamiento local.'
        : 'Sin API Key: la app funcionará 100% en modo offline local.'
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Red Mesh BLE (Primer Plano)</Text>
        <Text style={styles.note}>
          Protocolo de flooding controlado (TTL={settings.maxHops} saltos). Android/iOS restringen el
          escaneo BLE en segundo plano, por lo que los saltos operan mientras la app está abierta.
        </Text>
        {capabilitiesNote ? <Text style={styles.capText}>{capabilitiesNote}</Text> : null}

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Activar descubrimiento y relevo Mesh</Text>
          <Switch value={settings.meshEnabled} onValueChange={(v) => void toggleMesh(v)} />
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.connectedPeers}</Text>
            <Text style={styles.statLabel}>Vecinos</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.packetsSent}</Text>
            <Text style={styles.statLabel}>Enviados</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.packetsRelayed}</Text>
            <Text style={styles.statLabel}>Reenviados</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.packetsDroppedDuplicate}</Text>
            <Text style={styles.statLabel}>Duplicados</Text>
          </View>
        </View>

        <Text style={styles.subTitle}>Probar salto de dispositivos (Flooding Controlado):</Text>
        <TextInput
          value={testQuery}
          onChangeText={setTestQuery}
          placeholder="Consulta para enviar por mesh..."
          style={styles.input}
        />
        <AccessibleButton label="Simular consulta multi-salto" onPress={() => void handleSimulateMeshHop()} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Dispositivos cercanos ({peers.length})</Text>
        {peers.map((peer) => (
          <View key={peer.peerId} style={styles.peerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.peerName}>{peer.displayName}</Text>
              <Text style={styles.peerMeta}>
                ID: {peer.peerId} • Señal {peer.rssi} dBm • {peer.hopDistance} salto(s)
              </Text>
            </View>
            <Text style={[styles.peerBadge, peer.hasInternet ? styles.netYes : styles.netNo]}>
              {peer.hasInternet ? 'Con internet' : 'Offline'}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Accesibilidad e Inteligencia Artificial</Text>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Texto grande para lectura fácil</Text>
          <Switch
            value={settings.largeTextMode}
            onValueChange={(v) => setSettings(kvStore.saveSettings({ largeTextMode: v }))}
          />
        </View>

        <View style={styles.rateRow}>
          <Text style={styles.switchLabel}>
            Velocidad de voz: {settings.speechRate.toFixed(2)}x
          </Text>
          <View style={styles.rateButtons}>
            <AccessibleButton
              label="Más lenta"
              variant="outline"
              onPress={() =>
                setSettings(
                  kvStore.saveSettings({
                    speechRate: Math.max(0.7, Number((settings.speechRate - 0.1).toFixed(2))),
                  })
                )
              }
              style={styles.smallBtn}
            />
            <AccessibleButton
              label="Normal"
              variant="outline"
              onPress={() => setSettings(kvStore.saveSettings({ speechRate: 0.92 }))}
              style={styles.smallBtn}
            />
          </View>
        </View>

        <Text style={styles.subTitle}>API Key de Google AI Studio (opcional):</Text>
        <TextInput
          value={apiKeyDraft}
          onChangeText={setApiKeyDraft}
          placeholder="Pega tu Gemini API Key (opcional)"
          secureTextEntry
          autoCapitalize="none"
          style={styles.input}
        />
        <AccessibleButton label="Guardar configuración" variant="secondary" onPress={handleSaveSettings} />
        {savedFeedback ? <Text style={styles.feedback}>{savedFeedback}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Registro de paquetes Mesh</Text>
        {logs.length === 0 ? (
          <Text style={styles.note}>Aún no hay eventos registrados.</Text>
        ) : (
          logs.map((entry, idx) => (
            <Text key={`${entry}-${idx}`} style={styles.logLine}>
              {entry}
            </Text>
          ))
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
    paddingBottom: 36,
    gap: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D6E2DF',
    gap: 10,
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#102A24',
  },
  subTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E4037',
    marginTop: 4,
  },
  note: {
    fontSize: 14,
    lineHeight: 20,
    color: '#3A5850',
  },
  capText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#134E8E',
    backgroundColor: '#EAF2FA',
    padding: 10,
    borderRadius: 10,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 4,
  },
  switchLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#102A24',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F2F8F6',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0B5D4B',
  },
  statLabel: {
    fontSize: 12,
    color: '#3A5850',
    fontWeight: '600',
  },
  input: {
    minHeight: 50,
    borderWidth: 1.5,
    borderColor: '#B8DDD4',
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#102A24',
    backgroundColor: '#F9FCFB',
  },
  peerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ECF2F0',
  },
  peerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#102A24',
  },
  peerMeta: {
    fontSize: 13,
    color: '#46655D',
  },
  peerBadge: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  netYes: {
    backgroundColor: '#DCFCE7',
    color: '#166534',
  },
  netNo: {
    backgroundColor: '#FEF3C7',
    color: '#92400E',
  },
  rateRow: {
    gap: 8,
  },
  rateButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  smallBtn: {
    flex: 1,
    minHeight: 46,
  },
  feedback: {
    fontSize: 14,
    color: '#0B5D4B',
    fontWeight: '700',
  },
  logLine: {
    fontSize: 12,
    color: '#2B4740',
    fontFamily: 'monospace',
    backgroundColor: '#F6FAF9',
    padding: 6,
    borderRadius: 6,
  },
});
