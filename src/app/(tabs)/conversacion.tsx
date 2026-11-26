import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../../components/AppHeader';
import { NoticeDrawer } from '../../components/NoticeDrawer';
import { Colors, Spacing, Typography } from '../../theme/tokens';
import { searchTramitesLocal } from '../../services/database';
import { generateVoiceGuide } from '../../services/geminiService';
import { kvStore } from '../../services/kvStore';
import { buildSpeechScript, speakSpanish, stopSpeaking } from '../../services/voiceService';
import { VoiceGuideResponse } from '../../types/vozGuia';

export default function ConversacionScreen() {
  const params = useLocalSearchParams<{ prompt?: string; category?: string }>();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [userQuery, setUserQuery] = useState(
    params.prompt || 'Quiero saber cómo pedir una beca'
  );
  const [guide, setGuide] = useState<VoiceGuideResponse | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const executeQuery = useCallback(async (queryText: string, simplify = false) => {
    const clean = queryText.trim();
    if (!clean) return;
    setUserQuery(clean);
    kvStore.pushRecentQuery(clean);

    const results = await searchTramitesLocal(clean, { limit: 2 });
    const settings = kvStore.getSettings();

    const generated = await generateVoiceGuide({
      query: clean,
      searchResults: results,
      apiKey: settings.geminiApiKey,
      model: settings.geminiModel,
      simplify,
    });

    setGuide(generated);
  }, []);

  useEffect(() => {
    if (params.prompt) {
      void executeQuery(params.prompt, false);
    } else {
      void executeQuery(userQuery, false);
    }
  }, [params.prompt, executeQuery, userQuery]);

  const handleToggleListen = async () => {
    if (isSpeaking) {
      await stopSpeaking();
      setIsSpeaking(false);
      return;
    }
    if (!guide) return;
    const script = buildSpeechScript(guide, false);
    setIsSpeaking(true);
    await speakSpanish(script, {
      onDone: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  const handleMicVoiceReply = () => {
    if (isListening) {
      setIsListening(false);
      void stopSpeaking();
      return;
    }
    setIsListening(true);
    void speakSpanish('Te escucho. Di tu consulta o pregunta adicional.', {
      onDone: () => setIsListening(false),
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppHeader title="Conversación" onOpenNotices={() => setDrawerOpen(true)} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Banner de estado de Voz Guía */}
        <View style={styles.statusBanner}>
          <View style={styles.statusLeft}>
            <View style={styles.pulseDot} />
            <Text style={styles.statusText}>Voz Guía lista para escucharte</Text>
          </View>
          <Text style={styles.audioActiveText}>Audio activo</Text>
        </View>

        {/* Burbuja del usuario */}
        <View style={styles.userBubbleWrapper}>
          <View style={styles.userBubble}>
            <Text style={styles.userTag}>Tú</Text>
            <Text style={styles.userText}>{userQuery}</Text>
          </View>
        </View>

        {/* Burbuja del asistente */}
        <View style={styles.agentCard}>
          <View style={styles.agentHeader}>
            <View style={styles.agentTitleRow}>
              <View style={styles.agentAvatar}>
                <Ionicons name="headset" size={20} color={Colors.onSecondaryContainer} />
              </View>
              <Text style={styles.agentName}>Voz Guía</Text>
            </View>

            <Pressable
              style={[styles.listenBtn, isSpeaking && styles.listenBtnActive]}
              onPress={handleToggleListen}
            >
              <Ionicons
                name={isSpeaking ? 'stop-circle' : 'volume-high'}
                size={20}
                color={isSpeaking ? Colors.onSecondaryContainer : Colors.onPrimaryFixed}
              />
              <Text
                style={[
                  styles.listenBtnText,
                  isSpeaking && { color: Colors.onSecondaryContainer },
                ]}
              >
                {isSpeaking ? 'Detener audio' : 'Escuchar respuesta'}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.agentIntro}>
            {guide?.simpleAnswer ||
              'Con mucho gusto te acompaño. Tu trámite es más fácil si vamos paso a paso. Aquí tienes lo que necesitas hacer:'}
          </Text>

          {/* Pasos numerados */}
          <View style={styles.stepsList}>
            {guide?.steps && guide.steps.length > 0 ? (
              guide.steps.map((step) => (
                <View key={step.order} style={styles.stepItem}>
                  <View style={styles.stepNumberBadge}>
                    <Text style={styles.stepNumberText}>{step.order}</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>Paso {step.order}: {step.title}</Text>
                    <Text style={styles.stepDetail}>{step.instruction}</Text>
                  </View>
                </View>
              ))
            ) : (
              <>
                <View style={styles.stepItem}>
                  <View style={styles.stepNumberBadge}><Text style={styles.stepNumberText}>1</Text></View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>Paso 1: Identificación y requisitos</Text>
                    <Text style={styles.stepDetail}>Ten a la mano tu CURP y comprobante vigente.</Text>
                  </View>
                </View>
                <View style={styles.stepItem}>
                  <View style={styles.stepNumberBadge}><Text style={styles.stepNumberText}>2</Text></View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>Paso 2: Registro en módulo o línea</Text>
                    <Text style={styles.stepDetail}>Acude a la ventanilla oficial o ingresa tu solicitud.</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Botones de acción rápida: Repite por favor / Explícalo más sencillo */}
        <View style={styles.quickActionsRow}>
          <Pressable
            style={styles.quickActionBtn}
            onPress={() => {
              if (guide) {
                const script = buildSpeechScript(guide, false);
                setIsSpeaking(true);
                void speakSpanish(script, {
                  onDone: () => setIsSpeaking(false),
                  onError: () => setIsSpeaking(false),
                });
              }
            }}
          >
            <Ionicons name="refresh" size={20} color={Colors.primary} />
            <Text style={styles.quickActionText}>Repite por favor</Text>
          </Pressable>

          <Pressable
            style={styles.quickActionBtn}
            onPress={() => {
              void executeQuery(userQuery, true);
            }}
          >
            <Ionicons name="bulb-outline" size={20} color={Colors.primary} />
            <Text style={styles.quickActionText}>Explícalo más sencillo</Text>
          </Pressable>
        </View>

        {/* Input para mensaje nuevo y botón de micrófono para responder */}
        <View style={styles.bottomBar}>
          <View style={styles.chatInputRow}>
            <TextInput
              style={styles.chatInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Escribe tu duda aquí..."
              placeholderTextColor={Colors.onSurfaceVariant}
              onSubmitEditing={() => {
                if (inputText.trim()) {
                  void executeQuery(inputText.trim(), false);
                  setInputText('');
                }
              }}
            />
            <Pressable
              style={styles.chatSendBtn}
              onPress={() => {
                if (inputText.trim()) {
                  void executeQuery(inputText.trim(), false);
                  setInputText('');
                }
              }}
            >
              <Ionicons name="send" size={20} color={Colors.onPrimary} />
            </Pressable>
          </View>

          <Pressable
            style={[styles.voiceReplyBtn, isListening && styles.voiceReplyBtnActive]}
            onPress={handleMicVoiceReply}
          >
            <Ionicons
              name={isListening ? 'stop' : 'mic'}
              size={24}
              color={Colors.onPrimary}
            />
            <Text style={styles.voiceReplyText}>
              {isListening ? 'Escuchando tu respuesta...' : 'Toca para responder por voz'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <NoticeDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </KeyboardAvoidingView>
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
    gap: Spacing.md,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.secondaryContainer,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulseDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: Colors.secondary,
  },
  statusText: {
    ...Typography.labelSm,
    color: Colors.onSecondaryContainer,
  },
  audioActiveText: {
    ...Typography.labelSm,
    fontSize: 12,
    color: Colors.onSecondaryContainer,
  },
  userBubbleWrapper: {
    alignItems: 'flex-end',
    marginTop: 4,
  },
  userBubble: {
    maxWidth: '85%',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderTopRightRadius: 4,
  },
  userTag: {
    ...Typography.labelSm,
    fontSize: 12,
    color: Colors.primaryFixed,
    marginBottom: 2,
  },
  userText: {
    ...Typography.bodyLg,
    color: Colors.onPrimary,
  },
  agentCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 16,
    borderTopLeftRadius: 4,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    gap: 12,
  },
  agentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  agentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  agentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentName: {
    ...Typography.headlineSm,
    fontSize: 18,
    color: Colors.primary,
  },
  listenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryFixed,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
  },
  listenBtnActive: {
    backgroundColor: Colors.secondaryContainer,
  },
  listenBtnText: {
    ...Typography.labelMd,
    fontSize: 13,
    color: Colors.onPrimaryFixed,
  },
  agentIntro: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
    lineHeight: 22,
  },
  stepsList: {
    gap: 8,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.surfaceContainerLow,
    padding: 12,
    borderRadius: 12,
  },
  stepNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    ...Typography.labelMd,
    color: Colors.onPrimary,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    ...Typography.labelMd,
    color: Colors.primary,
  },
  stepDetail: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
    marginTop: 2,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickActionBtn: {
    flex: 1,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceContainer,
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  quickActionText: {
    ...Typography.labelMd,
    fontSize: 14,
    color: Colors.primary,
  },
  bottomBar: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 16,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    marginTop: 6,
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatInput: {
    flex: 1,
    minHeight: 48,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    color: Colors.onSurface,
  },
  chatSendBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceReplyBtn: {
    width: '100%',
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  voiceReplyBtnActive: {
    backgroundColor: Colors.secondary,
  },
  voiceReplyText: {
    ...Typography.labelLg,
    fontSize: 16,
    color: Colors.onPrimary,
  },
});
