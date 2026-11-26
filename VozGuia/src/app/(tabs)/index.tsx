import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AccessibleButton } from '../../components/AccessibleButton';
import { MeshStatusBanner } from '../../components/MeshStatusBanner';
import { StepGuideCard } from '../../components/StepGuideCard';
import {
  hasNativeSpeechModule,
  recognizeSpeechOnce,
  requestAndroidRuntimePermissions,
  stopNativeSpeech,
} from '../../native/androidBridge';
import { getTramiteById, searchTramitesLocal } from '../../services/database';
import { generateVoiceGuide } from '../../services/geminiService';
import { kvStore } from '../../services/kvStore';
import { meshService } from '../../services/meshService';
import { buildSpeechScript, speakSpanish, stopSpeaking } from '../../services/voiceService';
import { AppSettings, MeshStats, VoiceGuideResponse } from '../../types/vozGuia';

const QUICK_PROMPTS = [
  'Quiero saber cómo pedir una beca',
  'Necesito información para tramitar mi cita médica',
  'Cómo reponer mi certificado de estudios SEP',
];

export default function VoiceGuideHomeScreen() {
  const params = useLocalSearchParams<{ tramiteId?: string }>();
  const [query, setQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [guide, setGuide] = useState<VoiceGuideResponse | null>(null);
  const [settings, setSettings] = useState<AppSettings>(() => kvStore.getSettings());
  const [meshStats, setMeshStats] = useState<MeshStats>(() => meshService.getStats());
  const [statusMessage, setStatusMessage] = useState(
    'Toca el micrófono grande o escribe qué trámite necesitas.'
  );

  useFocusEffect(
    useCallback(() => {
      setSettings(kvStore.getSettings());
      setMeshStats(meshService.getStats());
    }, [])
  );

  const runSearchAndGuide = useCallback(
    async (textQuery: string, simplify = false, speakAutomatically = true) => {
      const clean = textQuery.trim();
      if (!clean) return;

      setIsLoading(true);
      setStatusMessage('Buscando en SQLite vectorial local y red mesh...');
      kvStore.pushRecentQuery(clean);

      try {
        let results = await searchTramitesLocal(clean, { limit: 3 });

        if (results.length === 0 && settings.meshEnabled) {
          setStatusMessage('Sin coincidencia directa: consultando nodos cercanos por Red Mesh...');
          results = await meshService.queryAcrossMesh(clean);
        }

        const currentSettings = kvStore.getSettings();
        const generated = await generateVoiceGuide({
          query: clean,
          searchResults: results,
          apiKey: currentSettings.geminiApiKey,
          model: currentSettings.geminiModel,
          simplify,
        });

        setGuide(generated);
        setMeshStats(meshService.getStats());
        setStatusMessage(
          generated.source === 'gemini'
            ? 'Guía explicada con Google Gemini.'
            : 'Guía lista en modo offline sin consumo de internet.'
        );

        if (speakAutomatically) {
          const script = buildSpeechScript(generated, simplify);
          await speakSpanish(script, {
            rate: currentSettings.speechRate,
            onStart: () => setIsSpeaking(true),
            onDone: () => setIsSpeaking(false),
            onError: () => setIsSpeaking(false),
          });
        }
      } finally {
        setIsLoading(false);
      }
    },
    [settings.meshEnabled]
  );

  useEffect(() => {
    if (!params.tramiteId) return;
    void (async () => {
      const tramite = await getTramiteById(params.tramiteId as string);
      if (tramite) {
        setQuery(tramite.title);
        await runSearchAndGuide(tramite.title, false, false);
      }
    })();
  }, [params.tramiteId, runSearchAndGuide]);

  const handleVoicePress = async () => {
    if (isListening) {
      await stopNativeSpeech();
      setIsListening(false);
      return;
    }

    const perms = await requestAndroidRuntimePermissions();
    if (!perms.audioGranted) {
      setStatusMessage('Activa el permiso de micrófono para usar la guía por voz.');
      return;
    }

    if (!hasNativeSpeechModule()) {
      setStatusMessage(
        'Modo emulador/Expo Go: escribe tu consulta abajo o toca un ejemplo rápido para escuchar la guía.'
      );
      return;
    }

    setIsListening(true);
    setStatusMessage('Escuchando... di qué trámite necesitas hacer.');
    try {
      const recognized = await recognizeSpeechOnce('es-MX');
      setIsListening(false);
      if (recognized && recognized.trim()) {
        setQuery(recognized);
        await runSearchAndGuide(recognized, false, true);
      } else {
        setStatusMessage('No alcancé a escucharte. Intenta de nuevo o escribe tu consulta.');
      }
    } catch {
      setIsListening(false);
      setStatusMessage('No se pudo iniciar el dictado de voz; puedes escribir tu pregunta abajo.');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <MeshStatusBanner stats={meshStats} hasGeminiKey={Boolean(settings.geminiApiKey.trim())} />

      <View style={styles.heroCard}>
        <Text style={[styles.heroTitle, settings.largeTextMode && styles.heroTitleLarge]}>
          ¿Qué trámite necesitas hoy?
        </Text>
        <Text style={styles.heroSubtitle}>{statusMessage}</Text>

        <Pressable
          onPress={handleVoicePress}
          accessibilityRole="button"
          accessibilityLabel={isListening ? 'Detener micrófono' : 'Hablar con Voz Guía'}
          style={({ pressed }) => [
            styles.micButton,
            isListening && styles.micButtonListening,
            pressed && styles.micButtonPressed,
          ]}
        >
          <Ionicons name={isListening ? 'stop' : 'mic'} size={48} color="#FFFFFF" />
          <Text style={styles.micLabel}>
            {isListening ? 'Escuchando...' : 'Toca para hablar'}
          </Text>
        </Pressable>

        <View style={styles.searchRow}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Ejemplo: cita médica IMSS o beca"
            placeholderTextColor="#6E827C"
            style={styles.input}
            returnKeyType="search"
            onSubmitEditing={() => void runSearchAndGuide(query)}
          />
          <AccessibleButton
            label="Buscar"
            onPress={() => void runSearchAndGuide(query)}
            disabled={isLoading || !query.trim()}
            style={styles.searchButton}
          />
        </View>
      </View>

      <View style={styles.quickSection}>
        <Text style={styles.sectionLabel}>Ejemplos rápidos (toca uno):</Text>
        {QUICK_PROMPTS.map((example) => (
          <Pressable
            key={example}
            onPress={() => {
              setQuery(example);
              void runSearchAndGuide(example, false, true);
            }}
            style={styles.quickChip}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={20} color="#0B5D4B" />
            <Text style={styles.quickChipText}>{example}</Text>
          </Pressable>
        ))}
      </View>

      {isLoading && (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#0B5D4B" />
          <Text style={styles.loadingText}>Preparando tu explicación paso a paso...</Text>
        </View>
      )}

      {guide && !isLoading && (
        <StepGuideCard
          guide={guide}
          largeText={settings.largeTextMode}
          isSpeaking={isSpeaking}
          onSpeakAll={() => {
            const script = buildSpeechScript(guide, false);
            void speakSpanish(script, {
              rate: settings.speechRate,
              onStart: () => setIsSpeaking(true),
              onDone: () => setIsSpeaking(false),
              onError: () => setIsSpeaking(false),
            });
          }}
          onStopSpeaking={() => {
            void stopSpeaking();
            setIsSpeaking(false);
          }}
          onSimplify={() => void runSearchAndGuide(query || guide.title, true, true)}
          onSpeakStep={(stepText) => {
            void speakSpanish(stepText, {
              rate: settings.speechRate,
              onStart: () => setIsSpeaking(true),
              onDone: () => setIsSpeaking(false),
              onError: () => setIsSpeaking(false),
            });
          }}
        />
      )}
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
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#D6E2DF',
    alignItems: 'center',
    gap: 14,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#102A24',
    textAlign: 'center',
  },
  heroTitleLarge: {
    fontSize: 25,
  },
  heroSubtitle: {
    fontSize: 15,
    color: '#34524A',
    textAlign: 'center',
    lineHeight: 22,
  },
  micButton: {
    width: 164,
    height: 164,
    borderRadius: 82,
    backgroundColor: '#0B5D4B',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    elevation: 4,
  },
  micButtonListening: {
    backgroundColor: '#9E2A2B',
  },
  micButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  micLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  searchRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minHeight: 54,
    borderWidth: 2,
    borderColor: '#B8DDD4',
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#102A24',
    backgroundColor: '#F9FCFB',
  },
  searchButton: {
    minWidth: 98,
  },
  quickSection: {
    marginTop: 16,
    marginBottom: 16,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#102A24',
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#CBE0DA',
  },
  quickChipText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#163D34',
  },
  loadingBox: {
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 16,
    color: '#0B5D4B',
    fontWeight: '600',
  },
});
