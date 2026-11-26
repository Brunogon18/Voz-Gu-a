import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
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
import { useSpeechStatus } from '../../hooks/useSpeechStatus';
import { useVoiceCapture } from '../../hooks/useVoiceCapture';
import { Colors, Spacing, Typography } from '../../theme/tokens';
import { saveCustomTramite, searchTramitesLocal } from '../../services/database';
import { DocumentPickMode, pickDocumentImage } from '../../services/documentPicker';
import { analyzeDocumentWithGemini, generateVoiceGuide } from '../../services/geminiService';
import { kvStore } from '../../services/kvStore';
import { meshService } from '../../services/meshService';
import { consumePendingDocument } from '../../services/pendingDocument';
import {
  buildSpeechScript,
  detectSpeechControlCommand,
  executeSpeechCommand,
  pauseSpeaking,
  resumeSpeaking,
  speakSpanish,
  stopSpeaking,
} from '../../services/voiceService';
import {
  fetchOfficialTramiteGuide,
  guideResponseToTramiteRecord,
} from '../../services/webTramiteService';
import {
  ConversationTurn,
  DocumentImageInput,
  TramiteProgress,
  VoiceGuideResponse,
} from '../../types/vozGuia';

const DEFAULT_PROMPT = 'Quiero saber cómo pedir una beca';

function makeGuideStorageId(guide: VoiceGuideResponse): string {
  if (guide.id) return guide.id;
  const slug = guide.title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 42);
  return `guide-${slug || 'tramite'}`;
}

export default function ConversacionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    prompt?: string;
    category?: string;
    reqId?: string;
    scanId?: string;
    sourceUrl?: string;
    autoSpeak?: string;
  }>();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [userQuery, setUserQuery] = useState(params.prompt || DEFAULT_PROMPT);
  const [guide, setGuide] = useState<VoiceGuideResponse | null>(null);
  const [activeDocument, setActiveDocument] = useState<DocumentImageInput | null>(null);
  const [activeSourceUrl, setActiveSourceUrl] = useState<string>('');
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [checkedRequirements, setCheckedRequirements] = useState<number[]>([]);
  const speech = useSpeechStatus();
  const isSpeaking = speech.status === 'speaking';
  const isSpeechPaused = speech.status === 'paused';

  const [isLoading, setIsLoading] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState('');
  const [shareFeedback, setShareFeedback] = useState('');

  const historyRef = useRef<ConversationTurn[]>([]);
  const lastRequestKeyRef = useRef<string>('');

  const persistProgress = useCallback(
    (
      currentGuide: VoiceGuideResponse,
      nextSteps: number[],
      nextReqs: number[]
    ) => {
      const id = makeGuideStorageId(currentGuide);
      const record: TramiteProgress = {
        id,
        title: currentGuide.title,
        category: currentGuide.category ?? 'educacion',
        summary: currentGuide.simpleAnswer,
        sourceUrl: currentGuide.sourceUrls?.[0]?.url,
        completedSteps: nextSteps,
        checkedRequirements: nextReqs,
        totalSteps: currentGuide.steps.length,
        updatedAt: Date.now(),
      };
      kvStore.saveTramiteProgress(record);
    },
    []
  );

  const hydrateGuide = useCallback(
    (nextGuide: VoiceGuideResponse) => {
      const id = makeGuideStorageId(nextGuide);
      const saved = kvStore.getTramiteProgress(id);
      const initialSteps = saved?.completedSteps ?? [];
      const initialReqs = saved?.checkedRequirements ?? [];
      const enriched: VoiceGuideResponse = { ...nextGuide, id };
      setGuide(enriched);
      setCompletedSteps(initialSteps);
      setCheckedRequirements(initialReqs);
      setShareFeedback('');
      if (enriched.steps.length > 0) {
        persistProgress(enriched, initialSteps, initialReqs);
      }
    },
    [persistProgress]
  );

  const speakGuideResponse = useCallback(async (response: VoiceGuideResponse, simplify: boolean) => {
    const settings = kvStore.getSettings();
    const script = buildSpeechScript(response, simplify);
    await speakSpanish(script, {
      rate: settings.speechRate,
      sourceId: `guide-${makeGuideStorageId(response)}`,
      label: response.title || 'Guía de Voz Guía',
    });
  }, []);

  const runTextQuery = useCallback(
    async (
      queryText: string,
      options?: { simplify?: boolean; autoSpeak?: boolean; forceWebSearch?: boolean }
    ) => {
      const clean = queryText.trim();
      if (!clean) return;

      const speechCmd = detectSpeechControlCommand(clean);
      if (speechCmd) {
        const msg = await executeSpeechCommand(speechCmd);
        setVoiceFeedback(msg);
        return;
      }

      const simplify = options?.simplify ?? false;
      setIsLoading(true);
      setUserQuery(clean);
      setActiveDocument(null);
      setActiveSourceUrl('');
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
          enableWebSearch: options?.forceWebSearch,
        });

        if (generated.source === 'gemini-web' && generated.steps.length > 0) {
          const record = guideResponseToTramiteRecord(generated);
          await saveCustomTramite(record);
          generated.id = record.id;
        }

        historyRef.current = [
          ...historyRef.current.slice(-4),
          { role: 'user', text: clean },
          { role: 'model', text: `${generated.title}: ${generated.simpleAnswer}` },
        ];

        hydrateGuide(generated);

        if (options?.autoSpeak) {
          await speakGuideResponse(generated, simplify);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [hydrateGuide, speakGuideResponse]
  );

  const runWebPageExtraction = useCallback(
    async (
      url: string,
      options?: { simplify?: boolean; autoSpeak?: boolean; label?: string }
    ) => {
      const cleanUrl = url.trim();
      if (!cleanUrl) return;
      const simplify = options?.simplify ?? false;

      setIsLoading(true);
      setActiveDocument(null);
      setActiveSourceUrl(cleanUrl);
      setUserQuery(options?.label || `Guía desde ${cleanUrl}`);
      setVoiceFeedback('');

      try {
        const settings = kvStore.getSettings();
        const { guide: extractedGuide, tramiteRecord } = await fetchOfficialTramiteGuide({
          url: cleanUrl,
          apiKey: settings.geminiApiKey,
          model: settings.geminiModel,
          simplify,
        });

        if (tramiteRecord) {
          await saveCustomTramite(tramiteRecord);
        }

        historyRef.current = [
          ...historyRef.current.slice(-4),
          { role: 'user', text: `Explícame paso a paso esta página oficial: ${cleanUrl}` },
          { role: 'model', text: `${extractedGuide.title}: ${extractedGuide.simpleAnswer}` },
        ];

        hydrateGuide(extractedGuide);

        if (options?.autoSpeak) {
          await speakGuideResponse(extractedGuide, simplify);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [hydrateGuide, speakGuideResponse]
  );

  const runDocumentAnalysis = useCallback(
    async (
      image: DocumentImageInput,
      options?: { simplify?: boolean; autoSpeak?: boolean; label?: string }
    ) => {
      const simplify = options?.simplify ?? false;
      setIsLoading(true);
      setActiveDocument(image);
      setActiveSourceUrl('');
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
            text:
              image.prompt?.trim() ||
              'Envié una foto de un documento oficial para que me lo expliques.',
          },
          { role: 'model', text: `${generated.title}: ${generated.simpleAnswer}` },
        ];

        hydrateGuide(generated);

        if (options?.autoSpeak) {
          await speakGuideResponse(generated, simplify);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [hydrateGuide, speakGuideResponse]
  );

  const handleVoiceReplyTranscript = useCallback(
    async (transcript: string) => {
      await runTextQuery(transcript, { simplify: false, autoSpeak: true });
    },
    [runTextQuery]
  );

  const { isListening, isTranscribing, toggleVoice, usesTapToStopRecording } = useVoiceCapture({
    onTranscript: handleVoiceReplyTranscript,
    onFeedback: setVoiceFeedback,
  });

  useEffect(() => {
    const incomingScanId = typeof params.scanId === 'string' ? params.scanId : '';
    const incomingSourceUrl = typeof params.sourceUrl === 'string' ? params.sourceUrl : '';
    const incomingPrompt = typeof params.prompt === 'string' ? params.prompt : '';
    const incomingReqId = typeof params.reqId === 'string' ? params.reqId : '';
    const shouldSpeak = params.autoSpeak === '1';

    const requestKey = incomingScanId
      ? `scan:${incomingScanId}`
      : incomingSourceUrl
      ? `url:${incomingSourceUrl}:${incomingReqId}`
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

      if (incomingSourceUrl) {
        if (!cancelled) {
          await runWebPageExtraction(incomingSourceUrl, {
            autoSpeak: shouldSpeak,
            label: incomingPrompt || `Guía desde ${incomingSourceUrl}`,
          });
        }
        return;
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
      if (generated.source === 'gemini-web' && generated.steps.length > 0) {
        const record = guideResponseToTramiteRecord(generated);
        await saveCustomTramite(record);
        generated.id = record.id;
      }

      kvStore.pushRecentQuery(targetPrompt);
      historyRef.current = [
        { role: 'user', text: targetPrompt },
        { role: 'model', text: `${generated.title}: ${generated.simpleAnswer}` },
      ];
      setActiveDocument(null);
      setActiveSourceUrl('');
      setUserQuery(targetPrompt);
      hydrateGuide(generated);

      if (shouldSpeak) {
        await speakGuideResponse(generated, false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    params.autoSpeak,
    params.prompt,
    params.reqId,
    params.scanId,
    params.sourceUrl,
    hydrateGuide,
    runDocumentAnalysis,
    runWebPageExtraction,
    speakGuideResponse,
  ]);

  const handleToggleListen = async () => {
    if (isSpeaking) {
      await pauseSpeaking();
      setVoiceFeedback('Audio en pausa. Toca Reanudar o Detener.');
      return;
    }
    if (isSpeechPaused) {
      await resumeSpeaking();
      setVoiceFeedback('');
      return;
    }
    if (!guide) return;
    setVoiceFeedback('');
    await speakGuideResponse(guide, false);
  };

  const handleStopListen = async () => {
    await stopSpeaking();
    setVoiceFeedback('Audio detenido.');
  };

  const handleToggleStep = (order: number) => {
    if (!guide) return;
    const exists = completedSteps.includes(order);
    const next = exists
      ? completedSteps.filter((n) => n !== order)
      : [...completedSteps, order];
    setCompletedSteps(next);
    persistProgress(guide, next, checkedRequirements);
  };

  const handleToggleRequirement = (index: number) => {
    if (!guide) return;
    const exists = checkedRequirements.includes(index);
    const next = exists
      ? checkedRequirements.filter((n) => n !== index)
      : [...checkedRequirements, index];
    setCheckedRequirements(next);
    persistProgress(guide, completedSteps, next);
  };

  const handleShareOnMesh = async () => {
    if (!guide) return;
    const record = guideResponseToTramiteRecord(guide);
    await saveCustomTramite(record);
    const sent = await meshService.shareTramiteAcrossMesh(record);
    setShareFeedback(
      sent
        ? 'Guía enviada a los nodos conectados por Red Mesh.'
        : 'Guía guardada en tu teléfono. Conecta otro dispositivo (BLE o Relay LAN en Ajustes) para compartirla.'
    );
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
    if (activeSourceUrl) {
      void runWebPageExtraction(activeSourceUrl, {
        simplify: true,
        autoSpeak: true,
        label: 'Explicación más sencilla de la página oficial',
      });
      return;
    }
    void runTextQuery(userQuery, { simplify: true, autoSpeak: true });
  };

  const handleSendInput = () => {
    const clean = inputText.trim();
    if (!clean) return;
    setInputText('');
    const speechCmd = detectSpeechControlCommand(clean);
    if (speechCmd) {
      void executeSpeechCommand(speechCmd).then((msg) => setVoiceFeedback(msg));
      return;
    }
    if (/^(https?:\/\/|www\.|gob\.mx)/i.test(clean)) {
      void runWebPageExtraction(clean, { autoSpeak: false });
      return;
    }
    void runTextQuery(clean, { simplify: false, autoSpeak: false });
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
    guide?.source === 'gemini-web'
      ? `Web oficial + Gemini (${guide.modelUsed ?? '3.5-flash-lite'})`
      : guide?.source === 'web-page'
      ? 'Extraído de página oficial'
      : guide?.source === 'gemini'
      ? `Gemini AI · ${guide.modelUsed ?? 'gemini-3.5-flash-lite'}`
      : guide?.source === 'mesh-peer'
      ? 'Recibido vía Red Mesh'
      : 'Guía Local Offline';

  const totalSteps = guide?.steps?.length ?? 0;
  const completedCount = guide?.steps
    ? guide.steps.filter((s) => completedSteps.includes(s.order)).length
    : 0;
  const progressPct = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppHeader title="Conversación" onOpenNotices={() => setDrawerOpen(true)} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Banner de estado */}
        <View style={styles.statusBanner}>
          <View style={styles.statusLeft}>
            <View style={styles.pulseDot} />
            <Text style={styles.statusText}>
              {isLoading
                ? 'Consultando y armando tu guía...'
                : isSpeaking
                ? 'Voz Guía está hablando...'
                : isSpeechPaused
                ? 'Audio en pausa'
                : 'Voz Guía lista para escucharte'}
            </Text>
          </View>
          {isSpeaking || isSpeechPaused ? (
            <Pressable
              onPress={() => void handleStopListen()}
              accessibilityRole="button"
              accessibilityLabel="Detener audio"
            >
              <Text style={styles.audioStopBannerText}>Detener audio</Text>
            </Pressable>
          ) : (
            <Text style={styles.audioActiveText}>Audio listo</Text>
          )}
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

        {/* Tarjeta interactiva del asistente */}
        <View style={styles.agentCard}>
          <View style={styles.agentHeader}>
            <View style={styles.agentTitleRow}>
              <View style={styles.agentAvatar}>
                <Ionicons
                  name={
                    guide?.source === 'gemini-web' || guide?.source === 'web-page'
                      ? 'globe-outline'
                      : guide?.source === 'gemini'
                      ? 'sparkles'
                      : 'headset'
                  }
                  size={20}
                  color={Colors.onSecondaryContainer}
                />
              </View>
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.agentName}>Voz Guía</Text>
                <Text style={styles.sourceBadgeText}>{sourceLabel}</Text>
              </View>
            </View>

            <View style={styles.audioControlsRow}>
              <Pressable
                style={[
                  styles.listenBtn,
                  (isSpeaking || isSpeechPaused) && styles.listenBtnActive,
                ]}
                onPress={() => void handleToggleListen()}
                accessibilityRole="button"
                accessibilityLabel={
                  isSpeaking
                    ? 'Pausar audio'
                    : isSpeechPaused
                    ? 'Reanudar audio'
                    : 'Escuchar respuesta'
                }
              >
                <Ionicons
                  name={isSpeaking ? 'pause' : isSpeechPaused ? 'play' : 'volume-high'}
                  size={18}
                  color={
                    isSpeaking || isSpeechPaused
                      ? Colors.onSecondaryContainer
                      : Colors.onPrimaryFixed
                  }
                />
                <Text
                  style={[
                    styles.listenBtnText,
                    (isSpeaking || isSpeechPaused) && { color: Colors.onSecondaryContainer },
                  ]}
                >
                  {isSpeaking ? 'Pausar' : isSpeechPaused ? 'Reanudar' : 'Escuchar'}
                </Text>
              </Pressable>

              {(isSpeaking || isSpeechPaused) && (
                <Pressable
                  style={styles.stopMiniBtn}
                  onPress={() => void handleStopListen()}
                  accessibilityRole="button"
                  accessibilityLabel="Detener audio"
                >
                  <Ionicons name="stop" size={18} color={Colors.onError} />
                </Pressable>
              )}
            </View>
          </View>

          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loadingText}>
                {activeDocument
                  ? 'Gemini está leyendo tu documento y preparando pasos sencillos...'
                  : activeSourceUrl
                  ? 'Extrayendo información de la página oficial y armando tu guía...'
                  : 'Preparando tu guía interactiva paso a paso...'}
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

              {/* Barra de progreso interactiva */}
              {totalSteps > 0 ? (
                <View style={styles.progressBox}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressLabel}>
                      Avance de tu guía: {completedCount} de {totalSteps} pasos
                    </Text>
                    <Text style={styles.progressPct}>{progressPct}%</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
                  </View>
                </View>
              ) : null}

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

              {/* Checklist interactivo de documentos */}
              {guide?.requirements && guide.requirements.length > 0 ? (
                <View style={styles.requirementsBox}>
                  <Text style={styles.requirementsTitle}>
                    Documentos que necesitas (toca para marcar):
                  </Text>
                  {guide.requirements.map((req, idx) => {
                    const checked = checkedRequirements.includes(idx);
                    return (
                      <Pressable
                        key={`${req}-${idx}`}
                        style={styles.checkRow}
                        onPress={() => handleToggleRequirement(idx)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked }}
                      >
                        <Ionicons
                          name={checked ? 'checkbox' : 'square-outline'}
                          size={22}
                          color={checked ? Colors.secondary : Colors.onSurfaceVariant}
                        />
                        <Text
                          style={[styles.requirementItem, checked && styles.checkedText]}
                        >
                          {req}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {/* Pasos numerados interactivos con botón de voz individual */}
              {guide?.steps && guide.steps.length > 0 ? (
                <View style={styles.stepsList}>
                  {guide.steps.map((step) => {
                    const done = completedSteps.includes(step.order);
                    return (
                      <View
                        key={`${step.order}-${step.title}`}
                        style={[styles.stepItem, done && styles.stepItemDone]}
                      >
                        <Pressable
                          style={styles.stepTopPress}
                          onPress={() => handleToggleStep(step.order)}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: done }}
                        >
                          <View
                            style={[
                              styles.stepNumberBadge,
                              done && { backgroundColor: Colors.secondary },
                            ]}
                          >
                            {done ? (
                              <Ionicons name="checkmark" size={18} color={Colors.onPrimary} />
                            ) : (
                              <Text style={styles.stepNumberText}>{step.order}</Text>
                            )}
                          </View>
                          <View style={styles.stepContent}>
                            <Text style={[styles.stepTitle, done && styles.checkedText]}>
                              Paso {step.order}: {step.title}
                            </Text>
                            <Text style={styles.stepDetail}>{step.instruction}</Text>
                          </View>
                        </Pressable>

                        <View style={styles.stepActionsRow}>
                          <Pressable
                            style={styles.stepMiniBtn}
                            onPress={() => handleToggleStep(step.order)}
                            accessibilityRole="button"
                          >
                            <Ionicons
                              name={done ? 'checkmark-circle' : 'ellipse-outline'}
                              size={16}
                              color={done ? Colors.secondary : Colors.primary}
                            />
                            <Text style={styles.stepMiniBtnText}>
                              {done ? 'Completado' : 'Marcar listo'}
                            </Text>
                          </Pressable>

                          {(() => {
                            const stepSourceId = `step-${step.order}`;
                            const isStepSpeaking =
                              speech.sourceId === stepSourceId && speech.status === 'speaking';
                            const isStepPaused =
                              speech.sourceId === stepSourceId && speech.status === 'paused';

                            return (
                              <Pressable
                                style={[
                                  styles.stepMiniBtn,
                                  (isStepSpeaking || isStepPaused) && styles.stepMiniBtnActive,
                                ]}
                                onPress={() => {
                                  if (isStepSpeaking) {
                                    void pauseSpeaking();
                                    return;
                                  }
                                  if (isStepPaused) {
                                    void resumeSpeaking();
                                    return;
                                  }
                                  const settings = kvStore.getSettings();
                                  void speakSpanish(
                                    `Paso ${step.order}: ${step.title}. ${step.instruction}`,
                                    {
                                      rate: settings.speechRate,
                                      sourceId: stepSourceId,
                                      label: `Paso ${step.order}: ${step.title}`,
                                    }
                                  );
                                }}
                                accessibilityRole="button"
                              >
                                <Ionicons
                                  name={
                                    isStepSpeaking
                                      ? 'pause'
                                      : isStepPaused
                                      ? 'play'
                                      : 'volume-medium'
                                  }
                                  size={16}
                                  color={Colors.primary}
                                />
                                <Text style={styles.stepMiniBtnText}>
                                  {isStepSpeaking
                                    ? 'Pausar paso'
                                    : isStepPaused
                                    ? 'Reanudar paso'
                                    : 'Escuchar paso'}
                                </Text>
                              </Pressable>
                            );
                          })()}
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {/* Fuentes oficiales clicables */}
              {guide?.sourceUrls && guide.sourceUrls.length > 0 ? (
                <View style={styles.sourcesBox}>
                  <Text style={styles.sourcesTitle}>Páginas oficiales consultadas:</Text>
                  {guide.sourceUrls.map((src) => (
                    <Pressable
                      key={src.url}
                      style={styles.sourceLinkBtn}
                      onPress={() => void Linking.openURL(src.url)}
                      accessibilityRole="link"
                    >
                      <Ionicons name="open-outline" size={17} color={Colors.primary} />
                      <Text style={styles.sourceLinkText} numberOfLines={2}>
                        {src.title}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {guide?.closingTip ? (
                <View style={styles.tipBox}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={Colors.secondary} />
                  <Text style={styles.tipText}>{guide.closingTip}</Text>
                </View>
              ) : null}

              {/* Compartir guía por Red Mesh */}
              {guide && guide.steps.length > 0 ? (
                <Pressable
                  style={styles.meshShareBtn}
                  onPress={() => void handleShareOnMesh()}
                  accessibilityRole="button"
                >
                  <Ionicons name="share-social-outline" size={18} color={Colors.onSecondaryContainer} />
                  <Text style={styles.meshShareText}>Compartir esta guía por Red Mesh</Text>
                </Pressable>
              ) : null}

              {shareFeedback ? <Text style={styles.shareFeedbackText}>{shareFeedback}</Text> : null}

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

        {/* Botones de acción rápida */}
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
            <Text style={styles.quickActionText}>Más sencillo</Text>
          </Pressable>
        </View>

        <Pressable
          style={styles.webSearchBtn}
          onPress={() => void runTextQuery(userQuery, { forceWebSearch: true, autoSpeak: true })}
          accessibilityRole="button"
        >
          <Ionicons name="search-outline" size={18} color={Colors.onPrimaryFixed} />
          <Text style={styles.webSearchBtnText}>
            Buscar versión actualizada en páginas oficiales (gob.mx)
          </Text>
        </Pressable>

        {/* Input para mensaje nuevo / URL, foto de documento y micrófono */}
        <View style={styles.bottomBar}>
          <View style={styles.chatInputRow}>
            <TextInput
              style={styles.chatInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Escribe tu duda o pega una URL de gob.mx..."
              placeholderTextColor={Colors.onSurfaceVariant}
              onSubmitEditing={handleSendInput}
              returnKeyType="send"
            />
            <Pressable
              style={styles.chatSendBtn}
              onPress={handleSendInput}
              accessibilityRole="button"
              accessibilityLabel="Enviar pregunta o URL"
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
              >
                <Ionicons name="camera-outline" size={20} color={Colors.primary} />
                <Text style={styles.docActionText}>Foto con cámara</Text>
              </Pressable>
            ) : null}

            <Pressable
              style={styles.docActionBtn}
              onPress={() => void handlePickDocument('library')}
              accessibilityRole="button"
            >
              <Ionicons name="document-attach-outline" size={20} color={Colors.primary} />
              <Text style={styles.docActionText}>
                {Platform.OS === 'web' ? 'Subir foto de documento (Gemini)' : 'Foto de galería'}
              </Text>
            </Pressable>
          </View>

          <Pressable
            style={[
              styles.voiceReplyBtn,
              isListening && styles.voiceReplyBtnActive,
              isTranscribing && { backgroundColor: Colors.secondary },
            ]}
            onPress={() => void toggleVoice()}
            disabled={isTranscribing}
            accessibilityRole="button"
          >
            {isTranscribing ? (
              <ActivityIndicator size="small" color={Colors.onPrimary} />
            ) : (
              <Ionicons
                name={isListening ? 'stop' : 'mic'}
                size={24}
                color={Colors.onPrimary}
              />
            )}
            <Text style={styles.voiceReplyText}>
              {isTranscribing
                ? 'Entendiendo tu voz...'
                : isListening
                ? usesTapToStopRecording
                  ? 'Grabando... toca para enviar'
                  : 'Escuchando tu respuesta...'
                : 'Toca para responder por voz'}
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
  audioStopBannerText: {
    ...Typography.labelSm,
    fontSize: 12,
    color: Colors.error,
    textDecorationLine: 'underline',
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
  audioControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  stopMiniBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepMiniBtnActive: {
    backgroundColor: Colors.secondaryContainer,
    borderColor: Colors.secondary,
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
  progressBox: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    ...Typography.labelSm,
    color: Colors.primary,
  },
  progressPct: {
    ...Typography.labelSm,
    color: Colors.secondary,
  },
  progressTrack: {
    height: 8,
    borderRadius: 99,
    backgroundColor: Colors.outlineVariant,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 99,
    backgroundColor: Colors.secondary,
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
    gap: 8,
  },
  requirementsTitle: {
    ...Typography.labelMd,
    color: Colors.primary,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 2,
  },
  requirementItem: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
    flex: 1,
  },
  checkedText: {
    textDecorationLine: 'line-through',
    color: Colors.onSurfaceVariant,
  },
  stepsList: {
    gap: 10,
  },
  stepItem: {
    backgroundColor: Colors.surfaceContainerLow,
    padding: 12,
    borderRadius: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  stepItemDone: {
    backgroundColor: '#EDF9F6',
    borderColor: Colors.secondary,
  },
  stepTopPress: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
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
  stepActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  stepMiniBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  stepMiniBtnText: {
    ...Typography.labelSm,
    fontSize: 13,
    color: Colors.primary,
  },
  sourcesBox: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  sourcesTitle: {
    ...Typography.labelMd,
    color: Colors.primary,
  },
  sourceLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  sourceLinkText: {
    ...Typography.labelSm,
    color: Colors.primary,
    flex: 1,
    textDecorationLine: 'underline',
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
  meshShareBtn: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: Colors.secondaryContainer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  meshShareText: {
    ...Typography.labelMd,
    fontSize: 14,
    color: Colors.onSecondaryContainer,
  },
  shareFeedbackText: {
    ...Typography.bodySm,
    color: Colors.secondary,
    textAlign: 'center',
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
  webSearchBtn: {
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: Colors.primaryFixed,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  webSearchBtnText: {
    ...Typography.labelSm,
    color: Colors.onPrimaryFixed,
    flexShrink: 1,
  },
  bottomBar: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 16,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    marginTop: 4,
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
    backgroundColor: Colors.error,
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
