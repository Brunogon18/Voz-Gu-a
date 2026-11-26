import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../../components/AppHeader';
import { NoticeDrawer } from '../../components/NoticeDrawer';
import { Colors, Spacing, Typography } from '../../theme/tokens';
import { searchTramitesLocal } from '../../services/database';
import { DocumentPickMode, pickDocumentImage } from '../../services/documentPicker';
import { analyzeDocumentWithGemini, generateVoiceGuide } from '../../services/geminiService';
import { kvStore } from '../../services/kvStore';
import { meshService } from '../../services/meshService';
import { consumePendingDocument } from '../../services/pendingDocument';
import { listenSpanishOnce, stopListeningSpanish } from '../../services/speechInput';
import { buildSpeechScript, speakSpanish, stopSpeaking } from '../../services/voiceService';
import {
  ConversationTurn,
  DocumentImageInput,
  VoiceGuideResponse,
} from '../../types/vozGuia';

const DEFAULT_PROMPT = 'Quiero saber cómo pedir una beca';

export default function ConversacionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    prompt?: string;
    category?: string;
    reqId?: string;
    scanId?: string;
  }>();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [userQuery, setUserQuery] = useState(params.prompt || DEFAULT_PROMPT);
  const [guide, setGuide] = useState<VoiceGuideResponse | null>(null);
  const [activeDocument, setActiveDocument] = useState<DocumentImageInput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState('');

  const historyRef = useRef<ConversationTurn[]>([]);
  const lastRequestKeyRef = useRef<string>('');

  const speakGuideResponse = useCallback(async (response: VoiceGuideResponse, simplify: boolean) => {
    const settings = kvStore.getSettings();
    const script = buildSpeechScript(response, simplify);
    setIsSpeaking(true);
    await speakSpanish(script, {
      rate: settings.speechRate,
      onDone: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  }, []);

  const runTextQuery = useCallback(
    async (queryText: string, options?: { simplify?: boolean; autoSpeak?: boolean }) => {
      const clean = queryText.trim();
      if (!clean) return;

      const simplify = options?.simplify ?? false;
      setIsLoading(true);
      setUserQuery(clean);
      setActiveDocument(null);
      setVoiceFeedback('');
      kvStore.pushRecentQuery(clean);

      try {
        const settings = kvStore.getSettings();
        let results = await searchTramitesLocal(clean, { limit: 2 });
        if (results.length === 0 && settings.meshEnabled) {
          results = await meshService.queryAcrossMesh(clean);
        }

        const generated = await generateVoiceGuide({
          query: clean,
          searchResults: results,
          apiKey: settings.geminiApiKey,
          model: settings.geminiModel,
          simplify,
          history: historyRef.current,
        });

        historyRef.current = [
          ...historyRef.current.slice(-4),
          { role: 'user', text: clean },
          { role: 'model', text: `${generated.title}: ${generated.simpleAnswer}` },
        ];

        setGuide(generated);

        if (options?.autoSpeak) {
          await speakGuideResponse(generated, simplify);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [speakGuideResponse]
  );

  const runDocumentAnalysis = useCallback(
    async (
      image: DocumentImageInput,
      options?: { simplify?: boolean; autoSpeak?: boolean; label?: string }
    ) => {
      const simplify = options?.simplify ?? false;
      setIsLoading(true);
      setActiveDocument(image);
      setUserQuery(options?.label ?? 'Foto de documento enviada para lectura con Gemini');
      setVoiceFeedback('');

      try {
        const settings = kvStore.getSettings();
        const generated = await analyzeDocumentWithGemini({
          image,
          apiKey: settings.geminiApiKey,
          model: settings.geminiModel,
          simplify,
        });

        historyRef.current = [
          ...historyRef.current.slice(-4),
          {
            role: 'user',
            text: image.prompt?.trim() || 'Envié una foto de un documento oficial para que me lo expliques.',
          },
          { role: 'model', text: `${generated.title}: ${generated.simpleAnswer}` },
        ];

        setGuide(generated);

        if (options?.autoSpeak) {
          await speakGuideResponse(generated, simplify);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [speakGuideResponse]
  );

  useEffect(() => {
    const incomingScanId = typeof params.scanId === 'string' ? params.scanId : '';
    const incomingPrompt = typeof params.prompt === 'string' ? params.prompt : '';
    const incomingReqId = typeof params.reqId === 'string' ? params.reqId : '';

    const requestKey = incomingScanId
      ? `scan:${incomingScanId}`
      : incomingPrompt
      ? `prompt:${incomingPrompt}:${incomingReqId}`
      : 'initial:default';

    if (lastRequestKeyRef.current === requestKey) return;
    lastRequestKeyRef.current = requestKey;

    let cancelled = false;

    void (async () => {
      if (incomingScanId) {
        const pendingImage = consumePendingDocument(incomingScanId);
        if (pendingImage && !cancelled) {
          await runDocumentAnalysis(pendingImage, { autoSpeak: true });
          return;
        }
      }

      const targetPrompt = incomingPrompt || DEFAULT_PROMPT;
      const settings = kvStore.getSettings();
      let results = await searchTramitesLocal(targetPrompt, { limit: 2 });
      if (results.length === 0 && settings.meshEnabled) {
        results = await meshService.queryAcrossMesh(targetPrompt);
      }

      const generated = await generateVoiceGuide({
        query: targetPrompt,
        searchResults: results,
        apiKey: settings.geminiApiKey,
        model: settings.geminiModel,
        simplify: false,
      });

      if (cancelled) return;
      kvStore.pushRecentQuery(targetPrompt);
      historyRef.current = [
        { role: 'user', text: targetPrompt },
        { role: 'model', text: `${generated.title}: ${generated.simpleAnswer}` },
      ];
      setActiveDocument(null);
      setUserQuery(targetPrompt);
      setGuide(generated);
    })();

    return () => {
      cancelled = true;
    };
  }, [params.prompt, params.reqId, params.scanId, runDocumentAnalysis]);

  const handleToggleListen = async () => {
    if (isSpeaking) {
      await stopSpeaking();
      setIsSpeaking(false);
      return;
    }
    if (!guide) return;
    await speakGuideResponse(guide, false);
  };

  const handleSimplify = () => {
    if (activeDocument) {
      void runDocumentAnalysis(activeDocument, {
        simplify: true,
        autoSpeak: true,
        label: 'Explicación más sencilla de tu documento',
      });
      return;
    }
    void runTextQuery(userQuery, { simplify: true, autoSpeak: true });
  };

  const handleSendInput = () => {
    const clean = inputText.trim();
    if (!clean) return;
    setInputText('');
    void runTextQuery(clean, { simplify: false, autoSpeak: false });
  };

  const handleMicVoiceReply = async () => {
    if (isListening) {
      setIsListening(false);
      await stopListeningSpanish();
      await stopSpeaking();
      return;
    }
    setIsListening(true);
    setVoiceFeedback('Escuchando tu pregunta...');
    await stopSpeaking();

    const capture = await listenSpanishOnce();
    setIsListening(false);
    setVoiceFeedback(capture.note);

    if (capture.status === 'recognized' && capture.transcript) {
      await runTextQuery(capture.transcript, { simplify: false, autoSpeak: true });
    }
  };

  const handlePickDocument = async (mode: DocumentPickMode) => {
    setVoiceFeedback(
      mode === 'camera' ? 'Abriendo cámara...' : 'Elige la foto de tu documento o aviso...'
    );
    const picked = await pickDocumentImage(mode);
    if (picked.status === 'cancelled') {
      setVoiceFeedback('');
      return;
    }
    if (picked.status !== 'picked' || !picked.image) {
      setVoiceFeedback(picked.message ?? 'No se pudo cargar la imagen.');
      return;
    }
    const imageWithPrompt: DocumentImageInput = {
      ...picked.image,
      prompt: inputText.trim() || undefined,
    };
    if (inputText.trim()) {
      setInputText('');
    }
    await runDocumentAnalysis(imageWithPrompt, { autoSpeak: true });
  };

  const sourceLabel =
    guide?.source === 'gemini'
      ? `Gemini AI · ${guide.modelUsed ?? 'gemini-3.5-flash-lite'}`
      : guide?.source === 'mesh-peer'
      ? 'Recibido vía Red Mesh'
      : 'Guía Local Offline';

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
            <Text style={styles.statusText}>
              {isLoading ? 'Analizando respuesta...' : 'Voz Guía lista para escucharte'}
            </Text>
          </View>
          <Text style={styles.audioActiveText}>Audio activo</Text>
        </View>

        {/* Burbuja del usuario */}
        <View style={styles.userBubbleWrapper}>
          <View style={styles.userBubble}>
            <Text style={styles.userTag}>Tú</Text>
            <Text style={styles.userText}>{userQuery}</Text>
            {activeDocument?.uri ? (
              <Image
                source={{ uri: activeDocument.uri }}
                style={styles.documentPreview}
                resizeMode="cover"
                accessibilityLabel="Vista previa del documento escaneado"
              />
            ) : null}
          </View>
        </View>

        {/* Burbuja del asistente */}
        <View style={styles.agentCard}>
          <View style={styles.agentHeader}>
            <View style={styles.agentTitleRow}>
              <View style={styles.agentAvatar}>
                <Ionicons
                  name={guide?.source === 'gemini' ? 'sparkles' : 'headset'}
                  size={20}
                  color={Colors.onSecondaryContainer}
                />
              </View>
              <View>
                <Text style={styles.agentName}>Voz Guía</Text>
                <Text style={styles.sourceBadgeText}>{sourceLabel}</Text>
              </View>
            </View>

            <Pressable
              style={[styles.listenBtn, isSpeaking && styles.listenBtnActive]}
              onPress={() => void handleToggleListen()}
              accessibilityRole="button"
              accessibilityLabel={isSpeaking ? 'Detener audio' : 'Escuchar respuesta'}
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
                {isSpeaking ? 'Detener' : 'Escuchar'}
              </Text>
            </Pressable>
          </View>

          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loadingText}>
                {activeDocument
                  ? 'Gemini está leyendo tu documento y preparando pasos sencillos...'
                  : 'Preparando tu guía paso a paso...'}
              </Text>
            </View>
          ) : (
            <>
              {guide?.title ? <Text style={styles.guideTitle}>{guide.title}</Text> : null}

              {guide?.documentDetected ? (
                <View style={styles.detectedPill}>
                  <Ionicons name="document-text-outline" size={16} color={Colors.primary} />
                  <Text style={styles.detectedPillText}>
                    Documento detectado: {guide.documentDetected}
                  </Text>
                </View>
              ) : null}

              <Text style={styles.agentIntro}>
                {guide?.simpleAnswer ||
                  'Con mucho gusto te acompaño. Tu trámite es más fácil si vamos paso a paso.'}
              </Text>

              {guide?.importantDates && guide.importantDates.length > 0 ? (
                <View style={styles.infoBox}>
                  <Text style={styles.infoBoxTitle}>Fechas y datos clave:</Text>
                  {guide.importantDates.map((item, idx) => (
                    <Text key={`${item}-${idx}`} style={styles.infoBoxItem}>
                      • {item}
                    </Text>
                  ))}
                </View>
              ) : null}

              {guide?.requirements && guide.requirements.length > 0 ? (
                <View style={styles.requirementsBox}>
                  <Text style={styles.requirementsTitle}>Documentos / requisitos:</Text>
                  {guide.requirements.map((req, idx) => (
                    <Text key={`${req}-${idx}`} style={styles.requirementItem}>
                      • {req}
                    </Text>
                  ))}
                </View>
              ) : null}

              {/* Pasos numerados */}
              {guide?.steps && guide.steps.length > 0 ? (
                <View style={styles.stepsList}>
                  {guide.steps.map((step) => (
                    <View key={`${step.order}-${step.title}`} style={styles.stepItem}>
                      <View style={styles.stepNumberBadge}>
                        <Text style={styles.stepNumberText}>{step.order}</Text>
                      </View>
                      <View style={styles.stepContent}>
                        <Text style={styles.stepTitle}>
                          Paso {step.order}: {step.title}
                        </Text>
                        <Text style={styles.stepDetail}>{step.instruction}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}

              {guide?.closingTip ? (
                <View style={styles.tipBox}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={Colors.secondary} />
                  <Text style={styles.tipText}>{guide.closingTip}</Text>
                </View>
              ) : null}

              {guide?.diagnosticsNote ? (
                <Pressable
                  style={styles.diagnosticsRow}
                  onPress={() => router.push('/(tabs)/mesh')}
                  accessibilityRole="button"
                >
                  <Ionicons name="settings-outline" size={15} color={Colors.onSurfaceVariant} />
                  <Text style={styles.diagnosticsText}>{guide.diagnosticsNote}</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>

        {/* Botones de acción rápida: Repite por favor / Explícalo más sencillo */}
        <View style={styles.quickActionsRow}>
          <Pressable
            style={styles.quickActionBtn}
            onPress={() => {
              if (guide) {
                void speakGuideResponse(guide, false);
              }
            }}
            accessibilityRole="button"
          >
            <Ionicons name="refresh" size={20} color={Colors.primary} />
            <Text style={styles.quickActionText}>Repite por favor</Text>
          </Pressable>

          <Pressable
            style={styles.quickActionBtn}
            onPress={handleSimplify}
            accessibilityRole="button"
          >
            <Ionicons name="bulb-outline" size={20} color={Colors.primary} />
            <Text style={styles.quickActionText}>Explícalo más sencillo</Text>
          </Pressable>
        </View>

        {/* Input para mensaje nuevo, foto de documento y botón de micrófono */}
        <View style={styles.bottomBar}>
          <View style={styles.chatInputRow}>
            <TextInput
              style={styles.chatInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Escribe tu duda o seguimiento..."
              placeholderTextColor={Colors.onSurfaceVariant}
              onSubmitEditing={handleSendInput}
              returnKeyType="send"
            />
            <Pressable
              style={styles.chatSendBtn}
              onPress={handleSendInput}
              accessibilityRole="button"
              accessibilityLabel="Enviar pregunta"
            >
              <Ionicons name="send" size={20} color={Colors.onPrimary} />
            </Pressable>
          </View>

          <View style={styles.mediaActionsRow}>
            {Platform.OS !== 'web' ? (
              <Pressable
                style={styles.docActionBtn}
                onPress={() => void handlePickDocument('camera')}
                accessibilityRole="button"
                accessibilityLabel="Tomar foto a documento para leer con Gemini"
              >
                <Ionicons name="camera-outline" size={20} color={Colors.primary} />
                <Text style={styles.docActionText}>Foto con cámara</Text>
              </Pressable>
            ) : null}

            <Pressable
              style={styles.docActionBtn}
              onPress={() => void handlePickDocument('library')}
              accessibilityRole="button"
              accessibilityLabel="Elegir foto de documento para leer con Gemini"
            >
              <Ionicons name="document-attach-outline" size={20} color={Colors.primary} />
              <Text style={styles.docActionText}>
                {Platform.OS === 'web' ? 'Subir foto de documento (Gemini)' : 'Foto de galería'}
              </Text>
            </Pressable>
          </View>

          <Pressable
            style={[styles.voiceReplyBtn, isListening && styles.voiceReplyBtnActive]}
            onPress={() => void handleMicVoiceReply()}
            accessibilityRole="button"
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

          {voiceFeedback ? <Text style={styles.voiceFeedbackText}>{voiceFeedback}</Text> : null}
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
    maxWidth: '88%',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderTopRightRadius: 4,
    gap: 8,
  },
  userTag: {
    ...Typography.labelSm,
    fontSize: 12,
    color: Colors.primaryFixed,
  },
  userText: {
    ...Typography.bodyLg,
    color: Colors.onPrimary,
  },
  documentPreview: {
    width: 220,
    height: 140,
    borderRadius: 10,
    backgroundColor: Colors.primaryContainer,
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
    gap: 8,
  },
  agentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  agentAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentName: {
    ...Typography.headlineSm,
    fontSize: 18,
    color: Colors.primary,
  },
  sourceBadgeText: {
    ...Typography.bodySm,
    fontSize: 12,
    color: Colors.secondary,
    fontWeight: '700',
  },
  listenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryFixed,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  loadingText: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    flex: 1,
  },
  guideTitle: {
    ...Typography.headlineSm,
    color: Colors.primary,
  },
  detectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryFixed,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  detectedPillText: {
    ...Typography.labelSm,
    fontSize: 13,
    color: Colors.onPrimaryFixed,
  },
  agentIntro: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
    lineHeight: 24,
  },
  infoBox: {
    backgroundColor: Colors.tertiaryFixed,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  infoBoxTitle: {
    ...Typography.labelMd,
    color: Colors.onTertiaryFixedVariant,
  },
  infoBoxItem: {
    ...Typography.bodySm,
    color: Colors.tertiary,
  },
  requirementsBox: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  requirementsTitle: {
    ...Typography.labelMd,
    color: Colors.primary,
  },
  requirementItem: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
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
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.surfaceContainer,
    borderRadius: 12,
    padding: 12,
  },
  tipText: {
    ...Typography.bodySm,
    color: Colors.onSurface,
    flex: 1,
  },
  diagnosticsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 4,
  },
  diagnosticsText: {
    ...Typography.bodySm,
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    flex: 1,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickActionBtn: {
    flex: 1,
    minHeight: 56,
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
  mediaActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  docActionBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  docActionText: {
    ...Typography.labelSm,
    color: Colors.primary,
  },
  voiceReplyBtn: {
    width: '100%',
    minHeight: 56,
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
  voiceFeedbackText: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
  },
});
