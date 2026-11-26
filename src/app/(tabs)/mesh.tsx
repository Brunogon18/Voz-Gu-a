import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AccessibleButton } from '../../components/AccessibleButton';
import { AppHeader } from '../../components/AppHeader';
import {
  getNativeMeshCapabilities,
  requestAndroidRuntimePermissions,
} from '../../native/androidBridge';
import {
  GEMINI_MODEL_OPTIONS,
  resolveGeminiModel,
  testGeminiConnection,
} from '../../services/geminiService';
import { kvStore } from '../../services/kvStore';
import { meshService } from '../../services/meshService';
import { Colors, Spacing, Typography } from '../../theme/tokens';
import { AppSettings, MeshPeer, MeshStats } from '../../types/vozGuia';

export default function MeshAndSettingsScreen() {
  const [settings, setSettings] = useState<AppSettings>(() => kvStore.getSettings());
  const [stats, setStats] = useState<MeshStats>(() => meshService.getStats());
  const [peers, setPeers] = useState<MeshPeer[]>(() => meshService.getPeers());
  const [logs, setLogs] = useState<string[]>(() => meshService.getEventLog());
  const [capabilitiesNote, setCapabilitiesNote] = useState('');
  const [apiKeyDraft, setApiKeyDraft] = useState(settings.geminiApiKey);
  const [relayUrlDraft, setRelayUrlDraft] = useState(settings.meshRelayUrl);
  const [selectedModel, setSelectedModel] = useState(() =>
    resolveGeminiModel(settings.geminiModel)
  );
  const [testQuery, setTestQuery] = useState('beca preparatoria');
  const [savedFeedback, setSavedFeedback] = useState('');
  const [meshFeedback, setMeshFeedback] = useState('');
  const [testingGemini, setTestingGemini] = useState(false);
  const [geminiTestResult, setGeminiTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

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
    const unsubscribe = meshService.subscribe(refreshState);
    void (async () => {
      const caps = await getNativeMeshCapabilities();
      setCapabilitiesNote(
        `Android SDK ${caps.androidSdkInt} • BLE GATT físico: ${
          caps.hasBleHardware ? 'Sí' : 'No (Expo Go / Web)'
        } • Transporte actual: ${meshService.getTransportMode()}`
      );
    })();
    return unsubscribe;
  }, [refreshState]);

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

  const handleSaveRelay = async () => {
    const cleanRelay = relayUrlDraft.trim().replace(/\/+$/, '');
    const updated = kvStore.saveSettings({ meshRelayUrl: cleanRelay });
    setSettings(updated);
    await meshService.start();
    refreshState();
    setMeshFeedback(
      cleanRelay
        ? `Conectando a Relay Mesh LAN en ${cleanRelay}...`
        : 'Relay LAN desactivado. Usando BLE GATT (en APK) o BroadcastChannel (en Web).'
    );
  };

  const handleRealMeshQuery = async () => {
    setMeshFeedback('Enviando consulta real a vecinos conectados...');
    const hits = await meshService.queryAcrossMesh(testQuery || 'cita médica');
    refreshState();
    setMeshFeedback(
      hits.length > 0
        ? `¡Respuesta real recibida por Red Mesh!: ${hits[0].tramite.title}`
        : 'Sin respuesta de vecinos reales en 3.5 s. Abre otro teléfono (APK BLE o Expo Go con mismo Relay LAN) o 2 pestañas Web.'
    );
  };

  const handleSimulateMeshHop = async () => {
    const hits = await meshService.simulateMultiHopDemo(testQuery || 'cita médica');
    refreshState();
    setMeshFeedback(
      hits.length > 0
        ? `[Simulación local] Salto de 2 nodos verificado: ${hits[0].tramite.title}`
        : '[Simulación local] No hubo coincidencia en catálogo local.'
    );
  };

  const handleSaveSettings = () => {
    const updated = kvStore.saveSettings({
      geminiApiKey: apiKeyDraft.trim(),
      geminiModel: selectedModel,
    });
    setSettings(updated);
    setGeminiTestResult(null);
    setSavedFeedback(
      updated.geminiApiKey
        ? `API Key guardada localmente. Modelo activo: ${updated.geminiModel}.`
        : 'Sin API Key: la app funcionará 100% en modo offline local.'
    );
  };

  const handleTestGemini = async () => {
    const keyToTest = apiKeyDraft.trim() || settings.geminiApiKey;
    setTestingGemini(true);
    setGeminiTestResult(null);
    try {
      const result = await testGeminiConnection(keyToTest, selectedModel);
      setGeminiTestResult({ ok: result.ok, message: result.message });
    } finally {
      setTestingGemini(false);
    }
  };

  const hasKey = Boolean(settings.geminiApiKey.trim());
  const transportLabel =
    stats.transportMode === 'ble-gatt'
      ? 'BLE GATT Nativo (Android APK)'
      : stats.transportMode === 'lan-relay'
      ? 'Relay Mesh LAN Wi-Fi (Expo Go / Web)'
      : stats.transportMode === 'web-broadcast'
      ? 'Web BroadcastChannel (entre pestañas)'
      : 'En espera (sin hardware BLE ni Relay LAN)';

  return (
    <View style={styles.screen}>
      <AppHeader title="Ajustes y Red Mesh" showBackButton meshActive={settings.meshEnabled} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Red Mesh Real */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="git-network-outline" size={22} color={Colors.primary} />
            <Text style={styles.cardTitle}>Red Mesh ({transportLabel})</Text>
          </View>

          <Text style={styles.note}>
            En APK nativo usa BLE GATT real entre teléfonos Android. Para probar 2 celulares reales
            desde Expo Go en el mismo Wi-Fi, corre{' '}
            <Text style={{ fontWeight: '700' }}>npm run mesh:relay</Text> en tu PC y pega su URL
            aquí. En Web funciona automático abriendo 2 pestañas.
          </Text>
          {capabilitiesNote ? <Text style={styles.capText}>{capabilitiesNote}</Text> : null}

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Activar descubrimiento y relevo Mesh</Text>
            <Switch value={settings.meshEnabled} onValueChange={(v) => void toggleMesh(v)} />
          </View>

          <Text style={styles.subTitle}>URL de Relay Mesh Local (para Expo Go en Wi-Fi):</Text>
          <View style={styles.btnRow}>
            <TextInput
              value={relayUrlDraft}
              onChangeText={setRelayUrlDraft}
              placeholder="http://192.168.1.50:8787"
              placeholderTextColor={Colors.onSurfaceVariant}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={[styles.input, { flex: 1 }]}
            />
            <Pressable
              style={styles.connectBtn}
              onPress={() => void handleSaveRelay()}
              accessibilityRole="button"
            >
              <Text style={styles.connectBtnText}>Conectar</Text>
            </Pressable>
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

          <Text style={styles.subTitle}>Consultar trámites en la Red Mesh:</Text>
          <TextInput
            value={testQuery}
            onChangeText={setTestQuery}
            placeholder="Consulta para enviar por mesh..."
            placeholderTextColor={Colors.onSurfaceVariant}
            style={styles.input}
          />
          <View style={styles.btnRow}>
            <AccessibleButton
              label="Enviar a vecinos reales"
              onPress={() => void handleRealMeshQuery()}
              style={styles.flexBtn}
            />
            <AccessibleButton
              label="Simular (demo)"
              variant="outline"
              onPress={() => void handleSimulateMeshHop()}
              style={styles.flexBtn}
            />
          </View>
          {meshFeedback ? <Text style={styles.feedback}>{meshFeedback}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Dispositivos cercanos reales ({peers.length})</Text>
          {peers.length === 0 ? (
            <Text style={styles.note}>
              Aún no hay otros nodos Voz Guía detectados. Abre otra pestaña Web, conecta el mismo
              Relay LAN en otro teléfono Expo Go, o acerca dos Android con el APK BLE instalado.
            </Text>
          ) : (
            peers.map((peer) => (
              <View key={peer.peerId} style={styles.peerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.peerName}>{peer.displayName}</Text>
                  <Text style={styles.peerMeta}>
                    ID: {peer.peerId} • {peer.transport ?? 'ble'} • {peer.hopDistance} salto(s)
                  </Text>
                </View>
                <Text style={[styles.peerBadge, peer.hasInternet ? styles.netYes : styles.netNo]}>
                  {peer.hasInternet ? 'Con internet' : 'Offline'}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Sección Google Gemini AI */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="sparkles" size={22} color={Colors.secondary} />
            <Text style={styles.cardTitle}>Google Gemini AI (Voz, Web y Fotos)</Text>
          </View>

          <View
            style={[
              styles.statusPill,
              hasKey ? styles.statusPillOnline : styles.statusPillOffline,
            ]}
          >
            <Ionicons
              name={hasKey ? 'checkmark-circle' : 'cloud-offline-outline'}
              size={16}
              color={hasKey ? Colors.onSecondaryContainer : Colors.onSurfaceVariant}
            />
            <Text
              style={[
                styles.statusPillText,
                { color: hasKey ? Colors.onSecondaryContainer : Colors.onSurfaceVariant },
              ]}
            >
              {hasKey
                ? `Gemini configurado (${settings.geminiModel}) • Voz + Web + Fotos`
                : 'Modo 100% Offline activo (catálogo local sin internet)'}
            </Text>
          </View>

          <Text style={styles.note}>
            Con una API Key gratuita de Google AI Studio (aistudio.google.com), activas dictado por
            micrófono en Expo Go, búsqueda actualizada en gob.mx y lectura de documentos por foto.
          </Text>

          <Text style={styles.subTitle}>Modelo Gemini:</Text>
          <View style={styles.modelList}>
            {GEMINI_MODEL_OPTIONS.map((option) => {
              const active = selectedModel === option.id;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => setSelectedModel(option.id)}
                  style={[styles.modelCard, active && styles.modelCardActive]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                >
                  <View style={styles.modelTopRow}>
                    <Text style={[styles.modelTitle, active && styles.modelTitleActive]}>
                      {option.label}
                    </Text>
                    {active ? (
                      <Ionicons name="checkmark-circle" size={18} color={Colors.onPrimary} />
                    ) : null}
                  </View>
                  <Text style={[styles.modelDesc, active && styles.modelDescActive]}>
                    {option.description}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.subTitle}>API Key de Google AI Studio:</Text>
          <TextInput
            value={apiKeyDraft}
            onChangeText={setApiKeyDraft}
            placeholder="Pega tu Gemini API Key (opcional)"
            placeholderTextColor={Colors.onSurfaceVariant}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />

          <View style={styles.btnRow}>
            <AccessibleButton
              label="Guardar"
              variant="primary"
              onPress={handleSaveSettings}
              style={styles.flexBtn}
            />
            <AccessibleButton
              label={testingGemini ? 'Probando...' : 'Probar Gemini'}
              variant="outline"
              disabled={testingGemini}
              onPress={() => void handleTestGemini()}
              style={styles.flexBtn}
            />
          </View>

          {testingGemini ? (
            <View style={styles.testingRow}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.note}>Verificando conexión con {selectedModel}...</Text>
            </View>
          ) : null}

          {savedFeedback ? <Text style={styles.feedback}>{savedFeedback}</Text> : null}

          {geminiTestResult ? (
            <View
              style={[
                styles.testResultBox,
                geminiTestResult.ok ? styles.testResultOk : styles.testResultError,
              ]}
            >
              <Text
                style={[
                  styles.testResultText,
                  { color: geminiTestResult.ok ? Colors.onSecondaryContainer : Colors.error },
                ]}
              >
                {geminiTestResult.message}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Accesibilidad */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Accesibilidad y Voz</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: Spacing.margin,
    paddingBottom: 40,
    gap: 14,
  },
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    gap: 10,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    ...Typography.headlineSm,
    color: Colors.primary,
    flexShrink: 1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  statusPillOnline: {
    backgroundColor: Colors.secondaryContainer,
  },
  statusPillOffline: {
    backgroundColor: Colors.surfaceContainer,
  },
  statusPillText: {
    ...Typography.labelSm,
    fontSize: 13,
    flex: 1,
  },
  subTitle: {
    ...Typography.labelMd,
    color: Colors.primary,
    marginTop: 4,
  },
  note: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
  },
  modelList: {
    gap: 8,
  },
  modelCard: {
    borderRadius: 12,
    padding: 12,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    gap: 3,
  },
  modelCardActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  modelTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modelTitle: {
    ...Typography.labelMd,
    color: Colors.primary,
  },
  modelTitleActive: {
    color: Colors.onPrimary,
  },
  modelDesc: {
    ...Typography.bodySm,
    fontSize: 13,
    color: Colors.onSurfaceVariant,
  },
  modelDescActive: {
    color: Colors.primaryFixed,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  flexBtn: {
    flex: 1,
  },
  connectBtn: {
    minHeight: 50,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectBtnText: {
    ...Typography.labelMd,
    color: Colors.onPrimary,
  },
  testingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  testResultBox: {
    borderRadius: 10,
    padding: 12,
  },
  testResultOk: {
    backgroundColor: Colors.secondaryContainer,
  },
  testResultError: {
    backgroundColor: Colors.errorContainer,
  },
  testResultText: {
    ...Typography.labelSm,
  },
  capText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.onPrimaryFixed,
    backgroundColor: Colors.primaryFixed,
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
    ...Typography.labelMd,
    fontSize: 15,
    color: Colors.onSurface,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    fontWeight: '600',
  },
  input: {
    minHeight: 50,
    borderWidth: 1.5,
    borderColor: Colors.outlineVariant,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 15,
    color: Colors.onSurface,
    backgroundColor: Colors.surfaceContainerLow,
  },
  peerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainer,
  },
  peerName: {
    ...Typography.labelMd,
    fontSize: 15,
    color: Colors.onSurface,
  },
  peerMeta: {
    ...Typography.bodySm,
    fontSize: 13,
    color: Colors.onSurfaceVariant,
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
    backgroundColor: Colors.secondaryContainer,
    color: Colors.onSecondaryContainer,
  },
  netNo: {
    backgroundColor: Colors.tertiaryFixed,
    color: Colors.onTertiaryFixedVariant,
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
    ...Typography.labelSm,
    color: Colors.secondary,
  },
  logLine: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    fontFamily: 'monospace',
    backgroundColor: Colors.surfaceContainerLow,
    padding: 6,
    borderRadius: 6,
  },
});
